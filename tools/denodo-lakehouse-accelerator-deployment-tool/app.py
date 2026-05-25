from flask import Flask, render_template, request, jsonify, Response, stream_with_context, session
from flask_socketio import SocketIO
from kubernetes import client
from kubernetes.config.kube_config import KubeConfigLoader
import os, yaml, json, subprocess, threading, time, logging
from datetime import datetime, timezone
from pathlib import Path
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

APP_PORT_NUMBER = 7090
CRED_SECRET_NAME = "mpp-credentials"

# ─── Cluster Context Manager ───────────────────────────────────────────────────
_active_context: str | None = None
_k8s_client_cache: dict     = {}
_kubeconfig_path: str       = os.path.expanduser(os.environ.get("KUBECONFIG", "~/.kube/config"))
K8S_CONNECT_TIMEOUT         = 5


def _read_kubeconfig_raw() -> dict:
    try:
        with open(_kubeconfig_path, "r") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}


def list_kubeconfig_contexts() -> list[dict]:
    raw      = _read_kubeconfig_raw()
    current  = raw.get("current-context", "")
    contexts = []
    for c in raw.get("contexts", []):
        name    = c.get("name", "")
        cluster = (c.get("context") or {}).get("cluster", "")
        ns      = (c.get("context") or {}).get("namespace", "default")
        contexts.append({"name": name, "cluster": cluster, "namespace": ns,
                         "current": name == current})
    return contexts


def _build_k8s_client(context_name: str) -> client.CoreV1Api:
    cfg = client.Configuration()
    loader = KubeConfigLoader(config_dict=_read_kubeconfig_raw(),
                              active_context=context_name)
    loader.load_and_set(cfg)
    cfg.verify_ssl = False
    api_client = client.ApiClient(cfg)
    return client.CoreV1Api(api_client)


def probe_cluster(context_name: str, timeout: int = K8S_CONNECT_TIMEOUT) -> tuple[bool, str]:
    result = {"ok": False, "msg": "timeout"}

    def _try():
        try:
            v1_tmp = _build_k8s_client(context_name)
            v1_tmp.list_namespace(_request_timeout=timeout)
            result["ok"]  = True
            result["msg"] = "reachable"
        except Exception as e:
            result["msg"] = str(e)

    t = threading.Thread(target=_try, daemon=True)
    t.start()
    t.join(timeout=timeout + 1)
    return result["ok"], result["msg"]


def _get_v1() -> client.CoreV1Api | None:
    if not _active_context:
        return None
    if _active_context not in _k8s_client_cache:
        try:
            _k8s_client_cache[_active_context] = _build_k8s_client(_active_context)
        except Exception as e:
            log.warning("Could not build k8s client: %s", e)
            return None
    return _k8s_client_cache[_active_context]


def _safe_list_namespaces() -> list[str]:
    try:
        v1 = _get_v1()
        if not v1:
            return []
        return [item.metadata.name for item in v1.list_namespace(_request_timeout=5).items]
    except Exception:
        return []


def _delete_secret_if_exists(namespace: str, name: str):
    try:
        v1 = _get_v1()
        if v1:
            v1.delete_namespaced_secret(name=name, namespace=namespace)
    except Exception:
        pass


def _create_s3_secret(namespace, access_key_id, secret_access_key, metastore_db_password="hive"):
    _delete_secret_if_exists(namespace, CRED_SECRET_NAME)
    secret = client.V1Secret(
        metadata=client.V1ObjectMeta(name=CRED_SECRET_NAME, namespace=namespace),
        string_data={
            "AWS_ACCESS_KEY_ID":     access_key_id,
            "AWS_SECRET_ACCESS_KEY": secret_access_key,
            "METASTORE_DB_PASSWORD": metastore_db_password,
        },
    )
    _get_v1().create_namespaced_secret(namespace=namespace, body=secret)
    log.info("Created S3 secret '%s' in namespace '%s'", CRED_SECRET_NAME, namespace)


def _create_adls_secret(namespace, storage_key, metastore_db_password="hive"):
    _delete_secret_if_exists(namespace, CRED_SECRET_NAME)
    secret = client.V1Secret(
        metadata=client.V1ObjectMeta(name=CRED_SECRET_NAME, namespace=namespace),
        string_data={
            "ABFS_STORAGE_KEY":      storage_key,
            "METASTORE_DB_PASSWORD": metastore_db_password,
        },
    )
    _get_v1().create_namespaced_secret(namespace=namespace, body=secret)
    log.info("Created ADLS secret '%s' in namespace '%s'", CRED_SECRET_NAME, namespace)


def _place_gcs_keyfile(chart_path: str, key_json_content: str) -> str:
    gcs_dir_presto = os.path.join(chart_path, "presto/secrets")
    gcs_dir_hive=os.path.join(chart_path, "hive-metastore/secrets")
    os.makedirs(gcs_dir_presto, exist_ok=True)
    key_presto_path = os.path.join(gcs_dir_presto, "gcs-key.json")
    key_hive_path=os.path.join(gcs_dir_hive, "gcs-key.json")
    with open(key_presto_path, "w") as f:
        f.write(key_json_content)
    with open(key_hive_path, "w") as f:
        f.write(key_json_content)    
    return "gcs-key.json"



def _create_gcs_secret(namespace, metastore_db_password="hive"):
    _delete_secret_if_exists(namespace, CRED_SECRET_NAME)
    secret = client.V1Secret(
        metadata=client.V1ObjectMeta(name=CRED_SECRET_NAME, namespace=namespace),
        string_data={"METASTORE_DB_PASSWORD": metastore_db_password},
    )
    _get_v1().create_namespaced_secret(namespace=namespace, body=secret)
    log.info("Created GCS secret '%s' in namespace '%s'", CRED_SECRET_NAME, namespace)


# ─── App ───────────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder='static', static_url_path='/static')
Path(app.root_path, "static").mkdir(exist_ok=True)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-me-in-production")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True

# ─── FIX 1: Use eventlet/gevent async_mode for proper WebSocket support ────────
# FIX 2: allow_unsafe_werkzeug=True prevents debug-mode reloader killing sockets
# FIX 3: logger=True + engineio_logger=True help diagnose future issues
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",      # use "eventlet" if you have eventlet installed
    logger=True,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VALIDATION_SCRIPT_LOCAL  = os.path.join(BASE_DIR, "templates", "presto_validation.sh")
VALIDATION_SCRIPT_REMOTE = "/var/presto/data/test_validation.sh"
KUBECTL_TIMEOUT = 120
DEPLOY_POD_POLL = 3

# ─── Global deploy state ───────────────────────────────────────────────────────
_deploy_state: dict = {
    "active":      False,
    "type":        None,
    "release":     None,
    "namespace":   None,
    "percent":     0,
    "done":        False,
    "error":       False,
    "final_msg":   None,
    "logs":        [],
    "pods":        [],
    "started_at":  None,
    "finished_at": None,
}
_deploy_state_lock = threading.Lock()


def _ds_update(msg=None, percent=None, pods=None, done=False, error=False, final_msg=None):
    with _deploy_state_lock:
        if percent is not None:
            _deploy_state["percent"] = max(_deploy_state["percent"], percent)
        if msg:
            _deploy_state["logs"].append(msg)
            if len(_deploy_state["logs"]) > 500:
                _deploy_state["logs"] = _deploy_state["logs"][-500:]
        if pods is not None:
            _deploy_state["pods"] = pods
        if done or error:
            _deploy_state["active"]      = False
            _deploy_state["done"]        = done
            _deploy_state["error"]       = error
            _deploy_state["final_msg"]   = final_msg
            _deploy_state["finished_at"] = datetime.now(timezone.utc).isoformat()
            _deploy_state["percent"]     = 100 if done else _deploy_state["percent"]


# ─── FIX 4: Socket.IO event handlers so client can confirm connection ──────────
@socketio.on("connect")
def on_connect():
    log.info("Socket.IO client connected: %s", request.sid)
    # FIX 5: immediately push current deploy state so a reconnecting client
    # catches up without needing a page refresh
    with _deploy_state_lock:
        state = dict(_deploy_state)
    socketio.emit("deploy_state_sync", state, to=request.sid)


@socketio.on("disconnect")
def on_disconnect():
    log.info("Socket.IO client disconnected: %s", request.sid)


