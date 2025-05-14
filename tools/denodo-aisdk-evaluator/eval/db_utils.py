import logging
import pandas as pd
from tqdm import tqdm
import requests 
import base64
import time
logger = logging.getLogger(__name__)


DATA_CATALOG_URL =  ('http://localhost:9090/denodo-data-catalog').rstrip('/') + '/'    
DATA_CATALOG_EXECUTION_URL = "http://localhost:9090/denodo-data-catalog/public/api/askaquestion/execute"
DATA_CATALOG_SERVER_ID = int(1)
DATA_CATALOG_VERIFY_SSL = ( '0') == '1'

EXECUTE_VQL_LIMIT = 100
_AUTH_CREDENTIALS = None
_DATA_CATALOG_CONFIG = {
    'url': DATA_CATALOG_URL,
    'execution_url': DATA_CATALOG_EXECUTION_URL,
    'server_id': DATA_CATALOG_SERVER_ID,
    'verify_ssl': DATA_CATALOG_VERIFY_SSL
}

def initialize_data_catalog(user='admin', password='admin', url=None, execution_url=None, server_id=None, verify_ssl=None):
    """
    Initialize Data Catalog configuration and store credentials for reuse.
    Call this once at the beginning of your program.
    
    Args:
        user (str): Username for authentication
        password (str): Password for authentication
        url (str, optional): Base URL for Data Catalog
        execution_url (str, optional): Execution URL endpoint
        server_id (int, optional): Server ID
        verify_ssl (bool, optional): Whether to verify SSL certificates
    """
    global _AUTH_CREDENTIALS, _DATA_CATALOG_CONFIG
    
    # Store authentication credentials
    _AUTH_CREDENTIALS = (user, password)
    
    # Update configuration if provided
    if url is not None:
        _DATA_CATALOG_CONFIG['url'] = url
    if execution_url is not None:
        _DATA_CATALOG_CONFIG['execution_url'] = execution_url
    if server_id is not None:
        _DATA_CATALOG_CONFIG['server_id'] = server_id
    if verify_ssl is not None:
        _DATA_CATALOG_CONFIG['verify_ssl'] = verify_ssl
    
    logger.info(f"Data Catalog initialized with execution URL: {_DATA_CATALOG_CONFIG['execution_url']}")

def parse_execution_json_for_pandas(json_response):
    """

    Parses the JSON response from the Data Catalog API into a list of dictionaries
    that can be directly converted into a pandas DataFrame.
    
    Args:
        json_response (dict): JSON response from the API.
        
    Returns:
        List[dict]: A list where each dictionary represents a row.
    """
    parsed_rows = []
    for row in json_response.get('rows', []):
        row_dict = {}
        # Each row has a list of "values". Each value contains details about a column.
        for value in row.get('values', []):
            # Use the "column" key for the header if available, otherwise fallback to "columnName".
            col_name = value.get('column') or value.get('columnName') or "unknown_column"
            row_dict[col_name] = value.get('value')
        parsed_rows.append(row_dict)
    return parsed_rows
    

def make_data_catalog_execution_url(host: str, port: int) -> str:
    """
    Constructs the Data Catalog Execution URL using the provided credentials and host info.

    Returns:
        A string representing the complete URL.
    """
    return f'http://{host}:{port}/denodo-data-catalog/public/api/askaquestion/execute'
    
url = make_data_catalog_execution_url("localhost", 9090)    
def calculate_basic_auth_authorization_header(user, password):
    user_pass = user + ':' + password
    ascii_bytes = user_pass.encode('ascii')
    return 'Basic' + ' ' + base64.b64encode(ascii_bytes).decode('utf-8')
    
