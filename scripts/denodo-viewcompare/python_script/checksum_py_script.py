import jaydebeapi
import random
import sys


JDBC_DRIVER = "com.denodo.vdp.jdbc.Driver"
JDBC_URL = "jdbc:denodo://localhost:39999/admin"
USERNAME = "admin"
PASSWORD = "admin"
JAR_PATH = "C:/Denodo/DenodoPlatform8.0_custom_3/lib/extensions/jdbc-drivers/vdp-8.0/denodo-vdp-jdbcdriver.jar"

conn_src = jaydebeapi.connect(JDBC_DRIVER, JDBC_URL, [USERNAME, PASSWORD], JAR_PATH)
conn_tgt = jaydebeapi.connect(JDBC_DRIVER, JDBC_URL, [USERNAME, PASSWORD], JAR_PATH)
std_input=(sys.argv)
pk_field_src = std_input[1]
view_name_src = std_input[2]
db_name_src = std_input[3]
pk_field_tgt = std_input[4]
view_name_tgt = std_input[5]
db_name_tgt = std_input[6]
cursor_src = conn_src.cursor()
cursor_tgt = conn_tgt.cursor()

query_src = f"SELECT hash_inp, pk as pk FROM vdb_testing_tool.source_checksum() WHERE dbname = '{db_name_src}' AND viewname = '{view_name_src}' AND pk_field = '{pk_field_src}'"
query_tgt = f"SELECT hash_inp, pk as pk FROM vdb_testing_tool.target_checksum() WHERE dbname = '{db_name_tgt}' AND viewname = '{view_name_tgt}' AND pk_field = '{pk_field_tgt}'"

cursor_src.execute("delete from vdb_testing_tool.bv_checksum_comparison;")

cursor_src.execute(query_src)
cursor_tgt.execute(query_tgt)


results_src = cursor_src.fetchall()
results_tgt = cursor_tgt.fetchall()


changed_rows_src = []
changed_rows_tgt = []
missing_in_src = []
missing_in_tgt = []
new_rows = []
deleted_rows = []
mismatch_key = []

src_dict = {row[1]: row[0] for row in results_src}
tgt_dict = {row[1]: row[0] for row in results_tgt}
missing_in_tgt = []
changed_keys = []

for  pk, src_hash in src_dict.items():
    
    if pk not in tgt_dict:
        missing_in_tgt.append(pk)
        continue

    tgt_hash = tgt_dict[pk]
    
    if src_hash != tgt_hash:
        changed_keys.append(pk)
    
missing_in_src = list(set(tgt_dict.keys()) - set(src_dict.keys()))





for i in missing_in_src:
    observation = 'missing in source'
    sql = "INSERT INTO vdb_testing_tool.bv_checksum_comparison (target_view_name,primary_key, observation ,source_view_name) VALUES (?, ?, ?, ?)"
    cursor_src.execute(sql, (view_name_tgt, str(i) ,observation, view_name_src))
for i in missing_in_tgt:
    observation = 'missing in target'
    sql = "INSERT INTO vdb_testing_tool.bv_checksum_comparison (target_view_name,primary_key, observation ,source_view_name) VALUES (?, ?, ?, ?)"
    cursor_src.execute(sql, (view_name_tgt, str(i) ,observation, view_name_src))
for i in changed_keys:
    observation = 'mismatch'
    sql = "INSERT INTO vdb_testing_tool.bv_checksum_comparison (target_view_name,primary_key, observation ,source_view_name) VALUES (?, ?, ?, ?)"
    cursor_src.execute(sql, (view_name_tgt, str(i) ,observation, view_name_src))

cursor_src.close()
conn_src.close()
cursor_tgt.close()
conn_tgt.close()