@socketio.on("request_state_sync")
def on_request_state_sync():
    """Client can request a full state push at any time (e.g. after reconnect)."""
    with _deploy_state_lock:
        state = dict(_deploy_state)
    socketio.emit("deploy_state_sync", state, to=request.sid)


# ─── Helm Utilities ────────────────────────────────────────────────────────────

def _list_helm_releases():
    try:
        result = subprocess.run(
            ["helm", "list", "--all-namespaces", "--output", "json"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            return []
        releases = json.loads(result.stdout or "[]")
        return [(r["name"], r["namespace"]) for r in releases]
    except Exception as e:
        log.error("_list_helm_releases failed: %s", e)
        return []


def compute_age(timestamp_str):
    try:
        created = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        delta   = datetime.now(timezone.utc) - created
        s = int(delta.total_seconds())
        if s < 60:   return f"{s}s"
        if s < 3600: return f"{s//60}m"
        return f"{s//3600}h"
    except Exception:
        return "?"


def get_pods_by_label(label, namespace):
    cmd = ["kubectl", "get", "pods", "-l", label]
    if namespace:
        cmd += ["-n", namespace]
    else:
        cmd += ["--all-namespaces"]
    cmd += ["-o", "json"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return []
    data = json.loads(result.stdout)
    pods = []
    for item in data["items"]:
        pod_labels           = item["metadata"].get("labels", {})
        spec                 = item.get("spec", {})
        regular_containers   = [c["name"] for c in spec.get("containers", [])]
        init_containers      = [c["name"] for c in spec.get("initContainers", [])]
        ephemeral_containers = [c["name"] for c in spec.get("ephemeralContainers", [])]
        all_containers       = regular_containers + init_containers + ephemeral_containers
        pods.append({
            "ns":                   item["metadata"]["namespace"],
            "name":                 item["metadata"]["name"],
            "status":               item["status"].get("phase", "Unknown").lower(),
            "age":                  compute_age(item["metadata"]["creationTimestamp"]),
            "containers":           all_containers,
            "initContainers":       init_containers,
            "ephemeralContainers":  ephemeral_containers,
            "release":              pod_labels.get("app.kubernetes.io/part-of",
                                    pod_labels.get("release", "")),
        })
    return pods


def get_pods_by_release(release: str, namespace: str):
    """
    Get pods that belong to a specific Helm release by label selector.
    Uses app.kubernetes.io/part-of=<release> OR release=<release> labels.
    Falls back to namespace listing if labels not found.
    """
    label_selector = f"app.kubernetes.io/part-of={release}"
    cmd = ["kubectl", "get", "pods", "-l", label_selector, "-n", namespace, "-o", "json"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    pods = []
    if result.returncode == 0:
        data = json.loads(result.stdout or "{}")
        pods = data.get("items", [])
    # Fallback: try release= label
    if not pods:
        label_selector2 = f"release={release}"
        cmd2 = ["kubectl", "get", "pods", "-l", label_selector2, "-n", namespace, "-o", "json"]
        result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=15)
        if result2.returncode == 0:
            data2 = json.loads(result2.stdout or "{}")
            pods  = data2.get("items", [])
    return pods

def _serialize_release_pods(raw_pods: list[dict]) -> list[dict]:
    pods = []
    for item in raw_pods or []:
        meta   = item.get("metadata", {})
        spec   = item.get("spec", {})
        status = item.get("status", {})
        labels = meta.get("labels", {})

        regular_containers   = [c.get("name", "") for c in spec.get("containers", [])]
        init_containers      = [c.get("name", "") for c in spec.get("initContainers", [])]
        ephemeral_containers = [c.get("name", "") for c in spec.get("ephemeralContainers", [])]
        all_containers       = regular_containers + init_containers + ephemeral_containers

        pods.append({
            "ns": meta.get("namespace", ""),
            "name": meta.get("name", ""),
            "status": status.get("phase", "Unknown").lower(),
            "age": compute_age(meta.get("creationTimestamp", "")),
            "containers": all_containers,
            "initContainers": init_containers,
            "ephemeralContainers": ephemeral_containers,
            "restartCount": sum(
                (cs.get("restartCount") or 0)
                for cs in (status.get("containerStatuses") or [])
            ),
            "release": labels.get(
                "app.kubernetes.io/part-of",
                labels.get("release", "")
            ),
        })
    return pods



def _get_presto_coordinator(release):
    cmd_base = [
        "kubectl", "get", "pods",
        "-l", f"app.kubernetes.io/part-of={release},app=presto-coordinator",
        "--all-namespaces",
    ]
    pod_result = subprocess.run(
        cmd_base + ["-o", "jsonpath={.items[0].metadata.name}"],
        capture_output=True, text=True, timeout=30,
    )
    ns_result = subprocess.run(
        cmd_base + ["-o", "jsonpath={.items[0].metadata.namespace}"],
        capture_output=True, text=True, timeout=30,
    )
    pod_name  = pod_result.stdout.strip()
    namespace = ns_result.stdout.strip()
    if not pod_name or not namespace:
        raise RuntimeError(
            f"Could not find presto-coordinator pod for release '{release}'. "
            f"kubectl stderr: {pod_result.stderr or ns_result.stderr}"
        )
    return pod_name, namespace


def _run_validation(s3_path, release, namespace_found, validation_mode):
    pod_name, namespace = _get_presto_coordinator(release)
    script_dir = Path(__file__).parent / "templates"
    cp_result = subprocess.run(
        ["kubectl", "cp", "-n", namespace,
         "./templates/presto_validation.sh",
         f"{pod_name}:{VALIDATION_SCRIPT_REMOTE}"],
        capture_output=True, text=True, timeout=60,
    )
    if cp_result.returncode != 0:
        raise RuntimeError(f"kubectl cp failed: {cp_result.stderr}")
    result = subprocess.run(
        ["kubectl", "exec", "-n", namespace, pod_name, "--",
         "/bin/bash", "-c",
         f"chmod 755 {VALIDATION_SCRIPT_REMOTE} && "
         f"{VALIDATION_SCRIPT_REMOTE} {validation_mode} {s3_path}"],
        capture_output=True, text=True, encoding="utf-8", timeout=300,
    )
    return result


# ─── Session helpers ───────────────────────────────────────────────────────────

@app.route("/api/session/save", methods=["POST"])
def api_session_save():
    """
    Save arbitrary key/value data to the server-side session.
    The UI calls this after every meaningful input change so state
    survives page navigation within the same browser session.
    Body: { key: str, value: any }
    """
    data  = request.get_json() or {}
    key   = data.get("key", "")
    value = data.get("value")
    if not key:
        return jsonify(success=False, message="key required"), 400
    session[key] = value
    return jsonify(success=True)


@app.route("/api/session/load", methods=["GET"])
def api_session_load():
    """Return the full session dict so the UI can restore state on page load."""
    return jsonify(success=True, data=dict(session))


@app.route("/api/session/clear", methods=["POST"])
def api_session_clear():
    """Wipe the session (used on fresh deploy or explicit reset)."""
    session.clear()
    return jsonify(success=True)


# ─── Values YAML upload / preview ─────────────────────────────────────────────

@app.route("/api/values/upload", methods=["POST"])
def api_values_upload():
    """
    Accept a multipart values.yaml upload.
    Returns the parsed YAML as JSON so the UI can display it in the preview editor.
    Also stores the raw YAML text in the session for later use.
    """
    f = request.files.get("values_file")
    if not f:
        return jsonify(success=False, message="No file uploaded"), 400
    try:
        raw    = f.read().decode("utf-8")
        values = yaml.safe_load(raw)
        # Store in session
        session["uploaded_values_yaml"] = raw
        session["uploaded_values_dict"] = json.dumps(values)
        return jsonify(success=True, values=values, raw=raw)
    except Exception as e:
        return jsonify(success=False, message=f"Failed to parse YAML: {e}"), 400


def _build_values_from_data(data: dict) -> tuple[dict, str | None]:
    """
    Pure value-builder shared by the preview and deploy paths.

    Accepts a flat dict of form fields (string values, as submitted by the UI)
    and returns (values_dict, error_message).  On success error_message
    is None; on failure values_dict is None.

    Deliberately does NOT create Kubernetes secrets, write files, or deploy —
    those side-effects belong exclusively in index().
    """
    chart_path         = data.get("chart_path", "").strip()
    num_workers        = data.get("num_workers", 4)
    cpus_per_node      = data.get("cpus_per_node", 4)
    memory_per_node    = data.get("memory_per_node", 8)
    storage_type       = data.get("storage_type", "s3")
    s3_endpoint        = data.get("s3_endpoint", "")
    gcs_key_json       = data.get("gcs_key_json", "")
    adls_storage_name  = data.get("adls_storage_name", "")
    selected_cats      = data.get("catalogs", [])
    enabled_cats       = set(selected_cats)
    postgres           = data.get("pg_internal", "true")
    pg_storage_class   = data.get("pg_storage_class", "").strip()
    embedded_metastore = str(data.get("embedded_metastore", "true")).lower() != "false"
    ext_db_type        = data.get("ext_db_type", "postgresql").strip().lower()
    meta_url           = data.get("metastore_url", "").strip()
    meta_db            = data.get("metastore_db", "").strip()
    meta_schema        = data.get("metastore_schema", "").strip()
    meta_user          = data.get("metastore_username", "").strip()
    meta_pw_int        = data.get("meta_password_internal", "").strip()
    meta_pw_ext        = data.get("metastore_password", "").strip()
    denodo_url         = data.get("denodo_url", "")
    denodo_user        = data.get("denodo_username", "")
    denodo_pw          = data.get("denodo_password", "")
    denodo_role        = data.get("denodo_role", "")
    denodo_ssl         = str(data.get("velox_ssl", "false")).lower() == "true"
    velox_enabled      = str(data.get("velox_enabled", "false")).lower() == "true"
    harbor_enabled     = str(data.get("harbor_enabled", "false")).lower() == "true"
    harbor_secret_name = str(data.get("harbor_secret_name", "registry-secret")).strip()
    harbor_registry    = str(data.get("harbor_registry", "harbor.open.denodo.com")).strip()
    harbor_username    = str(data.get("harbor_username", "")).strip()
    harbor_password    = str(data.get("harbor_password", "")).strip()

# uploaded_values takes priority if the user toggled "upload YAML" mode
    uploaded_raw = data.get("uploaded_values_raw", "") or session.get("uploaded_values_yaml", "")

    app.logger.info(f"selected_catalogs {selected_cats}")
    app.logger.info(f"enabled_cats {enabled_cats}")

    # ── Load base values ──────────────────────────────────────────────────────
    if uploaded_raw:
        try:
            values = yaml.safe_load(uploaded_raw)
        except Exception as e:
            return None, f"Uploaded YAML parse error: {e}"
    elif chart_path:
        yaml_path = os.path.join(chart_path, "values.yaml")
        if not os.path.exists(yaml_path):
            return None, f"values.yaml not found in {chart_path}"
        with open(yaml_path) as f:
            values = yaml.safe_load(f)
    else:
        return None, "Provide chart_path or upload values.yaml"

    bool_postgres = str(postgres).lower() == "true"
    is_s3_compat  = storage_type == "s3_compatible"
    is_s3_type    = storage_type in ("s3", "s3_compatible")
    is_adls       = storage_type == "adls"
    is_gcs        = storage_type == "gcs"

    # ── Presto ────────────────────────────────────────────────────────────────
    values.setdefault("presto", {})
    values["presto"]["numWorkers"]    = int(num_workers)
    values["presto"]["cpusPerNode"]   = cpus_per_node
    values["presto"]["memoryPerNode"] = memory_per_node

    if "prestoOnVelox" in values.get("presto", {}):
        values["presto"]["prestoOnVelox"]["enabled"] = bool(velox_enabled)
    elif velox_enabled:
        values["presto"]["prestoOnVelox"] = {"enabled": True}

    # ── Object storage ────────────────────────────────────────────────────────
    values.setdefault("objectStorage", {
        "aws":   {"securityCredentials": {"enabled": False}},
        "azure": {"managedIdentities":        {"enabled": False},
                  "oauth2ClientCredentials":   {"enabled": False},
                  "sharedKey": {"enabled": False, "account": "", "blobStorage": False}},
    })
    values["objectStorage"]["aws"]["securityCredentials"]["enabled"] = is_s3_type
    values["objectStorage"]["azure"]["sharedKey"]["enabled"]         = is_adls
    values["objectStorage"]["azure"]["sharedKey"]["account"]         = adls_storage_name
    if is_adls:
        values["objectStorage"]["azure"]["managedIdentities"]["enabled"]      = False
        values["objectStorage"]["azure"]["oauth2ClientCredentials"]["enabled"] = False

    # ── Catalogs ──────────────────────────────────────────────────────────────
    for cat_name in ("hive", "iceberg", "delta"):
        values["presto"].setdefault(cat_name, {})
        cat_enabled = cat_name in enabled_cats
        values["presto"][cat_name]["enabled"] = cat_enabled
        if cat_enabled:
            # Only apply storage-specific settings to catalogs that are actually enabled
            values["presto"][cat_name]["s3PathStyleAccess"] = is_s3_compat
            if cat_name != "hive":                                          # by ram
                values["presto"]["hive"]["s3PathStyleAccess"] = is_s3_compat
            values["presto"][cat_name]["s3Endpoint"] = s3_endpoint if is_s3_compat else ""
            if cat_name != "hive":                                          # by ram
                values["presto"]["hive"]["s3Endpoint"] = s3_endpoint
            if is_gcs and gcs_key_json:
                values["presto"][cat_name]["gcsKeyFile"] = "gcs-key.json"
            else:
                values["presto"][cat_name]["gcsKeyFile"] = ""
        else:
            # Clear storage props for disabled catalogs so they don't get stale values
            values["presto"][cat_name]["s3PathStyleAccess"] = False
            values["presto"][cat_name]["s3Endpoint"]        = ""
            values["presto"][cat_name]["gcsKeyFile"]        = ""

    # ── Metastore ─────────────────────────────────────────────────────────────
    _DRIVER_MAP = {
        "postgresql": "org.postgresql.Driver",
        "mysql":      "org.mariadb.jdbc.Driver",
        "sqlserver":  "com.microsoft.sqlserver.jdbc.SQLServerDriver",
        "oracle":     "oracle.jdbc.OracleDriver",
    }
    effective_pw = (meta_pw_int or "hive") if bool_postgres else (meta_pw_ext or "hive")

    # PostgreSQL + Metastore
    values.setdefault("postgresql", {})["enabled"] = bool_postgres
    values.setdefault("metastore",  {})["enabled"] = embedded_metastore
    if not embedded_metastore:
        # Embedded Metastore disabled — disable postgresql too
        values["postgresql"]["enabled"] = False
    elif bool_postgres:
        values["metastore"]["connectionPassword"] = effective_pw
        values["postgresql"].setdefault("pvClaim", {})["storageClassName"] = pg_storage_class
    else:
        if meta_url:    values["metastore"]["connectionUrl"]          = meta_url
        if meta_db:     values["metastore"]["connectionDatabase"]     = meta_db
        if meta_schema: values["metastore"]["connectionSchema"]       = meta_schema
        if meta_user:   values["metastore"]["connectionUser"]         = meta_user
        values["metastore"]["connectionPassword"]   = effective_pw
        values["metastore"]["connectionDriverName"] = _DRIVER_MAP.get(ext_db_type, "org.postgresql.Driver")

    # ── Denodo connector ──────────────────────────────────────────────────────
    values["presto"].setdefault("denodoConnector", {})
    if denodo_url:  values["presto"]["denodoConnector"]["server"]   = denodo_url
    if denodo_user: values["presto"]["denodoConnector"]["user"]     = denodo_user
    if denodo_pw:   values["presto"]["denodoConnector"]["password"] = denodo_pw
    if denodo_role: values["presto"]["denodoConnector"]["role"]     = denodo_role
    values["presto"]["denodoConnector"]["ssl"] = denodo_ssl

    # ── Denodo on Velox connector ─────────────────────────────────────────────
    velox_arrow_host = str(data.get("velox_arrow_host", "")).strip()
    velox_arrow_port = str(data.get("velox_arrow_port", "9994")).strip()
    velox_user       = str(data.get("velox_user", "")).strip()
    velox_password   = str(data.get("velox_password", "")).strip()
    velox_ssl        = str(data.get("velox_ssl", "false")).lower() == "true"
    velox_pem_name   = str(data.get("velox_pem_name", "")).strip()

    if velox_enabled and velox_arrow_host:
        values["presto"].setdefault("denodoOnVeloxConnector", {})
        values["presto"]["denodoOnVeloxConnector"]["arrowFlightHost"] = velox_arrow_host
        values["presto"]["denodoOnVeloxConnector"]["arrowFlightPort"] = velox_arrow_port
        values["presto"]["denodoOnVeloxConnector"]["user"]            = velox_user
        values["presto"]["denodoOnVeloxConnector"]["password"]        = velox_password
        values["presto"]["denodoOnVeloxConnector"]["ssl"]             = velox_ssl
        if velox_ssl and velox_pem_name:
            values["presto"]["denodoOnVeloxConnector"]["pemCertificate"] = velox_pem_name

    # ── Harbor pull credentials ───────────────────────────────────────────────
    if "pullCredentials" in values.get("image", {}):
        values["image"]["pullCredentials"]["enabled"] = harbor_enabled
        if harbor_enabled:
            values["image"]["pullCredentials"]["name"]     = harbor_secret_name
            values["image"]["pullCredentials"]["registry"] = harbor_registry
            values["image"]["pullCredentials"]["username"] = harbor_username
            values["image"]["pullCredentials"]["pwd"]      = harbor_password
    elif harbor_enabled:
        values.setdefault("image", {})["pullCredentials"] = {
            "enabled": True, "name": harbor_secret_name,
            "registry": harbor_registry, "username": harbor_username, "pwd": harbor_password,
        }
    else:
        # explicitly disable if key exists in values.yaml
        if "pullCredentials" in values.get("image", {}):
            values["image"]["pullCredentials"]["enabled"] = False

    return values, None


@app.route("/api/values/preview", methods=["POST"])
def api_values_preview():
    """
    Build the updated values dict from the UI form (reusing _build_values_from_data)
    and return it as YAML text for the pre-deploy review modal.
    No secrets are created, no files are written, no deployment is started.
    """
    data = request.get_json() or {}
    values, err = _build_values_from_data(data)
    if err:
        return jsonify(success=False, message=err), 400

    yaml_text = yaml.dump(values, sort_keys=False, allow_unicode=True)
    # Cache the preview so the deploy endpoint can use it without regenerating
    session["preview_values_yaml"] = yaml_text
    session["preview_values_dict"] = json.dumps(values)
    return jsonify(success=True, yaml_text=yaml_text, values=values)


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/progress")
def progress_page():
    return render_template("progress.html", active_context=_active_context)


@app.route("/api/deploy/status", methods=["GET"])
def api_deploy_status():
    with _deploy_state_lock:
        state = dict(_deploy_state)
    return jsonify(success=True, state=state)


@app.route("/api/deploy/clear", methods=["POST"])
def api_deploy_clear():
    """Reset deploy state so navigating back shows a clean console."""
    with _deploy_state_lock:
        _deploy_state.update({
            "active": False, "type": None, "release": None, "namespace": None,
            "percent": 0, "done": False, "error": False, "final_msg": None,
            "logs": [], "pods": [], "started_at": None, "finished_at": None,
        })
    return jsonify(success=True)


@app.route("/testconnectivity", methods=["GET"])
def testconnectivity():
    return render_template("testconnectivity.html", active_context=_active_context)


@app.route("/log")
def log_page():
    return render_template("log.html", active_context=_active_context)


@app.route("/api/logs/stream")
def stream_logs():
    pod_name  = request.args.get("pod",       "")
    namespace = request.args.get("namespace", "default")
    container = request.args.get("container", "")
    tail      = request.args.get("tail",      "200")

    cmd = ["kubectl", "logs", pod_name, "-n", namespace, "--tail", tail, "--follow"]
    if container:
        cmd += ["-c", container]

    def generate():
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, text=True)
            for line in iter(proc.stdout.readline, ""):
                yield f"data: {json.dumps({'line': line.rstrip()})}\n\n"
            proc.wait()
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        try:
            proc.kill()
        except Exception:
            pass

    return Response(stream_with_context(generate()),
                    mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "GET":
        return render_template("index.html", namespaces=[], hr=[])
    

    # ── POST: build updated_values.yaml and start deploy ──────────────────────

    # Fields only needed for deploy side-effects (secrets, cert files, session)
    release_name     = request.form.get("release_name", "").strip()
    chart_path       = request.form.get("chart_path", "").strip()
    namespace        = request.form.get("namespace", "").strip()
    storage_type     = request.form.get("storage_type", "s3")
    aws_access_key   = request.form.get("aws_access_key_id", "") or request.form.get("aws_access_key_id_compat", "")
    aws_secret_key   = request.form.get("aws_secret_access_key", "") or request.form.get("aws_secret_access_key_compat", "")
    adls_storage_key = request.form.get("adls_storage_key", "")
    gcs_key_json     = request.form.get("gcs_key_json", "")
    postgres         = request.form.get("pg_internal", "true")
    meta_password    = request.form.get("metastore_password", "").strip()
    meta_pw_internal = request.form.get("meta_password_internal", "").strip()
    velox_pem_name   = request.form.get("velox_pem_name", "").strip()
    s3_https_cert_name = request.form.get("s3_https_cert_name", "").strip()
    edited_yaml_text = request.form.get("edited_yaml_text", "").strip()

    # ── If the user confirmed a hand-edited YAML, use it directly ─────────────
    if edited_yaml_text:
        try:
            values = yaml.safe_load(edited_yaml_text)
        except Exception as e:
            return jsonify(success=False, message=f"Invalid YAML: {e}"), 400
        if not chart_path:
            return jsonify(success=False, message="chart_path required"), 400
    else:
        # ── Normal UI mode: build values via the shared helper ─────────────────
        # request.form behaves like a dict for .get(), so pass it directly.
        # getlist("catalogs") is the only multi-value field.
        form_data = dict(request.form)
        form_data["catalogs"] = request.form.getlist("catalogs")

        values, err = _build_values_from_data(form_data)
        if err:
            return jsonify(success=False, message=err), 400

        # ── Deploy-only side-effects ───────────────────────────────────────────
        bool_postgres = postgres.lower() == "true"
        is_s3_compat  = storage_type == "s3_compatible"
        is_s3_type    = storage_type in ("s3", "s3_compatible")
        is_adls       = storage_type == "adls"
        is_gcs        = storage_type == "gcs"
        effective_meta_password = (meta_pw_internal or "hive") if bool_postgres else (meta_password or "hive")

        # Create Kubernetes credentials secret
        try:
            if is_s3_type and aws_access_key and aws_secret_key:
                _create_s3_secret(namespace, aws_access_key, aws_secret_key, effective_meta_password)
            elif is_adls and adls_storage_key:
                _create_adls_secret(namespace, adls_storage_key, effective_meta_password)
            else:
                _create_gcs_secret(namespace, effective_meta_password)
        except Exception as e:
            log.error("Failed to create storage secret: %s", e)
            return jsonify(success=False, message=f"Failed to create Kubernetes secret: {e}"), 500

        # Place GCS key file into chart directory
        if is_gcs and gcs_key_json:
            _place_gcs_keyfile(chart_path, gcs_key_json)

        # Copy Velox / Denodo SSL PEM certificate into chart directory
        cert_src = request.form.get("velox_pem_content", "")
        if cert_src and velox_pem_name:
            certs_dir = os.path.join(chart_path, "presto", "secrets", "certs")
            os.makedirs(certs_dir, exist_ok=True)
            with open(os.path.join(certs_dir, velox_pem_name), "w") as cf:
                cf.write(cert_src)

        # Copy S3-compatible HTTPS certificate into chart directory
        if is_s3_compat and s3_https_cert_name:
            s3_cert_content = request.form.get("s3_https_cert_content", "")
            if s3_cert_content:
                certs_dir = os.path.join(chart_path, "presto", "secrets", "certs")
                os.makedirs(certs_dir, exist_ok=True)
                with open(os.path.join(certs_dir, s3_https_cert_name), "w") as cf:
                    cf.write(s3_cert_content)

    # ── Write updated_values.yaml and start deploy ─────────────────────────────
    updated_yaml_path = os.path.join(chart_path, "updated_values.yaml")
    with open(updated_yaml_path, "w") as f:
        yaml.dump(values, f, sort_keys=False, allow_unicode=True)

    session["last_deploy"] = {
        "release_name":   release_name,
        "chart_path":     chart_path,
        "namespace":      namespace,
        "num_workers":    request.form.get("num_workers", 4),
        "cpus_per_node":  request.form.get("cpus_per_node", 4),
        "memory_per_node": request.form.get("memory_per_node", 8),
        "storage_type":   storage_type,
        "velox_enabled":  request.form.get("velox_enabled", "false"),
        "denodo_url":     request.form.get("denodo_url", ""),
        "denodo_username": request.form.get("denodo_username", ""),
        "denodo_role":    request.form.get("denodo_role", ""),
        "pg_internal":    postgres,
    }
    threading.Thread(
        target=_deploy_chart,
        args=(release_name, chart_path, updated_yaml_path, namespace),
        daemon=True,
    ).start()

    return jsonify(success=True, message="Deployment started.")


# ─── FIX 6: Emit helper that always uses socketio.emit correctly ───────────────
def _socketio_emit(event, payload):
    """
    Thread-safe Socket.IO emit. Background threads MUST use this wrapper
    instead of calling socketio.emit() directly, because Flask's application
    context is not available inside daemon threads with async_mode='threading'.
    """
    try:
        socketio.emit(event, payload)
    except Exception as e:
        log.warning("socketio.emit failed: %s", e)

#####################################################################
# Upgrade existing helm release
#####################################################################

def upgrade_deploy_chart(release_name, chart_path, values_file, namespace):
    """Background thread: helm upgrade + pod readiness polling."""
    with _deploy_state_lock:
        _deploy_state.update({
            "active": True, "type": "upgrade", "release": release_name,
            "namespace": namespace, "percent": 0, "done": False, "error": False,
            "final_msg": None, "logs": [], "pods": [],
            "started_at": datetime.now(timezone.utc).isoformat(), "finished_at": None,
        })

    def emit(msg=None, percent=None, pods=None):
        payload = {"op_type": "upgrade", "op_release": release_name}
        pods_serialised = None
        if msg     is not None: payload["msg"]     = msg
        if percent is not None: payload["percent"] = percent
        if pods    is not None:
            pods_serialised = [
                {
                    "name": p.metadata.name,
                    "status": p.status.phase,
                    "restartCount": sum(c.restart_count or 0 for c in (p.status.container_statuses or [])),
                    "ready": (
                        all(c.ready for c in (p.status.container_statuses or []))
                        and all((c.restart_count or 0) < 5 for c in (p.status.container_statuses or []))
                    ),
                }
                for p in pods.items
            ]
            payload["pods"] = pods_serialised
        # FIX 6: use wrapper instead of direct socketio.emit
        _socketio_emit("progress_update", payload)
        _ds_update(msg=msg, percent=percent, pods=pods_serialised)

    cmd = ["helm", "upgrade", release_name, chart_path, "-f", values_file,
           "--namespace", namespace] #removing --create-namespace by ram
    log.info("Running: %s", " ".join(cmd))
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in iter(proc.stdout.readline, ""):
        emit(line.strip(), 10)
    proc.wait()

    if proc.returncode != 0:
        final = "❌ Helm upgrade failed"
        _ds_update(error=True, final_msg=final)
        _socketio_emit("progress_done", {"message": final, "op_type": "upgrade", "op_release": release_name})
        _history_append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "upgrade", "release": release_name, "namespace": namespace,
            "success": False, "message": final,
            "started_at": _deploy_state.get("started_at"),
            "finished_at": _deploy_state.get("finished_at"),
        })
        return

    emit("📦 Helm chart upgrade. Monitoring pods…", 40)
    time.sleep(40) #by ram this is to let the helm upgrade process done and corresponding existing pods to get into the Termination state
    while True:
        try:
            raw = get_pods_by_release(release_name, namespace)
            if not raw:
                _v1 = _get_v1()
                if not _v1:
                    raise RuntimeError("Cluster not available")
                time.sleep(5)
                ns_pods   = _v1.list_namespaced_pod(namespace)
                raw_items = ns_pods.items
                total     = len(raw_items)
                ready     = sum(
                    1 for p in raw_items
                    if p.status.phase == "Running"
                    and all(c.ready for c in (p.status.container_statuses or []))
                    and all((c.restart_count or 0) < 5 for c in (p.status.container_statuses or []))
                )
                pods_serialised = [
                    {
                        "name":  p.metadata.name,
                        "status": p.status.phase,
                        "restartCount": sum(c.restart_count or 0 for c in (p.status.container_statuses or [])),
                        "ready": (
                            all(c.ready for c in (p.status.container_statuses or []))
                            and all((c.restart_count or 0) < 5 for c in (p.status.container_statuses or []))
                        ),
                    }
                    for p in raw_items
                ]
            else:
                total = len(raw)
                ready = sum(
                    1 for p in raw
                    if p["status"].get("phase", "").lower() == "running"
                    and all(cs.get("ready", False) for cs in (p["status"].get("containerStatuses") or []))
                    and all((cs.get("restartCount") or 0) < 5 for cs in (p["status"].get("containerStatuses") or []))
                )
                pods_serialised = [
                    {
                        "name": p["metadata"]["name"],
                        "status": p["status"].get("phase", "Unknown"),
                        "restartCount": sum(
                            (cs.get("restartCount") or 0) for cs in (p["status"].get("containerStatuses") or [])
                        ),
                        "ready": (
                            all(cs.get("ready", False) for cs in (p["status"].get("containerStatuses") or []))
                            and all(
                                (cs.get("restartCount") or 0) < 5
                                for cs in (p["status"].get("containerStatuses") or [])
                            )
                        ),
                    }
                    for p in raw
                ]

            percent = min(40 + int((ready / total) * 60), 99) if total else 40
            payload = {
                "op_type": "upgrade", "op_release": release_name,
                "msg": f"Pods Ready: {ready}/{total}", "percent": percent,
                "pods": pods_serialised,
            }
            time.sleep(5)
            _socketio_emit("progress_update", payload)
            _ds_update(msg=f"Pods Ready: {ready}/{total}", percent=percent, pods=pods_serialised)
            # i=0
            # while (ready == total and total > 0 and i<=3) :
            #     time.sleep(20)
            #     i=i+1
            if (ready == total and total > 0 ):
                break
        except Exception as e:
            emit(f"Error checking pods: {e}", 40)
            break
        time.sleep(DEPLOY_POD_POLL)

    final = f"✅ {release_name} deployed successfully"
    _ds_update(done=True, final_msg=final, percent=100)
    _socketio_emit("progress_done", {"message": final, "op_type": "upgrade", "op_release": release_name})
    _history_append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "upgrade", "release": release_name, "namespace": namespace,
        "success": True, "message": final,
        "started_at": _deploy_state.get("started_at"),
        "finished_at": _deploy_state.get("finished_at"),
    })

