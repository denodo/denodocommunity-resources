import jaydebeapi
from src.config.settings import (
    DENODO_HOST, DENODO_PORT,
    DENODO_USER, DENODO_PASSWORD,
    JDBC_DRIVER_PATH, JDBC_DRIVER_CLASS,
    DENODO_DATABASE
)

class DenodoReader:
    def __init__(self):
        self.jdbc_url = f"jdbc:vdb://{DENODO_HOST}:{DENODO_PORT}/{DENODO_DATABASE}"
        self.conn = None

    def connect(self):
        self.conn = jaydebeapi.connect(
            JDBC_DRIVER_CLASS, self.jdbc_url,
            [DENODO_USER, DENODO_PASSWORD], JDBC_DRIVER_PATH
        )

    def read_view_descriptions(self):
        """Read view-level descriptions from Denodo"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT name, description FROM GET_VIEWS()")
        rows = cursor.fetchall()
        cursor.close()
        return {name: (desc or '') for name, desc in rows}

    def read_column_descriptions(self, view_name, database):
        """Read column-level descriptions from a Denodo view"""
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT column_name, column_remarks 
            FROM GET_VIEW_COLUMNS() 
            WHERE input_database_name = '{database}'
            AND input_view_name = '{view_name}'
        """)
        rows = cursor.fetchall()
        cursor.close()
        return {col: (desc or '') for col, desc in rows}

    def read_view_tags(self, database):
        """Read all tag assignments from Denodo for a specific database"""
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT view_name, column_name, tag_name 
            FROM GET_VIEW_TAGS() 
            WHERE input_database_name = '{database}'
        """)
        rows = cursor.fetchall()
        cursor.close()

        result = {}
        for view_name, column_name, tag_name in rows:
            if view_name not in result:
                result[view_name] = {'tags': [], 'columns': {}}
            if column_name is None:
                result[view_name]['tags'].append(tag_name)
            else:
                if column_name not in result[view_name]['columns']:
                    result[view_name]['columns'][column_name] = []
                result[view_name]['columns'][column_name].append(tag_name)

        return result

    def disconnect(self):
        if self.conn:
            self.conn.close()
