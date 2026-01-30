#!/bin/bash

# Set the port number
PORT=8442

# Find the PID using the specified port
PID=$(sudo ss -tulnp | grep ":$PORT " | awk '{print $NF}' | cut -d',' -f2 | cut -d'=' -f2 | head -n 1)

# If no PID is found
if [ -z "$PID" ]; then
  echo "No process found using port $PORT"
  exit 1
fi

# Kill the process
echo "Killing process with PID $PID using port $PORT"
sudo kill -9 "$PID"