# ####################################################################

def _deploy_chart(release_name, chart_path, values_file, namespace):
    """Background thread: helm install + pod readiness polling."""
    with _deploy_state_lock:
        _deploy_state.update({
            "active": True, "type": "install", "release": release_name,
            "namespace": namespace, "percent": 0, "done": False, "error": False,
            "final_msg": None, "logs": [], "pods": [],
            "started_at": datetime.now(timezone.utc).isoformat(), "finished_at": None,
        })

    def emit(msg=None, percent=None, pods=None):
        payload = {"op_type": "install", "op_release": release_name}
        pods_serialised = None
        if msg     is not None: payload["msg"]     = msg
        if percent is not None: payload["percent"] = percent
        if pods    is not None:
            pods_serialised = [
                {
                    "name": p.metadata.name,
                    "status": p.status.phase,
                    "restartCount": sum(c.restart_count or 0 for c in (p.status.container_statuses or [])),
                    "ready": (
                        all(c.ready for c in (p.status.container_statuses or []))
                        and all((c.restart_count or 0) < 5 for c in (p.status.container_statuses or []))
                    ),
                }
                for p in pods.items
            ]
            payload["pods"] = pods_serialised
        # FIX 6: use wrapper instead of direct socketio.emit
        _socketio_emit("progress_update", payload)
        _ds_update(msg=msg, percent=percent, pods=pods_serialised)

    cmd = ["helm", "install", release_name, chart_path, "-f", values_file,
           "--namespace", namespace ] # , "--create-namespace  by ram commenting to avoid the create namespace
    log.info("Running Helm install command: %s", " ".join(cmd))
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in iter(proc.stdout.readline, ""):
        emit(line.strip(), 10)
    proc.wait()

    if proc.returncode != 0:
        final = "❌ Helm install failed"
        _ds_update(error=True, final_msg=final)
        _socketio_emit("progress_done", {"message": final, "op_type": "install", "op_release": release_name})
        _history_append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "install", "release": release_name, "namespace": namespace,
            "success": False, "message": final,
            "started_at": _deploy_state.get("started_at"),
            "finished_at": _deploy_state.get("finished_at"),
        })
        return

    emit("📦 Helm chart installed. Monitoring pods…", 40)

    while True:
        try:
            raw = get_pods_by_release(release_name, namespace)
            if not raw:
                _v1 = _get_v1()
                if not _v1:
                    raise RuntimeError("Cluster not available")
                ns_pods   = _v1.list_namespaced_pod(namespace)
                raw_items = ns_pods.items
                total     = len(raw_items)
                ready     = sum(
                    1 for p in raw_items
                    if p.status.phase == "Running"
                    and all(c.ready for c in (p.status.container_statuses or []))
                    and all((c.restart_count or 0) < 5 for c in (p.status.container_statuses or []))
                )
                pods_serialised = [
                    {
                        "name":  p.metadata.name,
                        "status": p.status.phase,
                        "restartCount": sum(c.restart_count or 0 for c in (p.status.container_statuses or [])),
                        "ready": (
                            all(c.ready for c in (p.status.container_statuses or []))
                            and all((c.restart_count or 0) < 5 for c in (p.status.container_statuses or []))
                        ),
                    }
                    for p in raw_items
                ]
            else:
                total = len(raw)
                ready = sum(
                    1 for p in raw
                    if p["status"].get("phase", "").lower() == "running"
                    and all(cs.get("ready", False) for cs in (p["status"].get("containerStatuses") or []))
                    and all((cs.get("restartCount") or 0) < 5 for cs in (p["status"].get("containerStatuses") or []))
                )
                pods_serialised = [
                    {
                        "name": p["metadata"]["name"],
                        "status": p["status"].get("phase", "Unknown"),
                        "restartCount": sum(
                            (cs.get("restartCount") or 0) for cs in (p["status"].get("containerStatuses") or [])
                        ),
                        "ready": (
                            all(cs.get("ready", False) for cs in (p["status"].get("containerStatuses") or []))
                            and all(
                                (cs.get("restartCount") or 0) < 5
                                for cs in (p["status"].get("containerStatuses") or [])
                            )
                        ),
                    }
                    for p in raw
                ]

            percent = min(40 + int((ready / total) * 60), 99) if total else 40
            payload = {
                "op_type": "install", "op_release": release_name,
                "msg": f"Pods Ready: {ready}/{total}", "percent": percent,
                "pods": pods_serialised,
            }
            _socketio_emit("progress_update", payload)
            _ds_update(msg=f"Pods Ready: {ready}/{total}", percent=percent, pods=pods_serialised)
            if ready == total and total > 0:
                break
        except Exception as e:
            emit(f"Error checking pods: {e}", 40)
            break
        time.sleep(DEPLOY_POD_POLL)

    final = f"✅ {release_name} deployed successfully"
    _ds_update(done=True, final_msg=final, percent=100)
    _socketio_emit("progress_done", {"message": final, "op_type": "install", "op_release": release_name})
    _history_append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "install", "release": release_name, "namespace": namespace,
        "success": True, "message": final,
        "started_at": _deploy_state.get("started_at"),
        "finished_at": _deploy_state.get("finished_at"),
    })


