# SageMaker Catalog Denodo Metadata Sync

Bidirectional sync of business metadata between **Amazon SageMaker Catalog** (via the Amazon DataZone APIs) and **Denodo Virtual DataPort (VDP)**.

Descriptions, column descriptions, and glossary terms curated in one catalog are propagated to the other, so both systems describe the same data the same way.

**Full documentation, setup instructions, and architecture details are available here: [link]**

---

## Requirements

- Python 3.9+
- Java 17, with `JAVA_HOME` set
- AWS CLI configured with credentials that have DataZone permissions
- A running Denodo VDP instance, reachable on its JDBC port (default `9999`)
- The Denodo JDBC driver `.jar` 

---

## Setup

**1. Clone and install dependencies**

```bash
git clone https://github.com/denodo/denodocommunity-resources.git 
cd denodocommunity-resources/templates/sagemaker-catalog-denodo-integration

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

**2. Add the Denodo JDBC driver**

Download the `.jar` matching your Denodo version from the Denodo JDBC driver download page and place it in the `drivers/` folder

**3. Configure**

```bash
copy .env.example .env
```

Fill in your own values:

| Variable | Description |
|---|---|
| `AWS_REGION` | AWS region your DataZone domain resides, e.g. `us-east-1` |
| `DATAZONE_DOMAIN_ID` | Your DataZone Domain ID |
| `DATAZONE_PROJECT_ID` | Your DataZone Project ID |
| `DENODO_HOST` | Hostname or IP of your Denodo VDP Server |
| `DENODO_PORT` | VDP JDBC port (default `9999`) |
| `DENODO_DATABASE` | Denodo database containing the views to sync |
| `DENODO_USER` | Denodo admin (or service) username |
| `DENODO_PASSWORD` | Denodo admin (or service) password |
| `JDBC_DRIVER_PATH` | Relative path to the driver `.jar` |

---

## Usage

**Forward sync — SageMaker Catalog to Denodo**

```bash
python main.py
```

**Reverse sync — Denodo to SageMaker Catalog**

```bash
python reverse_main.py
```

Both are on-demand batch operations. Changes propagate only when the command is run. If the same field is edited on both sides between runs, whichever direction runs last wins.

---

## Project structure

```
.
├── main.py
├── reverse_main.py
├── requirements.txt
├── .env.example
├── drivers/ 
└── src/
    ├── config/settings.py
    ├── fetcher/datazone_fetcher.py
    ├── mapper/metadata_mapper.py 
    ├── reader/denodo_reader.py 
    └── writer/
        ├── denodo_writer.py
        └── datazone_writer.py
```