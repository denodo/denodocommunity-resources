#!/usr/bin/env bash

# ==============================================================================
# Denodo Systemd Automated Deployment Script
# ==============================================================================
# INSTRUCTIONS:
# Place the raw template files (vqlserver, vqlserver.service, denodo.properties, 
# denodo-init, etc.) in a folder named "templates" next to this script.
# ==============================================================================

# 1. Default Configuration Variables
DENODO_HOME="/opt/denodo"
DENODO_USER="denodo"
DENODO_GROUP="denodo"
TEMPLATES_DIR="./templates"

# 1.1. Help Function
show_help() {
    echo "Usage: ./setup.sh [OPTIONS]"
    echo "Automates the deployment of Denodo systemd configuration files."
    echo ""
    echo "Options:"
    echo "  -d, --dir    Set DENODO_HOME (default: /opt/denodo)"
    echo "  -u, --user   Set DENODO_USER (default: denodo)"
    echo "  -g, --group  Set DENODO_GROUP (default: denodo)"
    echo "  -h, --help   Show this help message and exit"
    echo ""
    echo "Example:"
    echo "  ./setup.sh -d /opt/denodo/Denodo/DenodoPlatform8 -u denodo -g denodo"
}

# 1.2 Parse Input Parameters
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -d|--dir) DENODO_HOME="$2"; shift ;;
        -u|--user) DENODO_USER="$2"; shift ;;
        -g|--group) DENODO_GROUP="$2"; shift ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Error: Unknown parameter: $1"; show_help; exit 1 ;;
    esac
    shift
done

echo "Starting Denodo systemd configuration deployment..."
echo "Using DENODO_HOME:  $DENODO_HOME"
echo "Using DENODO_USER:  $DENODO_USER"
echo "Using DENODO_GROUP: $DENODO_GROUP"
echo "--------------------------------------------------------"

# Verify templates directory exists
if [ ! -d "$TEMPLATES_DIR" ]; then
    echo "Error: Templates directory '$TEMPLATES_DIR' not found."
    exit 1
fi

# 2. Create necessary target directories
echo "Ensuring target directories exist..."
mkdir -p "$DENODO_HOME/bin/systemd"
mkdir -p "$DENODO_HOME/lib/sh"

# 3. Process and deploy internal control scripts
echo "Deploying shell scripts to $DENODO_HOME..."

# Deploy denodo.properties
if [ -f "$TEMPLATES_DIR/denodo.properties" ]; then
    sed -e "s|<DENODO_HOME>|$DENODO_HOME|g" \
        -e "s|<DENODO_USER>|$DENODO_USER|g" \
        "$TEMPLATES_DIR/denodo.properties" > "$DENODO_HOME/bin/systemd/denodo.properties"
fi

# Deploy denodo-init
if [ -f "$TEMPLATES_DIR/denodo-init" ]; then
    sed -e "s|<DENODO_HOME>|$DENODO_HOME|g" \
        -e "s|<DENODO_USER>|$DENODO_USER|g" \
        "$TEMPLATES_DIR/denodo-init" > "$DENODO_HOME/lib/sh/denodo-init"
    chmod +x "$DENODO_HOME/lib/sh/denodo-init"
fi

# Deploy all other bin/systemd scripts (vqlserver, schedulerserver, etc.)
for script in vqlserver schedulerserver schedulerindexserver; do
    if [ -f "$TEMPLATES_DIR/$script" ]; then
        sed -e "s|<DENODO_HOME>|$DENODO_HOME|g" \
            -e "s|<DENODO_USER>|$DENODO_USER|g" \
            "$TEMPLATES_DIR/$script" > "$DENODO_HOME/bin/systemd/$script"
        
        # Apply execute permissions
        chmod +x "$DENODO_HOME/bin/systemd/$script"
    fi
done

# 4. Process and deploy systemd .service files
echo "Deploying systemd .service files to /etc/systemd/system/..."

# Process all .service files found in the templates directory
for svc in "$TEMPLATES_DIR"/*.service; do
    if [ -f "$svc" ]; then
        svc_name=$(basename "$svc")
        
        # Use sed to replace placeholders, passing the output to sudo tee for root writing
        sed -e "s|<DENODO_HOME>|$DENODO_HOME|g" \
            -e "s|<DENODO_USER>|$DENODO_USER|g" \
            -e "s|<DENODO_USERGROUP>|$DENODO_GROUP|g" \
            "$svc" | sudo tee "/etc/systemd/system/$svc_name" > /dev/null
        
        # Apply standard systemd unit file read permissions
        sudo chmod 644 "/etc/systemd/system/$svc_name"
        echo " -> Deployed $svc_name"
    fi
done

# 5. Reload systemd daemon
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "Deployment complete!"
echo "To start the main service, run: sudo systemctl start vqlserver.service"

# LF Fix