def _uninstall_chart(release, namespace):
    """Background thread: helm uninstall with release-label pod tracking."""
    with _deploy_state_lock:
        _deploy_state.update({
            "active": True, "type": "uninstall", "release": release,
            "namespace": namespace, "percent": 0, "done": False, "error": False,
            "final_msg": None, "logs": [], "pods": [],
            "started_at": datetime.now(timezone.utc).isoformat(), "finished_at": None,
        })

    def emit_pods_for_release(percent_val, msg=None):
        """Emit pod status filtered by release label."""
        raw_pods = get_pods_by_release(release, namespace)
        pods_serialised = [
            {
                "name":   p["metadata"]["name"],
                "status": p["status"].get("phase", "Unknown"),
                "restartCount": sum(
                    (cs.get("restartCount") or 0) for cs in (p["status"].get("containerStatuses") or [])
                ),
                "ready": (
                    all(cs.get("ready", False) for cs in (p["status"].get("containerStatuses") or []))
                    and all(
                        (cs.get("restartCount") or 0) < 5
                        for cs in (p["status"].get("containerStatuses") or [])
                    )
                ),
            }
            for p in raw_pods
        ] if raw_pods else []
        payload = {"op_type": "uninstall", "op_release": release, "percent": percent_val, "pods": pods_serialised}
        if msg:
            payload["msg"] = msg
        _socketio_emit("progress_update", payload)
        _ds_update(msg=msg, percent=percent_val, pods=pods_serialised)

    def emit(msg=None, percent=None):
        payload = {"op_type": "uninstall", "op_release": release}
        if msg     is not None: payload["msg"]     = msg
        if percent is not None: payload["percent"] = percent
        _socketio_emit("progress_update", payload)
        _ds_update(msg=msg, percent=percent)

    # Initial pod snapshot (before uninstall)
    emit_pods_for_release(5, f"🗑️  Uninstalling '{release}' from namespace '{namespace}'…")

    cmd = ["helm", "uninstall", release, "-n", namespace]
    log.info("Running: %s", " ".join(cmd))
    time.sleep(20);  #by ram this is to let the helm uninstall process done and corresponding existing pods to get into the Termination state
    try:
        proc    = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        percent = 20
        for line in iter(proc.stdout.readline, ""):
            line = line.strip()
            if line:
                emit(line, min(percent, 85))
                percent += 10
        proc.wait()
    except Exception as e:
        final = f"❌ Uninstall error: {e}"
        _ds_update(error=True, final_msg=final)
        _socketio_emit("progress_done", {"message": final, "op_type": "uninstall", "op_release": release})
        return

    if proc.returncode != 0:
        final = f"❌ helm uninstall failed for '{release}'"
        _ds_update(error=True, final_msg=final)
        _socketio_emit("progress_done", {"message": final, "op_type": "uninstall", "op_release": release})
        return

    emit("✅ Helm release removed. Waiting for pods to terminate…", 90)

    for _ in range(10):
        time.sleep(3)
        try:
            remaining = get_pods_by_release(release, namespace)
            if not remaining:
                break
            emit_pods_for_release(95, f"⏳ Waiting for {len(remaining)} pod(s) to terminate…")
        except Exception:
            break

    final = f"✅ '{release}' uninstalled successfully."
    _ds_update(done=True, final_msg=final, percent=100)
    _socketio_emit("progress_done", {"message": final, "op_type": "uninstall", "op_release": release})
    _history_append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "uninstall", "release": release, "namespace": namespace,
        "success": True, "message": final,
        "started_at": _deploy_state.get("started_at"),
        "finished_at": _deploy_state.get("finished_at"),
    })


