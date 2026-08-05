from dotenv import load_dotenv
import os
# import yaml

load_dotenv()

# AWS Config
AWS_REGION = os.getenv("AWS_REGION")
DATAZONE_DOMAIN_ID = os.getenv("DATAZONE_DOMAIN_ID")
DATAZONE_PROJECT_ID = os.getenv("DATAZONE_PROJECT_ID")

# Denodo Config
DENODO_HOST = os.getenv("DENODO_HOST")
DENODO_PORT = int(os.getenv("DENODO_PORT", 9999))
DENODO_DATABASE = os.getenv("DENODO_DATABASE")
DENODO_USER = os.getenv("DENODO_USER")
DENODO_PASSWORD = os.getenv("DENODO_PASSWORD")

# JDBC Driver
JDBC_DRIVER_PATH = os.getenv("JDBC_DRIVER_PATH", "./drivers/denodo-jdbcdriver.jar")
JDBC_DRIVER_CLASS = "com.denodo.vdp.jdbc.Driver"


# # Load asset-to-view mapping from mapping.yaml
# with open("mapping.yaml", "r") as f:
#     _mapping_config = yaml.safe_load(f)

# ASSET_VIEW_MAPPING = {
#     m["asset_name"]: {"view_name": m["view_name"], "database": m["database"]}
#     for m in _mapping_config.get("mappings", [])
# }