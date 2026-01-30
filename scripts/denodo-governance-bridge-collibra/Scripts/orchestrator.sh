#!/bin/bash

echo "Starting batch orchestrator..."

BIN_DIR="/root/dineshraja/denodo-governance-bridge-8.0-20250804/denodo-collibra-governance-bridge-20250804/bin"

echo "Launching governance bridge in background..."
cd "$BIN_DIR" || { echo "Failed to enter $BIN_DIR"; exit 1; }

# Start bridge in background (similar to start /b)
nohup ./denodo-collibra-governance-bridge.sh > governance_bridge.log 2>&1 &

# Wait 10 seconds for it to start
sleep 10
echo "Starting sync + TL flow..."

# ---- Run sync and capture HTTP response ----
HTTP_CODE_B2=$(./denodo-collibra-synchronize-governance-bridge.sh input-sync.json 2>/dev/null | grep -m1 "^HTTP/1.1" | awk '{print $2}')

if [ "$HTTP_CODE_B2" = "200" ]; then
    echo "Sync complete."
else
    echo "Sync failed. Killing 8442..."
    bash shutdown_collibra.sh
    echo "Exiting orchestrator."
    exit 1
fi

# ---- Run technical lineage and capture HTTP response ----
HTTP_CODE_B3=$(./denodo-collibra-generate-technical-lineage-governance-bridge.sh input-tl.json 2>/dev/null | grep -m1 "^HTTP/1.1" | awk '{print $2}')

if [ "$HTTP_CODE_B3" = "200" ]; then
    echo "Technical Lineage completed."
else
    echo "Technical Lineage failed."
	bash shutdown_collibra.sh
    echo "Exiting orchestrator."
    exit 1
fi

# ---- Kill bridge process ----
bash shutdown_collibra.sh

echo "Complete."