@app.route("/uninstall", methods=["POST"])
def uninstall():
    data    = request.get_json()
    release = (data or {}).get("release", "").strip()
    if not release:
        return jsonify(success=False, message="No release specified"), 400
    releases        = _list_helm_releases()
    namespace_found = next((ns for r, ns in releases if r == release), None)
    if not namespace_found:
        return jsonify(success=False, message=f"Release '{release}' not found"), 404
    threading.Thread(target=_uninstall_chart, args=(release, namespace_found), daemon=True).start()
    return jsonify(success=True, message=f"Uninstall of '{release}' started.")


@app.route("/connectivity-test", methods=["POST"])
def connectivity_test():
    data            = request.get_json() or {}
    release         = data.get("release", "").strip()
    target          = data.get("target",  "").strip()
    s3_path         = data.get("s3_path", "s3://my-bucket-parquet").strip()
    validation_mode = data.get("test_mode", "2").strip()
    if not release:
        return jsonify(success=False, message="No release specified"), 400
    if not target:
        return jsonify(success=False, message="No target specified"), 400
    releases        = _list_helm_releases()
    namespace_found = next((ns for r, ns in releases if r == release), None)
    if not namespace_found:
        return jsonify(success=False, message=f"Release '{release}' not found"), 404
    try:
        result = _run_validation(s3_path, release, namespace_found, validation_mode)
        return jsonify(success=result.returncode == 0, output=result.stdout, error=result.stderr or None)
    except RuntimeError as e:
        return jsonify(success=False, message=str(e))
    except Exception as e:
        log.exception("Unexpected error in connectivity test")
        return jsonify(success=False, message=f"Internal error: {e}")


