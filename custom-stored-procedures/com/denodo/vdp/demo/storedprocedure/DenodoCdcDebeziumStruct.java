package com.denodo.vdp.demo.storedprocedure;

import com.denodo.vdb.engine.storedprocedure.AbstractStoredProcedure;
import com.denodo.vdb.engine.storedprocedure.StoredProcedureException;
import com.denodo.vdb.engine.storedprocedure.StoredProcedureParameter;
import com.denodo.vdb.engine.storedprocedure.StoredProcedureResultSet;

import java.sql.ResultSet;
import java.sql.Types;
import java.util.*;
import java.util.regex.*;

public class DenodoCdcDebeziumStruct extends AbstractStoredProcedure {

    private static final int LOG_WARNING = 1;
    private static final int LOG_ERROR = 2;

    @Override
    public String getName() {
        return "DenodoCdcDebeziumStruct";
    }

    @Override
    public String getDescription() {
        return "Generates and executes an SQL statement from a raw Debezium-style Kafka Struct message. " +
               "Accepts optional second parameter to override cache table lookup.";
    }

    @Override
    public StoredProcedureParameter[] getParameters() {
        return new StoredProcedureParameter[] {
            new StoredProcedureParameter("input_message", Types.VARCHAR, StoredProcedureParameter.DIRECTION_IN),
            new StoredProcedureParameter("if_store_change", Types.BOOLEAN, StoredProcedureParameter.DIRECTION_IN),
            new StoredProcedureParameter("override_table", Types.VARCHAR, StoredProcedureParameter.DIRECTION_IN, true),
            new StoredProcedureParameter("sql", Types.VARCHAR, StoredProcedureParameter.DIRECTION_OUT)
        };
    }

   @Override
    protected void doCall(Object[] inputValues) throws StoredProcedureException {
        String msg = (String) inputValues[0];
        if (msg == null || msg.trim().isEmpty()) {
            throw new StoredProcedureException("Input message is null or empty.");
        }

        Boolean if_change_log = (Boolean) inputValues[1];
        if (if_change_log == null) {
            throw new StoredProcedureException("if_change_log is null.");
        }

        String overrideTable = null;
        if (inputValues.length > 2 && inputValues[2] != null) {
            overrideTable = inputValues[2].toString().trim();
        }

        try {
            String op = extract("op=(\\w)", msg);
            String db = extract("db=([^,}]+)", msg);
            String datasource = extract("connector=([^,}]+)", msg);
            String table = extract("table=([^,}]+)", msg);
            String fullTable = db + "." + table;

            String before = extractStruct("before=Struct", msg);
            String after = extractStruct("after=Struct", msg);

            String cacheTableName;

            if (overrideTable != null && !overrideTable.isEmpty()) {
                cacheTableName = overrideTable;
                getEnvironment().log(LOG_WARNING, "⚠ Using override table: " + cacheTableName);
            } else {
                try (ResultSet rs = getEnvironment().executeQuery(
                        "SELECT target_table_name FROM admin.target_mapping WHERE datasource = ? AND table_name = ?",
                        new Object[]{datasource, fullTable})) {

                    if (rs.next()) {
                        cacheTableName = rs.getString("target_table_name");
                        getEnvironment().log(LOG_WARNING, "Mapped to cache table: " + cacheTableName);
                    } else {
                        throw new StoredProcedureException("No mapping found for datasource: " + datasource + " and table: " + fullTable);
                    }

                } catch (Exception e) {
                    throw new StoredProcedureException("Failed to query admin.target_mapping: " + e.getMessage(), e);
                }
            }

            String sql = null;

            if (!if_change_log) {
                switch (op) {
                    case "c":
                        sql = toInsert(cacheTableName, after);
                        getEnvironment().executeUpdate(sql);
                        break;
                    case "d":
                        sql = toDelete(cacheTableName, before);
                        getEnvironment().executeUpdate(sql);
                        break;
                    case "u":
                        String sqlDelete = toDelete(cacheTableName, before);
                        String sqlInsert = toInsert(cacheTableName, after);
                        // execute separately
                        getEnvironment().executeUpdate(sqlDelete);
                        getEnvironment().executeUpdate(sqlInsert);
                        sql = sqlDelete + "\n" + sqlInsert;
                        break;
                    default:
                        throw new StoredProcedureException("Unsupported op type: " + op);
                }
            } else {
                switch (op) {
                    case "c":
                        sql = toInsert_change_log(cacheTableName, after);
                        getEnvironment().executeUpdate(sql);
                        break;
                    case "d":
                        sql = toDelete_change_log(cacheTableName, before);
                        getEnvironment().executeUpdate(sql);
                        break;
                    case "u":
                        String sqlDelete = toDelete_change_log(cacheTableName, before);
                        String sqlInsert = toInsert_change_log(cacheTableName, after);
                        // execute separately
                        getEnvironment().executeUpdate(sqlDelete);
                        getEnvironment().executeUpdate(sqlInsert);
                        sql = sqlDelete + "\n" + sqlInsert;
                        break;
                    default:
                        throw new StoredProcedureException("Unsupported op type: " + op);
                }
            }

            // Add result feedback
            getProcedureResultSet().addRow(new Object[]{"Executed: " + sql});

        } catch (Exception e) {
            throw new StoredProcedureException("Failed to parse message: " + e.getMessage(), e);
        }
    }


