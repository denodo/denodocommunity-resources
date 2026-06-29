# Dynamic Pivot and Unpivot VQL Procedures for Denodo

## Overview

This repository contains generic dynamic Pivot and Unpivot VQL stored procedures for the **Pivoting and UnPivoting** Views in Denodo.

These procedures dynamically generate and execute VQL to transform data between:

- Row-based format → Pivoted format
- Pivoted format → Normalized row-based format

The procedures are reusable across datasets and do not require hardcoded pivot values or columns.

---
## Importing the VQL Stored Procedures



### Import Using Design Studio Import Wizard

1. Open Denodo Design Studio.


2. Navigate to:

   ```
   File → Import → upload Stored Procedure VQL File
   ```
   
3. Connect to the target Virtual DataPort database with the view you are trying to Pivot/Unpivot.

5. Click **Ok**.

6. Verify that the procedures are created successfully in the appropriate virtual database.

---

## Import Using VQL Shell

Execute the VQL script directly from the VQL Shell by connecting to the database with the view:

```sql
CREATE OR REPLACE VQL PROCEDURE ...
```




---
<br>
<br>

# Dynamic Pivot Stored Procedure

## Procedure Name
## `sp_dynamic_pivot_procedure`


### Description

The `sp_dynamic_pivot_procedure` stored procedure dynamically transforms row-based data into a pivoted view by converting distinct values from a specified pivot column into individual columns.

The procedure automatically:

* Identifies all distinct values in the pivot column.
* Generates pivot columns dynamically using aggregation logic.
* Creates or replaces a pivoted output view.
* Supports configurable grouping, measure, and pivot columns.
* Returns the generated VQL statement for debugging and auditing purposes.
---

## Input Parameters

| Parameter | Type | Description |
|---|---|---|
| `in_view_name` | VARCHAR | Source view name |
| `in_output_view_name` | VARCHAR | Output pivot view name |
| `in_grouping_col` | VARCHAR | Grouping column |
| `in_pivot_col` | VARCHAR | Column whose values become pivot columns |
| `in_value_col` | VARCHAR | Measure column |
| `in_prefix` | VARCHAR | Prefix added to generated pivot columns |
| `in_agg_type` | VARCHAR | Type of aggregation used (SUM, MAX, MIN, AVG, COUNT) |
| `query` | VARCHAR OUT | Returns generated VQL query |

---

## Procedure Logic

The procedure performs the following steps:

### 1. Create Helper View

A temporary helper view is created to extract distinct pivot values.

Example generated helper view:

```sql
CREATE OR REPLACE VIEW tmp_pivot_values AS
SELECT DISTINCT revn_year_mnth_dt AS pivot_value
FROM training.bv_revenue_data
```

---

### 2. Read Pivot Values Using Cursor

The cursor iterates through all distinct pivot values.

Example:

| pivot_value |
|---|
| 202401 |
| 202402 |
| 202403 |

---

### 3. Dynamically Build Pivot Query

For every pivot value, the procedure generates:

```sql
SUM(
    CASE WHEN revn_year_mnth_dt = '202401'
    THEN revenue_amount
    ELSE NULL
END
) AS "rev_202401"
```

---

### 4. Create Final Pivot View

Generated output:

```sql
CREATE OR REPLACE VIEW training.sp_pivoted_view AS
SELECT category,
SUM(CASE WHEN revn_year_mnth_dt='202401'
THEN revenue_amount ELSE NULL END) AS "rev_202401",
SUM(CASE WHEN revn_year_mnth_dt='202402'
THEN revenue_amount ELSE NULL END) AS "rev_202402"
FROM training.bv_revenue_data
GROUP BY category
```

---

### 5. Cleanup

Temporary helper view:

```sql
DROP VIEW tmp_pivot_values
```

is executed automatically.

---


## Example Usage

### Source Data

| category | revn_year_mnth_dt | revenue_amount |
|---|---|---|
| A | 202401 | 100 |
| A | 202402 | 200 |
| B | 202401 | 300 |

---

### Procedure Call

```sql
CALL sp_dynamic_pivot_procedure(
    'training.bv_revenue_data',
    'training.sp_pivoted_view',
    'category',
    'revn_year_mnth_dt',
    'revenue_amount',
    'rev_',
    'SUM'
);
```
OR
```sql
SELECT query
FROM sp_dynamic_pivot_procedure()
WHERE in_view_name        = 'bv_revenue_data'
  AND in_output_view_name = 'iv_revenue_data_pivoted'
  AND in_grouping_col     = 'category'
  AND in_pivot_col        = 'revn_year_mnth_dt'
  AND in_value_col        = 'revenue_amount'
  AND in_prefix           = 'rev_'
  AND in_agg_type         = 'SUM';
```
---

### Generated Output View

| category | rev_202401 | rev_202402 |
|---|---|---|
| A | 100 | 200 |
| B | 300 | NULL |

---

## Performance Considerations

This approach is suitable for:

- Small to medium pivot cardinality
- Dynamic reporting scenarios
- Metadata-driven transformations