# ─── Cluster / Context Management API ─────────────────────────────────────────

@app.route("/api/clusters/list", methods=["GET"])
def api_cluster_list():
    contexts = list_kubeconfig_contexts()
    return jsonify(success=True, contexts=contexts, active=_active_context, kubeconfig=_kubeconfig_path)


@app.route("/api/clusters/probe", methods=["POST"])
def api_cluster_probe():
    data    = request.get_json() or {}
    context = data.get("context", "").strip()
    if not context:
        return jsonify(success=False, message="context name required"), 400
    ok, msg = probe_cluster(context)
    return jsonify(success=ok, context=context, message=msg)


@app.route("/api/clusters/select", methods=["POST"])
def api_cluster_select():
    global _active_context, _k8s_client_cache
    data    = request.get_json() or {}
    context = data.get("context", "").strip()
    force   = data.get("force", False)
    if not context:
        return jsonify(success=False, message="context name required"), 400
    known = [c["name"] for c in list_kubeconfig_contexts()]
    if context not in known:
        return jsonify(success=False, message=f"Context '{context}' not found"), 404
    if not force:
        ok, msg = probe_cluster(context)
        if not ok:
            return jsonify(success=False, reachable=False, context=context,
                           message=f"Cluster unreachable: {msg}"), 503
    _k8s_client_cache.pop(context, None)
    _active_context = context

    # ── Set as default context in kubeconfig ──────────────────────────────────  by ram
    try:
        kubeconfig_path = os.path.expanduser(
            os.environ.get("KUBECONFIG", "~/.kube/config")
        )
        with open(kubeconfig_path, "r") as f:
            kubeconfig = yaml.safe_load(f)

        kubeconfig["current-context"] = context

        with open(kubeconfig_path, "w") as f:
            yaml.dump(kubeconfig, f, default_flow_style=False, allow_unicode=True)
    except Exception as e:
        # Non-fatal — cluster is selected in-memory; just log the warning
        app.logger.warning("Could not persist default context to kubeconfig: %s", e)
    # ─────────────────────────────────────────────────────────────────────────  by ram

    namespaces = _safe_list_namespaces()
    releases   = _list_helm_releases()
    return jsonify(success=True, context=context, message=f"Connected to '{context}'",
                   namespaces=namespaces,
                   releases=[{"name": r, "namespace": ns} for r, ns in releases])


