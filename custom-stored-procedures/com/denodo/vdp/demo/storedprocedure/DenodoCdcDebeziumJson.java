package com.denodo.vdp.demo.storedprocedure;

import com.denodo.vdb.engine.storedprocedure.AbstractStoredProcedure;
import com.denodo.vdb.engine.storedprocedure.StoredProcedureException;
import com.denodo.vdb.engine.storedprocedure.StoredProcedureParameter;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonElement;

import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class DenodoCdcDebeziumJson extends AbstractStoredProcedure {

    private static final int LOG_WARNING = 1;
    private static final int LOG_ERROR = 2;

    @Override
    public String getName() {
        return "DenodoCdcDebeziumJson";
    }

    @Override
    public String getDescription() {
        return "Processes a Debezium JSON event and applies INSERT/DELETE/UPDATE "
             + "to the cache table. Supports optional override table and change-log mode.";
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
            throw new StoredProcedureException("input_message is null or empty.");
        }

        Boolean if_change_log = (Boolean) inputValues[1];
        if (if_change_log == null) {
            throw new StoredProcedureException("if_store_change is null.");
        }

        String overrideTable = null;
        if (inputValues.length > 2 && inputValues[2] != null) {
            overrideTable = inputValues[2].toString().trim();
        }

        try {
            JsonObject root = JsonParser.parseString(msg).getAsJsonObject();

            JsonObject payload = root.getAsJsonObject("payload");
            if (payload == null) {
                throw new StoredProcedureException("Missing 'payload' in JSON message.");
            }

            JsonElement beforeEl = payload.get("before");
            JsonObject before = (beforeEl != null && beforeEl.isJsonObject())
                    ? beforeEl.getAsJsonObject() : null;

            JsonElement afterEl = payload.get("after");
            JsonObject after = (afterEl != null && afterEl.isJsonObject())
                    ? afterEl.getAsJsonObject() : null;

            String op = payload.get("op").getAsString();

            JsonObject source = payload.getAsJsonObject("source");
            if (source == null) {
                throw new StoredProcedureException("Missing 'source' in payload.");
            }

            String datasource = getStringSafe(source, "connector");
            String db = getStringSafe(source, "db");
            String table = getStringSafe(source, "table");

            if (datasource == null || db == null || table == null) {
                throw new StoredProcedureException(
                    "Missing connector/db/table in source. datasource=" + datasource
                    + ", db=" + db + ", table=" + table);
            }

            String fullTable = db + "." + table;

            // ----------------------------------------------------------
            // Find target cache table (override_table or admin.target_mapping)
            // ----------------------------------------------------------
            String cacheTableName;
            if (overrideTable != null && !overrideTable.isEmpty()) {
                cacheTableName = overrideTable;
                getEnvironment().log(LOG_WARNING, "Using override table: " + cacheTableName);
            } else {
                try (ResultSet rs = getEnvironment().executeQuery(
                        "SELECT target_table_name FROM admin.target_mapping WHERE datasource = ? AND table_name = ?",
                        new Object[]{datasource, fullTable})) {

                    if (rs.next()) {
                        cacheTableName = rs.getString("target_table_name");
                        getEnvironment().log(LOG_WARNING, "Mapped to cache table: " + cacheTableName);
                    } else {
                        throw new StoredProcedureException(
                            "No mapping found for datasource=" + datasource
                            + " and table=" + fullTable);
                    }
                } catch (Exception e) {
                    throw new StoredProcedureException("Failed to query admin.target_mapping: " + e.getMessage(), e);
                }
            }

            String sql;

            // ----------------------------------------------------------
            // Main CDC logic (c/u/d/r)
            // ----------------------------------------------------------
            if (!if_change_log) {

                switch (op) {

                    case "c": // INSERT
                        if (after == null) throw new StoredProcedureException("op='c' but 'after' is null.");
                        sql = buildInsert(cacheTableName, after);
                        getEnvironment().executeUpdate(sql);
                        break;

                    case "d": // DELETE
                        if (before == null) throw new StoredProcedureException("op='d' but 'before' is null.");
                        sql = buildDelete(cacheTableName, before);
                        getEnvironment().executeUpdate(sql);
                        break;

                    case "u": // UPDATE = delete + insert
                        if (before == null || after == null)
                            throw new StoredProcedureException("op='u' but before/after missing.");
                        String del = buildDelete(cacheTableName, before);
                        String ins = buildInsert(cacheTableName, after);
                        getEnvironment().executeUpdate(del);
                        getEnvironment().executeUpdate(ins);
                        sql = del + "\n" + ins;
                        break;

                    case "r": // Snapshot record → treat as insert
                        if (after == null) throw new StoredProcedureException("op='r' but 'after' is null.");
                        sql = buildInsert(cacheTableName, after);
                        getEnvironment().executeUpdate(sql);
                        break;

                    default:
                        throw new StoredProcedureException("Unsupported op: " + op);
                }

            } else {
                // Change-log mode
                switch (op) {

                    case "c":
                        if (after == null) throw new StoredProcedureException("op='c' but 'after' is null.");
                        sql = buildInsertChangeLog(cacheTableName, after);
                        getEnvironment().executeUpdate(sql);
                        break;

                    case "d":
                        if (before == null) throw new StoredProcedureException("op='d' but 'before' is null.");
                        sql = buildDeleteChangeLog(cacheTableName, before);
                        getEnvironment().executeUpdate(sql);
                        break;

                    case "u":
                        if (before == null || after == null)
                            throw new StoredProcedureException("op='u' but before/after missing.");
                        String del = buildDeleteChangeLog(cacheTableName, before);
                        String ins = buildInsertChangeLog(cacheTableName, after);
                        getEnvironment().executeUpdate(del);
                        getEnvironment().executeUpdate(ins);
                        sql = del + "\n" + ins;
                        break;

                    case "r":
                        if (after == null) throw new StoredProcedureException("op='r' but 'after' is null.");
                        sql = buildInsertChangeLog(cacheTableName, after);
                        getEnvironment().executeUpdate(sql);
                        break;

                    default:
                        throw new StoredProcedureException("Unsupported op (change-log): " + op);
                }
            }

            getProcedureResultSet().addRow(new Object[]{"Executed: " + sql});

        } catch (Exception e) {
            throw new StoredProcedureException("Error processing Debezium JSON: " + e.getMessage(), e);
        }
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private String getStringSafe(JsonObject obj, String field) {
        JsonElement el = obj.get(field);
        return (el != null && !el.isJsonNull()) ? el.getAsString() : null;
    }

    private String buildInsert(String table, JsonObject data) {

        List<String> cols = new ArrayList<>();
        List<String> vals = new ArrayList<>();

        Set<String> fields = data.keySet();
        for (String f : fields) {
            JsonElement v = data.get(f);
            cols.add(f);
            vals.add(jsonToSqlLiteral(v));
        }

        return "INSERT INTO " + table +
               " (" + String.join(", ", cols) + ") VALUES (" +
               String.join(", ", vals) + ");";
    }

    private String buildDelete(String table, JsonObject before) {

        List<String> conditions = new ArrayList<>();
        Set<String> fields = before.keySet();

        for (String f : fields) {
            JsonElement v = before.get(f);
            conditions.add(f + "=" + jsonToSqlLiteral(v));
        }

        return "DELETE FROM " + table + " WHERE " +
               String.join(" AND ", conditions) + ";";
    }

    private String buildInsertChangeLog(String table, JsonObject data) {

        List<String> cols = new ArrayList<>();
        List<String> vals = new ArrayList<>();

        cols.add("operation");
        vals.add("'insert'");

        for (String f : data.keySet()) {
            cols.add(f);
            vals.add(jsonToSqlLiteral(data.get(f)));
        }

        cols.add("insert_time");
        vals.add("CURRENT_TIMESTAMP");

        cols.add("rowstatus");
        vals.add("'V'");

        return "INSERT INTO " + table +
                " (" + String.join(", ", cols) + ") VALUES (" +
                String.join(", ", vals) + ");";
    }

    private String buildDeleteChangeLog(String table, JsonObject before) {

        List<String> cols = new ArrayList<>();
        List<String> vals = new ArrayList<>();

        cols.add("operation");
        vals.add("'delete'");

        for (String f : before.keySet()) {
            cols.add(f);
            vals.add(jsonToSqlLiteral(before.get(f)));
        }

        cols.add("insert_time");
        vals.add("CURRENT_TIMESTAMP");

        cols.add("rowstatus");
        vals.add("'V'");

        return "INSERT INTO " + table +
                " (" + String.join(", ", cols) + ") VALUES (" +
                String.join(", ", vals) + ");";
    }

    // -----------------------------------------------------
    // JSON → SQL literal
    // -----------------------------------------------------
    private String jsonToSqlLiteral(JsonElement v) {

        if (v == null || v.isJsonNull()) {
            return "NULL";
        }

        if (v.isJsonPrimitive()) {
            var p = v.getAsJsonPrimitive();

            if (p.isNumber()) return p.getAsNumber().toString();
            if (p.isBoolean()) return p.getAsBoolean() ? "TRUE" : "FALSE";
            if (p.isString())
                return "'" + p.getAsString().replace("'", "''") + "'";
        }

        // arrays / objects → store as escaped JSON
        return "'" + v.toString().replace("'", "''") + "'";
    }
}