Potential limitations:

- Large number of pivot columns may generate large VQL
- Excessive pivot cardinality may impact optimization performance

---

## Use Cases

- Financial reporting
- Dynamic month-wise reporting
- Cross-tab reporting
- BI tool integrations
- Time-series transformations

---

# Dynamic Unpivot Stored Procedure

## Procedure Name

## `sp_dynamic_unpivot_procedure`

### Description

The `sp_dynamic_unpivot_procedure` stored procedure dynamically transforms pivoted data into a normalized row-based structure by converting pivot columns into rows.

The procedure automatically:

* Identifies pivoted columns using a configurable prefix.
* Extracts the suffix portion of each column name to derive the unpivoted dimension value.
* Generates a dynamic `UNION ALL` query to convert columns into rows.
* Creates or replaces an unpivoted output view.
* Returns the generated VQL statement for debugging and auditing purposes.

> **Note:** This procedure does not reverse or reconstruct the original source data used to create the pivoted view. Any aggregation performed during the pivot operation (for example, `SUM`, `AVG`, `MIN`, `MAX`, or `COUNT`) cannot be reversed. The procedure simply converts pivoted columns back into rows while preserving the aggregated values present in the pivoted dataset.

This procedure is useful for normalizing wide datasets and preparing pivoted data for downstream processing, reporting, or analytical workloads.

---

## Input Parameters

| Parameter | Type | Description |
|---|---|---|
| `in_view_name` | VARCHAR | Source view containing pivot columns |
| `in_prefix` | VARCHAR | Prefix used to identify pivot columns |
| `in_grouping_col` | VARCHAR | Grouping column |
| `in_value_col` | VARCHAR | Output measure column |
| `in_name_unpivot_col` | VARCHAR | Output unpivot column |
| `in_output_view_name` | VARCHAR | Output pivot view name |
| `query` | VARCHAR OUT | Returns generated VQL query |

---

## Procedure Logic

The procedure performs the following steps:

### 1. Detect Pivot Columns

The procedure scans metadata using:

```sql
GET_VIEW_COLUMNS()
```

to identify columns matching the specified prefix.

Example:

```sql
column_name LIKE 'REV_%'
```

---

### 2. Read Matching Columns Using Cursor

The cursor iterates through all matching pivot columns.

Example:

| column_name |
|---|
| REV_2021 |
| REV_2022 |
| REV_2023 |

---

### 3. Dynamically Build Unpivot Query

For every pivot column, the procedure generates:

```sql
SELECT customer_id,
CAST('2021' AS INTEGER) AS year,
REV_2021 AS revenue
FROM sales_view
WHERE REV_2021 IS NOT NULL
```

---

### 4. Create Final Unpivot View

Generated output:

```sql
CREATE OR REPLACE VIEW unpivot_sales_view AS
SELECT customer_id,
CAST('2021' AS INTEGER) AS year,
REV_2021 AS revenue
FROM sales_view
WHERE REV_2021 IS NOT NULL
UNION ALL
SELECT customer_id,
CAST('2022' AS INTEGER) AS year,
REV_2022 AS revenue
FROM sales_view
WHERE REV_2022 IS NOT NULL
```

---



## Example Usage

### Source Data

| customer_id | REV_2021 | REV_2022 | REV_2023 |
|---|---|---|---|
| 101 | 100 | 200 | 300 |

---

### Procedure Call

```sql
CALL sp_dynamic_unpivot_procedure(
    'sales_view',
    'REV_',
    'customer_id',
    'revenue',
    'year',
    'iv_sales_view_unpivoted'
);
```
OR
```sql
SELECT query
FROM sp_dynamic_unpivot_procedure()
WHERE in_view_name    = 'sales_view'
  AND in_prefix       = 'REV_'
  AND in_grouping_col = 'customer_id'
  AND in_value_col    = 'revenue'
  AND in_name_unpivot_col  = 'year'
  AND in_output_view_name = 'iv_sales_view_unpivoted';
```

---

### Generated Output View

| customer_id | year | revenue |
|---|---|---|
| 101 | 2021 | 100 |
| 101 | 2022 | 200 |
| 101 | 2023 | 300 |

---

## Performance Considerations

This approach is suitable for:

- Dynamic normalization scenarios
- Wide-table transformations
- BI preparation workflows
- Metadata-driven transformations

Potential limitations:

- Large number of columns may generate large UNION chains
- Excessive columns may impact optimization performance

---

## Limitations

- Column names must follow a consistent prefix pattern
- Excessive UNION ALL operations may impact performance

---

## Use Cases

- Financial reporting
- Time-series normalization
- Preparing data for BI tools
- Dynamic denormalization handling
- Wide-table transformations

## 🤝 Contributing

Feel free to raise issues or submit improvements:

* Performance tuning
* Additional flexibility
* Better error handling

# 👨‍💻 Authors

**Developed and maintained by**:

- **Naveen Jeyaraj**  
  📧 njeyaraj@denodo.com

- **Ponjeevitha Thangamuthu**  
  📧 pthangamuthu@denodo.com