@app.route("/api/clusters/disconnect", methods=["POST"])
def api_cluster_disconnect():
    global _active_context
    prev = _active_context
    _active_context = None
    return jsonify(success=True, message=f"Disconnected from '{prev}'")


@app.route("/api/clusters/status", methods=["GET"])
def api_cluster_status():
    if not _active_context:
        return jsonify(success=True, connected=False, context=None, namespaces=[], releases=[])
    namespaces = _safe_list_namespaces()
    releases   = _list_helm_releases()
    return jsonify(success=True, connected=bool(namespaces), context=_active_context,
                   namespaces=namespaces,
                   releases=[{"name": r, "namespace": ns} for r, ns in releases])


@app.route("/api/clusters/releases", methods=["GET"])
def api_cluster_releases():
    # Short-circuit: if no cluster is connected, return immediately
    # without running helm list (which can block for 15s)
    if not _active_context:
        return jsonify(success=True, releases=[], context=None)
    releases = _list_helm_releases()
    return jsonify(success=True,
                   releases=[{"name": r, "namespace": ns} for r, ns in releases],
                   context=_active_context)


@app.route("/api/clusters/pods", methods=["GET"])
def api_cluster_pods():
    if not _active_context:
        return jsonify(success=True, pods=[], context=None)

    try:
        ns = (request.args.get("ns") or "").strip()
        release = (request.args.get("release") or "").strip()

        if release:
            raw_pods = get_pods_by_release(release, ns)
            pods = _serialize_release_pods(raw_pods)
        else:
            pods = (
                get_pods_by_label("app=presto-coordinator", ns) +
                get_pods_by_label("app=presto-worker", ns) +
                get_pods_by_label("app=hive-metastore", ns) +
                get_pods_by_label("app=postgresql", ns)
            )

        return jsonify(success=True, pods=pods, context=_active_context)
    except Exception as e:
        return jsonify(success=False, pods=[], message=str(e))



@app.route("/api/clusters/namespaces", methods=["GET"])
def api_cluster_namespaces():
    return jsonify(success=True, namespaces=_safe_list_namespaces(), context=_active_context)


# ─── Values Editor ─────────────────────────────────────────────────────────────

@app.route("/values-editor")
def values_editor():
    return render_template("values_editor.html", hr=[], namespaces=[], active_context=_active_context)


@app.route("/api/parse-values", methods=["POST"])
def parse_values():
    """Accept either chart_path OR a raw YAML file upload."""
    # Check for file upload
    if "values_file" in request.files:
        f = request.files["values_file"]
        try:
            raw    = f.read().decode("utf-8")
            values = yaml.safe_load(raw)
            return jsonify(success=True, values=values, raw=raw, source="upload")
        except Exception as e:
            return jsonify(success=False, message=f"Failed to parse uploaded YAML: {e}"), 400

    # Fallback: JSON body with chart_path
    data       = request.get_json() or {}
    chart_path = data.get("chart_path", "").strip()
    if not chart_path:
        return jsonify(success=False, message="Provide a values.yaml file upload or chart_path"), 400
    yaml_path = os.path.join(chart_path, "values.yaml")
    if not os.path.exists(yaml_path):
        return jsonify(success=False, message=f"values.yaml not found in {chart_path}"), 404
    try:
        with open(yaml_path) as f:
            values = yaml.safe_load(f)
        return jsonify(success=True, values=values, yaml_path=yaml_path, source="path")
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


# @app.route("/api/save-values", methods=["POST"])
# def save_values():
#     data         = request.get_json() or {}
#     chart_path   = data.get("chart_path", "").strip()
#     release_name = data.get("release_name", "").strip()
#     namespace    = data.get("namespace", "").strip()
#     new_values   = data.get("values", {})
#     do_deploy    = data.get("deploy", False)
#     if not chart_path:
#         return jsonify(success=False, message="chart_path is required"), 400
#     updated_yaml_path = os.path.join(chart_path, "updated_values.yaml")
#     try:
#         with open(updated_yaml_path, "w") as f:
#             yaml.dump(new_values, f, sort_keys=False, allow_unicode=True)
#     except Exception as e:
#         return jsonify(success=False, message=f"Failed to write values: {e}"), 500
#     if do_deploy and release_name and namespace:
#         threading.Thread(target=_deploy_chart,
#                          args=(release_name, chart_path, updated_yaml_path, namespace),
#                          daemon=True).start()
#         return jsonify(success=True, message="Saved and deployment started.", yaml_path=updated_yaml_path)
#     return jsonify(success=True, message="Saved successfully.", yaml_path=updated_yaml_path)

