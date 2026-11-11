# Denodo ViewCompare

## Introduction

Denodo ViewCompare is a framework designed to validate metadata and data consistency between two Denodo environments. It helps accelerate testing during Denodo version upgrades, migrations, and platform updates.

The framework compares view definitions and underlying data across Source and Target Denodo environments, identifying discrepancies and providing detailed comparison results.

ViewCompare can be deployed on a dedicated Denodo V9 Host VDP server, which orchestrates comparisons between the Source and Target environments.

## Key Features

ViewCompare supports three types of comparisons:

### 1. Metadata Comparison
- Compares view definitions between Source and Target environments.
- Identifies differences in schema structure, field names, data types, precision, nullability, and other metadata properties.
- Results are stored in `bv_metadata_comparison`.

### 2. Row Count Comparison
- Compares the total number of records returned by Source and Target views.
- Supports comparison using view names or custom SELECT queries.
- Supports conditional comparisons using WHERE clauses.
- Results are stored in `bv_row_count_comparison`.

### 3. Row-Level Data Comparison (Checksum)

- Performs detailed record-level data validation.
- Uses SHA-256 hashing to identify differences between Source and Target datasets.
- Supports comparison using view names or custom SELECT queries.
- Supports filtered comparisons using WHERE conditions.
- Uses primary keys to match records across environments.
- Identifies missing records and mismatched data.
- Results are stored in `bv_checksum_comparison`.

The checksum comparison supports the following observations:

| Observation | Description |
|---|---|
| missing in source | Record exists in Target but not in Source |
| missing in target | Record exists in Source but not in Target |
| mismatch | Record exists in both environments but the data differs |

Identical records are not written to the comparison results.

## Architecture

ViewCompare consists of four main components:

1. **Host VDP Server:** Denodo V9 instance where ViewCompare is deployed and executed.
2. **Source VDP Server:** Existing Denodo environment used as the baseline.
3. **Target VDP Server:** New or upgraded Denodo environment being validated.
4. **Report Database:** Relational database used to persist comparison results.

The Host VDP server connects to both Source and Target environments and orchestrates the comparison process.

A non-production Host VDP server, such as a Sandbox, is recommended.

## Prerequisites

Before deploying ViewCompare, ensure the following requirements are met:

- Denodo V9 Host VDP server.
- Java 17 or later on the Host VDP server JVM.
- Network connectivity between Host, Source, and Target VDP servers.
- Default VDP port 9999 accessible on Source and Target servers.
- JDBC-supported relational database for storing comparison results.
- Required database report tables created using the provided DDL scripts.
- Appropriate permissions to access the views being compared and insert checksum comparison results.
- Unique, non-null primary key values for row-level checksum comparison.

### Custom Java JARs

The checksum comparison is implemented using Java stored procedures running directly inside the Denodo VDP engine.

The following custom JARs are provided:

| JAR | Registered Procedure | Purpose |
|---|---|---|
| ChecksumCompare.jar | checksum_compare | Checksum comparison using view names |
| ChecksumCompareQuery.jar | checksum_compare_by_query | Checksum comparison using SELECT queries |

Both JARs must be imported and registered as Java stored procedures on the Host VDP server.

## Repository Structure

```text
denodo-viewcompare/
│
├── VQL/
│   └── VQL export and configuration files
│
├── custom_jar/
│   ├── ChecksumCompare.jar
│   └── ChecksumCompareQuery.jar
│
├── report_table_DDL/
│   ├── MYSQL_DDL
│   ├── Oracle_DDL
│   └── Sqlserver_DDL
│
├── runbook for ViewCompare/
│   └── Run_Book_ViewCompare_Phase2.pdf
│
├── sample_output/
│   └── Sample comparison results
│
├── README.md
├── SUPPORT.md
└── LICENSE.txt
```

## Setup and Configuration

### 1. Create Report Tables

Choose a supported JDBC relational database to store comparison results.

Execute the corresponding DDL script available under `report_table_DDL/`.

Currently provided database scripts:
- MySQL
- Oracle
- SQL Server

The required report tables are:

- metadata_comparison
- row_count_comparison
- checksum_comparison

Ensure sufficient database storage is provisioned because results from every execution are retained.

### 2. Import Custom JARs

Import the following JAR files into Design Studio using:

`File → Extension Management`

Create the corresponding Java stored procedures using the following classes:

| JAR | Java Class |
|---|---|
| ChecksumCompare.jar | com.denodo.vdp.custom.functions.ChecksumCompare |
| ChecksumCompareQuery.jar | com.denodo.vdp.custom.functions.ChecksumCompareQuery |

Register the procedures with the following names:

- `checksum_compare`
- `checksum_compare_by_query`

### 3. Import VQL Files

The deliverable includes the VQL export package and database-specific report view packages.

- Extract the VQL export package.
- Update `elementExport.properties` with the report database connection details.
- Configure the JDBC connection properties in the database-specific report view package.
- Encrypt passwords using the Denodo encryption utility.
- Import the VQL files and corresponding properties into the Host VDP server.
- Perform a source refresh on the report views after importing.

The VQL configuration creates the `vdb_viewcompare` Virtual Database containing the comparison procedures and writable report views.

### 4. Configure Source and Target Connections

Configure the following data sources in `vdb_viewcompare`:

| Data Source | Purpose |
|---|---|
| ds_source_denodo_server | Connects to Source VDP |
| ds_target_denodo_server | Connects to Target VDP |

Configure the appropriate hostname, port, database name, and authentication credentials for each environment.

### 5. Configure Report Database Connectivity

Configure the JDBC data source to connect to the database containing the report tables.

The following writable base views must be available:

- bv_metadata_comparison
- bv_row_count_comparison
- bv_checksum_comparison