def execute_vql(vql, db_params=None, return_time=False, limit=EXECUTE_VQL_LIMIT, 
                execution_url=None, server_id=None, verify_ssl=None):
    """
    Execute VQL against Data Catalog with support for OAuth token or Basic auth.
    Uses stored credentials if no db_params provided.
    
    Args:
        vql: VQL query to execute
        db_params: Database params dict or tuple of (username, password) for basic auth (optional)
        return_time: Whether to return execution time
        limit: Maximum number of rows to return
        execution_url: Data Catalog execution endpoint (optional, uses stored value if None)
        server_id: Server identifier (optional, uses stored value if None)
        verify_ssl: Whether to verify SSL certificates (optional, uses stored value if None)
        
    Returns:
        pd.DataFrame or tuple (pd.DataFrame, execution_time)
    """
    global _AUTH_CREDENTIALS, _DATA_CATALOG_CONFIG
    
    import time
    start_time = time.time()
    
    # Use stored credentials unless explicitly overridden
    auth = _AUTH_CREDENTIALS or ('admin', 'admin')
    if db_params:
        if isinstance(db_params, dict) and 'user' in db_params and 'password' in db_params:
            auth = (db_params['user'], db_params['password'])
        elif isinstance(db_params, tuple) and len(db_params) == 2:
            auth = db_params
    
    # Use stored config values unless explicitly overridden
    actual_execution_url = execution_url or _DATA_CATALOG_CONFIG['execution_url']
    actual_server_id = server_id or _DATA_CATALOG_CONFIG['server_id']
    actual_verify_ssl = verify_ssl if verify_ssl is not None else _DATA_CATALOG_CONFIG['verify_ssl']
    
    logging.info("Preparing execution request")
    headers = {'Content-Type': 'application/json'}
    headers['Authorization'] = calculate_basic_auth_authorization_header(*auth)
    
    data = {
        "vql": vql,
        "limit": limit
    }
    
    try:
        response = requests.post(
            f"{actual_execution_url}?serverId={actual_server_id}",
            json=data,
            headers=headers,
            verify=actual_verify_ssl
        )
        response.raise_for_status()

        json_response = response.json()
        parsed_rows = parse_execution_json_for_pandas(json_response)
        
        # Convert to DataFrame
        df = pd.DataFrame(parsed_rows) if parsed_rows else pd.DataFrame()
        
        execution_time = time.time() - start_time
        
        return df, execution_time
    
    except requests.RequestException as e:
        error_message = f"Failed to connect to the server: {str(e)}"
        logging.error(f"{error_message}. VQL: {vql}")
        
        # Return empty DataFrame to maintain consistent return type
        empty_df = pd.DataFrame()
        execution_time = time.time() - start_time
        
        return empty_df, execution_time

def test_database_connection(datacatalog_params):
    '''
    Test the Denodo psycopg2+sqlalchemy connection using the provided parameters.
    args:
    datacatalog_params: A dictionary containing database connection parameters:
        - user (str): Database username.
        - password (str): Database password.
        - host (str): Database host address.
        - port (int): Database port number.
        - databaseName (str): Name of the database.
    '''
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=datacatalog_params["host"],
            port=datacatalog_params["port"],
            user=datacatalog_params["user"],
            password=datacatalog_params["password"],
            database=datacatalog_params["databaseName"]
        )
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        logger.info(f"Connection test succeeded. Result: {result}")
        return True
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return False

def add_query_execution_data(df, datacatalog_params, expected_column, predicted_column="VQL Generated"):
    """
    For each row in the DataFrame, execute the predicted VQL and the ground truth VQL 
    and check if they return the same number of rows and columns.
    
    Parameters:
        df (pd.DataFrame): DataFrame containing VQL queries
        datacatalog_params (dict): Database connection parameters
        expected_column (str): Column name containing ground truth VQL queries
        predicted_column (str, optional): Column name containing predicted VQL queries. Defaults to "VQL Generated".
    
    New columns added:
      - same_row_count: Binary indicator (1 if predicted and truth have same row count)
      - same_column_count: Binary indicator (1 if predicted and truth have same column count)
      
    Returns:
      pd.DataFrame: Modified DataFrame with structural matching indicators
    """
    same_row_counts = []
    same_column_counts = []
    
    for index, row in tqdm(df.iterrows(), total=len(df), desc="Executing VQL queries", position=0, leave=True):
        predicted_sql = row[predicted_column]
        ground_truth_sql = row[expected_column]
        
        # Execute predicted SQL
        try:
            pred_data, _ = execute_vql(predicted_sql, datacatalog_params, return_time=True)
            pred_row_count = len(pred_data.index) if pred_data is not None else 0
            pred_col_count = len(pred_data.columns) if pred_data is not None else 0
        except Exception as e:
            logging.error("Error executing predicted VQL on row %d: %s", index, e)
            pred_row_count = 0
            pred_col_count = 0
        
        # Execute ground truth SQL
        try:
            truth_data, _ = execute_vql(ground_truth_sql, datacatalog_params, return_time=True)
            truth_row_count = len(truth_data.index) if truth_data is not None else 0
            truth_col_count = len(truth_data.columns) if truth_data is not None else 0
        except Exception as e:
            logging.error("Error executing ground truth VQL on row %d: %s", index, e)
            truth_row_count = 0
            truth_col_count = 0
        
        # Check if row and column counts match
        same_row = 1 if pred_row_count == truth_row_count else 0
        same_col = 1 if pred_col_count == truth_col_count else 0
        
        same_row_counts.append(same_row)
        same_column_counts.append(same_col)
    
    # Add only the binary indicators to the DataFrame
    df["same_row_count"] = same_row_counts
    df["same_column_count"] = same_column_counts
    
    return df