@app.route("/api/save-values", methods=["POST"])
def save_values():
    data         = request.get_json() or {}
    chart_path   = data.get("chart_path", "").strip()
    release_name = data.get("release_name", "").strip()
    namespace    = data.get("namespace", "").strip()
    new_values   = data.get("values", {})
    do_deploy    = data.get("deploy", False)
    if not chart_path:
        return jsonify(success=False, message="chart_path is required"), 400
    updated_yaml_path = os.path.join(chart_path, "updated_values.yaml")
    try:
        with open(updated_yaml_path, "w") as f:
            yaml.dump(new_values, f, sort_keys=False, allow_unicode=True)
    except Exception as e:
        return jsonify(success=False, message=f"Failed to write values: {e}"), 500
    
    
    if do_deploy and release_name and namespace:
        releases        = _list_helm_releases()
        is_available = any(r == release_name and ns == namespace for r, ns in releases)
        if is_available:
            print("Release is present. starting updating the release")
            threading.Thread(target=upgrade_deploy_chart,
                         args=(release_name, chart_path, updated_yaml_path, namespace),
                         daemon=True).start()
            return jsonify(success=True, message="Saved and upgrade deployment started.", yaml_path=updated_yaml_path)
        
        else:
            print("Release is missing.")

            threading.Thread(target=_deploy_chart,
                             args=(release_name, chart_path, updated_yaml_path, namespace),
                         daemon=True).start()
            return jsonify(success=True, message="Saved and deployment started.", yaml_path=updated_yaml_path)
    return jsonify(success=True, message="Saved successfully.", yaml_path=updated_yaml_path)


# ─── Deployment History ────────────────────────────────────────────────────────
HISTORY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deploy_history.json")
HISTORY_MAX  = 100


def _history_append(record: dict):
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE) as f:
                history = json.load(f)
        else:
            history = []
        history.append(record)
        history = history[-HISTORY_MAX:]
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2, default=str)
    except Exception as e:
        log.warning("Could not write deploy history: %s", e)


@app.route("/api/deploy/history", methods=["GET"])
def api_deploy_history():
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE) as f:
                history = json.load(f)
        else:
            history = []
        return jsonify(success=True, history=list(reversed(history)))
    except Exception as e:
        return jsonify(success=False, message=str(e), history=[])


@app.route("/api/deploy/history/clear", methods=["POST"])
def api_deploy_history_clear():
    try:
        if os.path.exists(HISTORY_FILE):
            os.remove(HISTORY_FILE)
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, message=str(e))


@app.route("/pods")
def pods_page():
    return render_template("pods.html", active_context=_active_context)


@app.route("/api/pods/delete", methods=["POST"])
def api_pod_delete():
    data      = request.get_json() or {}
    pod_name  = data.get("pod", "").strip()
    namespace = (data.get("namespace") or data.get("ns", "")).strip()
    if not pod_name or not namespace:
        return jsonify(success=False, message="pod and namespace required"), 400
    try:
        result = subprocess.run(
            ["kubectl", "delete", "pod", pod_name, "-n", namespace, "--grace-period=0", "--force"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return jsonify(success=True, message=f"Pod {pod_name} deleted.")
        return jsonify(success=False, message=result.stderr or "Delete failed")
    except Exception as e:
        return jsonify(success=False, message=str(e))

@app.route('/validate-chart', methods=['POST'])
def validate_chart():
    data = request.get_json()
    chart_path = data.get('chart_path', '').strip()

    if not chart_path:
        return jsonify({'valid': False, 'error': 'Chart path is empty'})

    if not os.path.exists(chart_path):
        return jsonify({'valid': False, 'error': f'Path does not exist: {chart_path}'})

    if not os.path.isdir(chart_path):
        return jsonify({'valid': False, 'error': f'Path is not a directory: {chart_path}'})

    chart_yaml_path = os.path.join(chart_path, 'Chart.yaml')
    if not os.path.isfile(chart_yaml_path):
        return jsonify({'valid': False, 'error': f'Provided Path is not an valid Chart Path: {chart_path}'})

    presto_yaml_files = list((Path(chart_path) / 'templates').glob('presto-*.yaml'))
    if not presto_yaml_files:
        return jsonify({
            'valid': False,
            'error': f'Provided Path is not an valid Chart Path. No files matching presto-*.yaml found in {chart_path}'
        })

    hive_metastore_yaml_files = list((Path(chart_path) / 'templates').glob('hive-metastore-*.yaml'))
    if not hive_metastore_yaml_files:
        return jsonify({
            'valid': False,
            'error': f'Provided Path is not an valid Chart Path. No files matching hive-metastore-*.yaml found in {chart_path}'
        })


    return jsonify({'valid': True})

@app.route('/api/check-secret', methods=['POST'])
def check_secret():
    """
    Check whether the mpp-credentials secret exists in the given namespace.
    Returns: { exists: bool, error: str (only on failure) }
    """
    data      = request.get_json() or {}
    namespace = data.get('namespace', '').strip()

    if not namespace:
        return jsonify({'exists': False, 'error': 'Namespace is required'})

    v1 = _get_v1()
    if not v1:
        return jsonify({'exists': False, 'error': 'No cluster connected'})

    try:
        v1.read_namespaced_secret(name=CRED_SECRET_NAME, namespace=namespace)
        return jsonify({'exists': True})
    except Exception as e:
        msg = str(e)
        # 404 means secret simply does not exist — not a server error
        if 'Not Found' in msg or '404' in msg:
            return jsonify({
                'exists': False,
                'error': f"Secret '{CRED_SECRET_NAME}' not found in namespace '{namespace}'"
            })
        return jsonify({'exists': False, 'error': f'K8s error: {msg}'})


# ------ To get the services for the presto External IP for connecting --------------

@app.route("/api/helm/services", methods=["GET"])
def api_helm_services():
    if not _active_context:
        return jsonify(success=True, services=[], context=None)
    try:
        """Return kubectl get service output for a given release/namespace."""
        release   = request.args.get("release", "").strip()
        namespace = request.args.get("ns", "").strip()

        cmd = ["kubectl", "get", "service", "-o", "json"]

        if namespace:
            cmd += ["-n", namespace]
        else:
            cmd += ["--all-namespaces"]


            # filter by the Helm release label (works for most charts)
        if release != "" :    
          cmd += ["-l", f"app.kubernetes.io/part-of={release}"]              #by ram based on the helpers.tpl file
        else :
          cmd += ["-l",f"app.kubernetes.io/component in (metastore,coordinator,database)"]            
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return jsonify(success=False, message=result.stderr, services=[])

        raw = json.loads(result.stdout or "{}")
        services = []

        for item in raw.get("items", []):
            meta   = item.get("metadata", {})
            spec   = item.get("spec", {})
            status = item.get("status", {})

            if release:
                labels = meta.get("labels", {})
                svc_release = labels.get("app.kubernetes.io/part-of", labels.get("release", ""))
                if svc_release != release:
                    continue

            cluster_ip = spec.get("clusterIP", "<none>")

            lb = status.get("loadBalancer", {})
            ingresses = lb.get("ingress", [])
            if ingresses:
                external_ip = ", ".join(i.get("ip") or i.get("hostname", "") for i in ingresses)
            elif spec.get("type") in ("NodePort", "ClusterIP"):
                external_ip = "<none>"
            else:
                external_ip = "<pending>"

            ports = []
            for p in spec.get("ports", []):
                proto = p.get("protocol", "TCP")
                port = p.get("port", "")
                node_port = p.get("nodePort")
                if node_port:
                    ports.append(f"{port}:{node_port}/{proto}")
                else:
                    ports.append(f"{port}/{proto}")

            services.append({
                "name": meta.get("name", ""),
                "ns": meta.get("namespace", ""),
                "type": spec.get("type", "ClusterIP"),
                "cluster_ip": cluster_ip,
                "external_ip": external_ip,
                "ports": ", ".join(ports) if ports else "<none>",
                "age": compute_age(meta.get("creationTimestamp", "")),
                "release": meta.get("labels", {}).get(
                    "app.kubernetes.io/part-of",
                    meta.get("labels", {}).get("release", "")
                ),
            })

        return jsonify(success=True, services=services)
    except Exception as e:
        return jsonify(success=False, message=str(e), services=[])


# ─── Entry point ───────────────────────────────────────────────────────────────
# FIX 7: use_reloader=False is CRITICAL — the Werkzeug reloader forks the process,
# which orphans the Socket.IO server and kills WebSocket connections.
# allow_unsafe_werkzeug=True lets Flask-SocketIO run alongside Werkzeug in dev.
if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=APP_PORT_NUMBER,
        debug=True,
        use_reloader=False,          # FIX 7: prevents reloader from killing sockets
        allow_unsafe_werkzeug=True,  # required when debug=True with Flask-SocketIO
    )