For databases other than MySQL, Oracle, and SQL Server, create the corresponding data source and base views using the required naming conventions.

## Executing Comparisons

All comparison procedures are executed from the Host VDP server.

### 1. Metadata Comparison

Procedure: `metadata_check`

```sql
CALL metadata_check(
    'source_dbname',
    'source_view_name',
    'target_dbname',
    'target_view_name'
);
```

Results: `bv_metadata_comparison`

### 2. Row Count Comparison

**Using View Names**

Procedure: `count_check`

```sql
CALL count_check(
    'source_db_name',
    'source_view_name',
    'target_db_name',
    'target_view_name'
);
```

**Using SELECT Queries**

Procedure: `count_check_by_query`

```sql
CALL count_check_by_query(
    'SELECT * FROM admin.bv_test_products',
    'SELECT * FROM admin.bv_test_products2'
);
```

**Using Conditional Queries**

```sql
CALL count_check_by_query(
    'SELECT * FROM admin.bv_test_products WHERE "Product"=''Z8Z04A''',
    'SELECT * FROM admin.bv_test_products2 WHERE "Product"=''Z8Z04A'''
);
```

Results: `bv_row_count_comparison`

### 3. Checksum Comparison

**Using View Names**

Procedure: `checksum_compare`

```sql
CALL checksum_compare(
    'pk_field_src',
    'view_name_src',
    'db_name_src',
    'pk_field_tgt',
    'view_name_tgt',
    'db_name_tgt'
);
```

**Using SELECT Queries**

Procedure: `checksum_compare_by_query`

```sql
CALL checksum_compare_by_query(
    'pk_field_src',
    'SELECT * FROM db.view_a',
    'pk_field_tgt',
    'SELECT * FROM db.view_b'
);
```

**Using Conditional Queries**

```sql
CALL checksum_compare_by_query(
    'CASE_ID',
    'SELECT * FROM denodo.bv_cc_case_definition WHERE case_comments=''No comments''',
    'Case_Id',
    'SELECT * FROM denodo.bv_cc_case_definition WHERE case_comments=''No comments'''
);
```

Results: `bv_checksum_comparison`

Note: Both queries must return compatible columns in the same order. Primary key columns are excluded from the checksum calculation.

## Sample_output screenshots
bv_checksum_comparison(view_inputs):

![checksum_compare](./sample_output/bv_checksum_comparison\(view_input\).jpg?raw=true)

bv_checksum_comparison(query_inputs):


![checksum_compare_by_query](./sample_output/bv_cehcksum_comparison\(query_input\).jpg?raw=true)

bv_row_count_comparison(view_inputs):

![row_count_comparison](./sample_output/bv_row_count_comparison\(view_inputs\).png?raw=true)

bv_row_count_comparison(query_inputs):

![row_count_comparison_query_inputs](./sample_output/bv_row_count_comparison\(query_inputs\).png?raw=true)

## History and Result Persistence

ViewCompare maintains historical comparison results across executions.

Every execution inserts its results into the corresponding report table. Existing results are not automatically deleted or truncated.

The `date_compare` column identifies the execution timestamp.

Example:

```sql
SELECT *
FROM vdb_viewcompare.bv_checksum_comparison
WHERE date_compare >= '<run start timestamp>'
ORDER BY date_compare DESC;
```

Always filter comparison results using `date_compare` to identify the relevant execution.

If a clean report table is required, explicitly truncate the underlying report table before execution, after backing up any results that need to be retained.

## Migration from Python-Based Implementation

The Phase 2 implementation replaces the previous Python-based checksum execution with Java stored procedures running inside the Denodo VDP engine.

| Area | Previous Implementation | Phase 2 Implementation |
|---|---|---|
| Checksum execution | Python script over SSH | Java stored procedures |
| Execution mechanism | SSH Custom Wrapper | Denodo VDP engine |
| Runtime | Python 3.10+, JayDeBeApi | Java 17+ |
| Input methods | View names | View names and SELECT queries |
| Conditional comparison | Limited | Supports WHERE conditions |
| Result retention | Previous results truncated | Historical results retained |
| Execution identification | Latest execution | date_compare |

### Components No Longer Required

After successfully validating the Java implementation, the following ViewCompare-specific Python dependencies can be removed if they are not used elsewhere:

- `bv_ssh_python_script_executor` base view.
- `ds_ssh_script_executor` data source.
- `checksum_py_script.py`.
- SSH Custom Wrapper.
- Python 3.10+ and JayDeBeApi dependencies.
- ViewCompare-specific copied JDBC driver.
- SSH server and port 22 configuration used exclusively for the old implementation.
- Scheduled jobs or scripts invoking the old Python execution flow.

Ensure that no other application or Denodo use case depends on these shared components before removing them.

### Upgrade Validation

Before removing the previous implementation:

1. Verify that the Host VDP server runs Java 17 or later.
2. Update the report tables using the Phase 2 DDL scripts.
3. Import both custom JARs.
4. Register the Java stored procedures.
5. Re-import the updated VQL packages.
6. Refresh the report views.
7. Validate metadata, row count, and checksum comparisons against previously tested views.
8. Replace references to the old Python execution flow with the new stored procedure calls.

Refer to the Phase 2 Run Book for detailed upgrade and cleanup instructions.


## Denodo ViewCompare License

This project is distributed under **Apache License, Version 2.0**. 

See [LICENSE](LICENSE)

## Denodo ViewCompare Support

This project is supported by **Denodo Community**. 

See [SUPPORT](SUPPORT.md)

## Authors

- Developed by: Dineshraja Annadurai, Harini Karthik, Rupa Shiva Dharshini
- Contact: msubramaniam@denodo.com, dannadurai@denodo.com, hkarthikeyan@denodo.com, rvanamamalai@denodo.com