import jaydebeapi
from src.config.settings import (
    DENODO_HOST, DENODO_PORT,
    DENODO_USER, DENODO_PASSWORD,
    JDBC_DRIVER_PATH, JDBC_DRIVER_CLASS,
    DENODO_DATABASE
)

class DenodoWriter:
    def __init__(self):
        self.jdbc_url = f"jdbc:vdb://{DENODO_HOST}:{DENODO_PORT}/{DENODO_DATABASE}"
        self.conn = None

    def connect(self):
        self.conn = jaydebeapi.connect(
            JDBC_DRIVER_CLASS, self.jdbc_url,
            [DENODO_USER, DENODO_PASSWORD], JDBC_DRIVER_PATH
        )

    def _execute(self, vql):
        cursor = self.conn.cursor()
        cursor.execute(vql)
        cursor.close()

    def list_views(self, database):
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT name FROM GET_VIEWS() WHERE database_name = '{database}'")
        rows = cursor.fetchall()
        cursor.close()
        return {row[0] for row in rows}

    def update_view_description(self, view_name, description, database):
        """Returns True if updated, False if skipped (empty description)"""
        if not description:
            return False
        safe_desc = description.replace("'", "''")
        self._execute(f"CONNECT DATABASE {database}")
        self._execute(f"ALTER VIEW {view_name} DESCRIPTION = '{safe_desc}'")
        return True

    def update_column_descriptions(self, view_name, column_descriptions, database):
        """Returns the number of columns updated"""
        if not column_descriptions:
            return 0
        clauses = []
        for col in column_descriptions:
            safe_desc = col['description'].replace("'", "''")
            clauses.append(f"ALTER COLUMN {col['column']} ADD (DESCRIPTION = '{safe_desc}')")
        vql = f"ALTER VIEW {view_name} ( {' '.join(clauses)} )"
        self._execute(f"CONNECT DATABASE {database}")
        self._execute(vql)
        return len(column_descriptions)

    def update_view_tags(self, view_name, tags, database):
        """Returns the number of view tags updated"""
        if not tags:
            return 0
        for tag in tags:
            vql = f"""CREATE OR REPLACE TAG "{tag}"
                ADD_TO (VIEWS ({database}.{view_name}) COLUMNS ())
                REMOVE_FROM (VIEWS () COLUMNS ())"""
            self._execute(vql)
        return len(tags)

    def update_column_tags(self, view_name, column_descriptions, database):
        """Returns the number of column tags updated"""
        if not column_descriptions:
            return 0
        count = 0
        for col in column_descriptions:
            tags = col.get('tags', [])
            for tag in tags:
                vql = f"""CREATE OR REPLACE TAG "{tag}"
                    ADD_TO (VIEWS () COLUMNS ({database}.{view_name}.{col['column']}))
                    REMOVE_FROM (VIEWS () COLUMNS ())"""
                self._execute(vql)
                count += 1
        return count

    def disconnect(self):
        if self.conn:
            self.conn.close()