    private String extract(String regex, String text) {
        Matcher m = Pattern.compile(regex).matcher(text);
        return m.find() ? m.group(1) : null;
    }

    private String extractStruct(String key, String input) {
        Pattern pattern = Pattern.compile(Pattern.quote(key) + "\\{([^}]*)\\}");
        Matcher matcher = pattern.matcher(input);
        return matcher.find() ? matcher.group(1).trim() : null;
    }

    private Map<String, String> parseFields(String struct) {
        Map<String, String> fields = new LinkedHashMap<>();
        if (struct == null || struct.trim().isEmpty()) return fields;
        String[] pairs = struct.split(",\\s*");
        for (String pair : pairs) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                fields.put(kv[0].trim(), kv[1].trim());
            }
        }
        return fields;
    }

    private String quote(String val) {
        return val.matches("-?\\d+(\\.\\d+)?") ? val : "'" + val + "'";
    }

    private String toInsert(String table, String struct) {
        Map<String, String> fields = parseFields(struct);
        String cols = String.join(", ", fields.keySet());
        String vals = String.join(", ", fields.values().stream().map(this::quote).toList());
        return String.format("INSERT INTO %s (%s) VALUES (%s);", table, cols, vals);
    }

    private String toInsert_change_log(String table, String struct) {
        Map<String, String> fields = parseFields(struct);
        String cols = String.join(", ", fields.keySet());
        String vals = String.join(", ", fields.values().stream().map(this::quote).toList());
        return String.format("INSERT INTO %s (operation, %s, insert_time, rowstatus) VALUES ('insert', %s, CURRENT_TIMESTAMP, 'V');", table, cols, vals);
    }

    private String toDelete(String table, String struct) {
        Map<String, String> fields = parseFields(struct);
        return String.format("DELETE FROM %s WHERE %s;", table, toConditions(fields));
    }

    private String toDelete_change_log(String table, String struct) {
        Map<String, String> fields = parseFields(struct);
        String cols = String.join(", ", fields.keySet());
        String vals = String.join(", ", fields.values().stream().map(this::quote).toList());
        return String.format("INSERT INTO %s (operation, %s, insert_time, rowstatus) VALUES ('delete', %s, CURRENT_TIMESTAMP, 'V');", table, cols, vals);
    }

    private String toConditions(Map<String, String> fields) {
        return String.join(" AND ",
                fields.entrySet().stream()
                        .map(e -> e.getKey() + "=" + quote(e.getValue()))
                        .toList());
    }

    private String toAssignments(Map<String, String> fields) {
        return String.join(", ",
                fields.entrySet().stream()
                        .map(e -> e.getKey() + "=" + quote(e.getValue()))
                        .toList());
    }
}
