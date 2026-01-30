# Denodo Governance Bridge for Collibra – Automation Framework

## Introduction

The **Denodo Governance Bridge for Collibra** enables seamless transfer of metadata from the Denodo Platform to Collibra. It retrieves, transforms, and upserts Denodo metadata into Collibra as assets and complex relations, ensuring alignment between the two platforms.

This automation framework eliminates manual triggers and provides a reliable, repeatable way to execute Synchronization and Technical Lineage tasks through scripts or Denodo Scheduler jobs.

## ✨ Features

- Automated Governance Bridge startup and shutdown  
- Scheduled execution of:
  - **Metadata Synchronization**
  - **Technical Lineage Generation**
- The entire flow can be acheived either theough OS-level or Denodo-Scheduler-based automation
- No manual monitoring required  
- Additional logging for troubleshooting

## 🚀 Why This Automation?

The Governance Bridge’s startup script launches its internal server asynchronously. However:

- Synchronization and Technical Lineage operations **must be triggered manually**.
- Bridge startup time varies depending on metadata volume and server load.
- This makes reliable scheduling difficult.

This automation framework solves those challenges by allowing:

- Fully automated, scheduled execution  
- Consistent metadata refresh cycles  
- End-to-end repeatable integration between Denodo and Collibra

## Prerequisites:

Before using the automation approach, ensure the following prerequisite is in place:

#### Denodo SSH Custom Wrapper

This automation framework relies on a custom SSH wrapper for Denodo to enable secure execution of OS-level scripts from the Virtual DataPort (VDP).

The SSH wrapper is required to:

* Execute Governance Bridge startup, shutdown, synchronization, and lineage scripts remotely

* Capture execution status and logs for Scheduler-driven workflows

* Integrate OS-level operations into Denodo base views

### **Two Approaches to Automation**

This framework supports **two different automation methods** — Script-Based Automation and Scheduler-Based Automation.  
Both achieve the same outcome, and you can choose the approach that best fits your environment or operational preference.

---

# 1️⃣ Script-Based Automation

This approach uses OS-level scripts (`.sh` or `.bat`) and is ideal when you want to run automation via:

- Cron  
- Windows Task Scheduler  
- External orchestrators  
- Manual execution  

---

### Prerequisite Files

Download the following files from the **Scripts** based on your OS and place them into:

```
<DENODO_GOVERNANCE_BRIDGE_HOME>/bin
```

- `shutdown_collibra.bat` / `shutdown_collibra.sh`
- `orchestrator.bat` / `orchestrator.sh`

### Configure the Orchestrator Script

1. Open `orchestrator.bat` or `orchestrator.sh` in a text editor.
2. Set the following variable:

```bash
BIN_DIR="<DENODO_GOVERNANCE_BRIDGE_HOME>"
```

Save the file — script setup is complete.


---

### How It Works

**`orchestrator.bat` / `orchestrator.sh`**  
This script acts as the “conductor” of the automation workflow, coordinating each stage in a controlled, reliable sequence. Its responsibilities include:

1. **Launching the Denodo Governance Bridge server** and generating a `governance_bridge.log` file, capturing all console output for easy diagnostics.
2. **Triggering the Metadata Synchronization and Technical Lineage generation scripts**, ensuring both operations run in the correct order.
3. **Applying intelligent error handling** — if Synchronization fails, the script automatically skips Technical Lineage generation. This prevents cascading failures and ensures clean, predictable executions.

---

## Usage Guide (Script Execution)

You can:

- Run the script manually:

```bash
orchestrator.sh
```

or

```cmd
orchestrator.bat
```

- Schedule using:
  - Windows Task Scheduler  
  - Cron  
  - External scheduling tools

A new log file is generated per run:

```
governance_bridge.log
```

This file contains Governance Bridge output and helps with debugging.  

**Note** It is overwritten on every execution.

---

# 2️⃣ Scheduler-Based Automation

This approach uses Denodo-native components:

