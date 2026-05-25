#!/bin/bash
# ==========================================================
# Presto Storage Connectivity Validation (Hive & Iceberg)
# With explicit error handling and guidance
# ==========================================================


# ----------------------------------------------------------
# Arguments
#   $1 = Validation mode (1 = Hive, 2 = Iceberg, 3 = Both)
#   $2 = Base storage path (bucket or container URL)
# ----------------------------------------------------------

VALIDATION_MODE="$1"
BASE_LOCATION="$2"

# ----------------------------
# INTERNALS
# ----------------------------
PRESTO_CMD="/opt/presto-cli/presto --execute"
EXIT_CODE=0

# ----------------------------------------------------------
# Choose validation mode:
# 1 = Hive only
# 2 = Iceberg only
# 3 = Hive + Iceberg
# ----------------------------------------------------------

if [[ -z "$VALIDATION_MODE" || -z "$BASE_LOCATION" ]]; then
  echo "Usage: $0 {1|2|3} <base-storage-url>"
  echo
  echo "Examples:"
  echo "  Hive only:     $0 1 s3a://my-bucket"
  echo "  Iceberg only:  $0 2 gs://my-gcs-bucket"
  echo "  Both:          $0 3 abfss://data@acct.dfs.core.windows.net"
  echo
  exit 1
fi

# ----------------------------------------------------------
# Build validation paths automatically
# ----------------------------------------------------------

# Ensure no trailing slash in base
BASE_LOCATION="${BASE_LOCATION%/}"

HIVE_LOCATION="$BASE_LOCATION/hive-validation/"
ICEBERG_LOCATION="$BASE_LOCATION/iceberg-validation/"

CATALOG_HIVE="hive"
CATALOG_ICEBERG="iceberg"

# Generate random schema suffix (1–1000 or use timestamp)
RAND=$((RANDOM % 1000))
SCHEMA_NAME="validation${RAND}"

echo "=================================================="
echo "Validation Mode  : $VALIDATION_MODE"
echo "Base Location    : $BASE_LOCATION"
echo "Hive Location    : $HIVE_LOCATION"
echo "Iceberg Location : $ICEBERG_LOCATION"
echo "=================================================="
echo

# ----------------------------
# Helper: run query with error handling
# ----------------------------
run_check() {
  local STEP_NAME="$1"
  local QUERY="$2"
  local FAIL_MSG="$3"

  echo "--------------------------------------------------"
  echo "▶ $STEP_NAME"
  echo "--------------------------------------------------"

  OUTPUT=$($PRESTO_CMD "$QUERY" 2>&1)
  RC=$?

  if [ $RC -ne 0 ]; then
    echo "❌ FAILED: $STEP_NAME"
    echo "🔎 Error:"
    echo "$OUTPUT"
    echo
    echo "👉 ACTION:"
    echo "$FAIL_MSG"
    echo
    EXIT_CODE=1
    return 1
  else
    echo "✅ SUCCESS: $STEP_NAME"
    return 0
  fi
}

# ==========================================================
# 1) BASIC SANITY CHECK
# ==========================================================

run_check \
  "Check Presto is reachable" \
  "SHOW CATALOGS;" \
  "Check Presto coordinator is running and presto-cli is configured correctly."

# ==========================================================
# ICEBERG – 
# ==========================================================

run_hive_checks() {

  run_check \
    "Hive: Check Metastore connectivity" \
    "SHOW SCHEMAS FROM hive;" \
    "Check Hive Metastore service and network."

  run_check \
    "Hive: Create schema" \
    "CREATE SCHEMA hive.${SCHEMA_NAME} WITH (location = '$HIVE_LOCATION');" \
    "Check storage credentials and LIST/PUT permissions."

  run_check \
    "Hive: Create table" \
    "CREATE TABLE hive.${SCHEMA_NAME}.hive_test (id INT)
     WITH (format='PARQUET', external_location='$HIVE_LOCATION');" \
    "Ensure schema directory exists."

  run_check \
    "Hive: Insert data" \
    "INSERT INTO hive.${SCHEMA_NAME}.hive_test VALUES (1);" \
    "Check storage write permissions."

  run_check \
    "Hive: Read data" \
    "SELECT * FROM hive.${SCHEMA_NAME}.hive_test;" \
    "Check storage read permissions."

  run_check \
    "Hive: Drop table" \
    "DROP TABLE hive.${SCHEMA_NAME}.hive_test;" \
    "Check Hive Metastore DB health."

  run_check \
  "Hive: Drop Schema" \
  "DROP SCHEMA hive.${SCHEMA_NAME};" \
  "Check Hive Metastore DB health."  
}


# ==========================================================
# ICEBERG – 
# ==========================================================
run_iceberg_checks() {

  run_check \
    "Iceberg: Check catalog connectivity" \
    "SHOW SCHEMAS FROM iceberg;" \
    "Check Iceberg catalog configuration."

  run_check \
    "Iceberg: Create schema" \
    "CREATE SCHEMA iceberg.${SCHEMA_NAME} WITH (location = '$ICEBERG_LOCATION');" \
    "Check Iceberg warehouse path and storage permissions."

  run_check \
    "Iceberg: Create table" \
    "CREATE TABLE iceberg.${SCHEMA_NAME}.iceberg_test (id INT, msg VARCHAR);" \
    "Check Iceberg metastore configuration."

  run_check \
    "Iceberg: Insert data" \
    "INSERT INTO iceberg.${SCHEMA_NAME}.iceberg_test VALUES (1, 'ok');" \
    "Check storage write permissions."

  run_check \
    "Iceberg: Read data" \
    "SELECT * FROM iceberg.${SCHEMA_NAME}.iceberg_test;" \
    "Check storage read permissions."

  run_check \
    "Iceberg: Drop table" \
    "DROP TABLE iceberg.${SCHEMA_NAME}.iceberg_test;" \
    "Check Iceberg metadata cleanup."

  run_check \
  "Hive: Drop Schema" \
  "DROP SCHEMA iceberg.${SCHEMA_NAME};" \
  "Check Hive Metastore DB health."  

}


# ==========================================================
# Presto to Denodo 
# ==========================================================

run_presto_to_denodo_check() {

  run_check \
    "Presto to Denodo Connectivity" \
    "SHOW SCHEMAS FROM denodo;" \
    "Check Denodo service and network."
}    

case "$VALIDATION_MODE" in
  1)
    # echo "▶ Running HIVE, Denodo validation only"
    run_hive_checks
    run_presto_to_denodo_check
    ;;
  2)
    # echo "▶ Running ICEBERG, Denodo validation only"
    run_iceberg_checks
    run_presto_to_denodo_check
    ;;
  3)
    # echo "▶ Running HIVE + ICEBERG, Denodo validation"
    run_hive_checks
    run_iceberg_checks
    run_presto_to_denodo_check
    ;;
  *)
    echo "❌ Invalid option: $VALIDATION_MODE"
    echo "Use:"
    echo "  1 = Hive only"
    echo "  2 = Iceberg only"
    echo "  3 = Hive + Iceberg"
    exit 1
    ;;
esac


# ==========================================================
# FINAL RESULT
# ==========================================================

echo "=================================================="
if [ $EXIT_CODE -eq 0 ]; then
  echo "🎉 ALL CHECKS PASSED"
  echo "✔ Presto ↔ Metastore ↔ Storage connectivity is VALID"
  echo "✔ Presto ↔ Denodo connectivity is VALID"
else
  echo "❌ VALIDATION FAILED"
  echo "⚠ Review the ACTION messages above to fix the issue"
fi
echo "=================================================="

exit $EXIT_CODE