- VDP base views  
- SSH data source  
- Scheduler jobs  

Perfect for environments that prefer centralised Denodo automation.

---

## Setup

### A. Configure the Virtual DataPort (VDP) Server

1. Download `automate_collibra_gov_bridge.vql` from the **VQL** repository.  
2. Open **Design Studio → File → Import** and import the VQL (password: `admin`).  
3. Navigate to:

```
automate_collibra_gov_bridge VDB
   → 1.data sources 
       → ds_ssh_connector
```

4. Update the following:
   - **Username & Password** → OS user with permissions to run Governance Bridge scripts  
   - **Hostname** → Server running the bridge  
   - **SSH Port** → Use custom port if not 22  

5. Save changes.

### Update Base Views

For each view:

- `bv_start_governance_bridge`
- `bv_stop_governance_bridge`
- `bv_sync_governance_bridge`
- `bv_tech_lineage_governance_bridge`

Perform:

1. Open the view  
2. Go to **Edit → Source Refresh**  
3. Update the script file paths to match your server’s Governance Bridge directory  
4. Save

---

### B. Configure the Scheduler Server

1. Download `scheduler_export.zip` from the **Scheduler export** repository.
2. Import it into the **Scheduler Admin Tool** (password: `admin`)  
3. Go to:

```
Data Sources → VDP_automate_governance_bridge_collibra
```

4. Update the host and port to point to the VDP server that contains the imported VQL.

## How It Works


### VDP Elements

#### **Data Source**
- **`ds_ssh_connector`**  
  A custom SSH data source that acts as the link between Denodo VDP and the operating system hosting your Governance Bridge scripts. It enables secure remote execution directly from VDP.

#### **Base Views**
Each base view wraps a script operation, allowing the Scheduler to trigger automation with precision:

1. **`bv_start_governance_bridge`** – Starts the Governance Bridge server  
2. **`bv_stop_governance_bridge`** – Stops the Governance Bridge server  
3. **`bv_sync_governance_bridge`** – Executes the **Metadata Synchronization** script  
4. **`bv_tech_lineage_governance_bridge`** – Executes the **Technical Lineage** generation script  

Together, these views transform OS-level script execution into Denodo-native operations.

---

### Scheduler Elements



#### **Data Source**
- **`VDP_automate_governance_bridge_collibra`**  
  This data source connects the Denodo Scheduler to the VDP server that houses the base views, making automated execution fully orchestratable.

#### **Jobs**
Each job focuses on a single operation, making the workflow modular, readable, and easy to maintain:

1. **`start_governance_bridge`** — Executes `bv_start_governance_bridge`  
2. **`stop_governance_bridge`** — Executes `bv_stop_governance_bridge`  
3. **`synchronize_governance_bridge`** — Executes `bv_sync_governance_bridge`  
4. **`generate_technical_lineage`** — Executes `bv_tech_lineage_governance_bridge`  

Chained together, these jobs form a complete automation pipeline:  
**start → synchronize → generate lineage → stop**.

This modular yet coordinated structure ensures that every execution follows a predictable, repeatable, and fault-tolerant lifecycle.

---


## Usage Guide (Scheduler Execution)

1. Open the **Scheduler Admin Tool**  
2. Start the:
   - `start_governance_bridge` job  
   - `stop_governance_bridge` job  with dependencies (dependencies are already marked in the job export which you imported in the previous step)  
3. Optionally, set custom scheduling intervals

This enables a **fully automated, hands-off workflow**.

---


## Collibra governance bridge automation License

This project is distributed under **Apache License, Version 2.0**. 

See [LICENSE](LICENSE)

## Collibra governance bridge automation Support

This project is supported by **Denodo Community**. 

See [SUPPORT](SUPPORT.md)

## Authors

- Developed by: Dineshraja Annadurai, Parvatha Vardhini Sivasubramanian
- Contact: dannadurai@denodo.com, psivasubramanian@denodo.com