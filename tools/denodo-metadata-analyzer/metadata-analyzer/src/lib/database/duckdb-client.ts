import * as duckdbWasm from '@duckdb/duckdb-wasm';

export class DuckDBClient {
  private db: duckdbWasm.AsyncDuckDB | null = null;
  private conn: duckdbWasm.AsyncDuckDBConnection | null = null;
  private isLoadingFromOPFS: boolean = false;

  async initialize(): Promise<void> {

    try {
      // Use manual bundles to avoid CORS issues with CDN
      const MANUAL_BUNDLES: duckdbWasm.DuckDBBundles = {
        mvp: {
          mainModule: '/duckdb-mvp.wasm',
          mainWorker: '/duckdb-browser-mvp.worker.js',
        },
        eh: {
          mainModule: '/duckdb-eh.wasm',
          mainWorker: '/duckdb-browser-eh.worker.js',
        },
      };

      let bundle;
      let worker;
      const logger = new duckdbWasm.VoidLogger();

      try {
        // Try to use local bundles first
        bundle = await duckdbWasm.selectBundle(MANUAL_BUNDLES);
        worker = new Worker(bundle.mainWorker!);
      } catch (localError) {

        // Fallback: Try direct instantiation without worker for development
        try {
          // Use CDN bundles as fallback
          const cdnBundle = await duckdbWasm.selectBundle(duckdbWasm.getJsDelivrBundles());
          this.db = new duckdbWasm.AsyncDuckDB(logger);
          await this.db.instantiate(cdnBundle.mainModule, cdnBundle.pthreadWorker);
          this.conn = await this.db.connect();

          // Note: Threading only works with mvp bundle, not eh bundle
          // Skip thread configuration to avoid errors

          await this.initializeSchema();
          return;
        } catch (directError) {

          // Last resort: Use jsdelivr bundles
          const JSDELIVR_BUNDLES = duckdbWasm.getJsDelivrBundles();
          bundle = await duckdbWasm.selectBundle(JSDELIVR_BUNDLES);

          // Create a blob URL to avoid CORS issues
          const workerResponse = await fetch(bundle.mainWorker!);
          const workerBlob = await workerResponse.blob();
          const workerUrl = URL.createObjectURL(workerBlob);
          worker = new Worker(workerUrl);
        }
      }

      this.db = new duckdbWasm.AsyncDuckDB(logger, worker!);
      await this.db.instantiate(bundle!.mainModule, bundle!.pthreadWorker);
      this.conn = await this.db.connect();

      // Note: Threading only works with mvp bundle, not eh bundle
      // Skip thread configuration to avoid errors

      await this.initializeSchema();
    } catch (error) {
      console.error('[DuckDB] Failed to initialize:', error);
      throw error;
    }
  }

  private async initializeSchema(): Promise<void> {

    // Create sequences for auto-increment IDs (proper DuckDB syntax)
    await this.execute(`
      CREATE SEQUENCE IF NOT EXISTS databases_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS data_sources_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS views_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS global_elements_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS wrappers_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS associations_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS view_stats_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS cache_data_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS database_cache_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS duplicates_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS analysis_metadata_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS parsing_progress_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS cache_configuration_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS server_configuration_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS performance_metrics_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS resource_plans_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS resource_rules_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS role_modifications_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS tags_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS map_entries_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS webservices_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS sm_environments_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS sm_clusters_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS sm_nodes_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS sm_deployment_config_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS sm_monitoring_config_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS sm_vcs_config_id_seq START 1;
      CREATE SEQUENCE IF NOT EXISTS sm_global_monitoring_id_seq START 1;
    `);

    // Create tables matching EXACT IndexedDB structure with proper DuckDB syntax
    await this.execute(`
      -- Core entities matching current IndexedDB schema exactly
      CREATE TABLE IF NOT EXISTS databases (
        id INTEGER PRIMARY KEY DEFAULT nextval('databases_id_seq'),
        name VARCHAR NOT NULL,
        denodo_version VARCHAR,
        created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS datasources (
        id INTEGER PRIMARY KEY DEFAULT nextval('data_sources_id_seq'),
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        database VARCHAR,
        url VARCHAR,
        driver VARCHAR,
        database_name VARCHAR,
        database_version VARCHAR,
        username VARCHAR,
        classpath VARCHAR,
        vendor VARCHAR,
        class_name VARCHAR,
        folder VARCHAR,
        route_type VARCHAR,
        route_connection VARCHAR,
        web_service_type VARCHAR,
        wsdl_location VARCHAR,
        server_name VARCHAR,
        dsn VARCHAR,
        connection_string VARCHAR,
        properties JSON,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS views (
        id INTEGER PRIMARY KEY DEFAULT nextval('views_id_seq'),
        name VARCHAR NOT NULL,
        kind VARCHAR NOT NULL,
        database VARCHAR NOT NULL,
        cache_status VARCHAR,
        select_body TEXT,
        folder VARCHAR,
        implementation VARCHAR,
        properties JSON,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS global_elements (
        id INTEGER PRIMARY KEY DEFAULT nextval('global_elements_id_seq'),
        type VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        category VARCHAR,
        database VARCHAR,
        auth_type VARCHAR,
        user_type VARCHAR,
        ldap_datasource VARCHAR,
        ldap_username VARCHAR,
        description TEXT,
        privileges JSON,
        role_type VARCHAR,
        admin_privileges VARCHAR,
        file_path VARCHAR,
        file_name VARCHAR,
        file_type VARCHAR,
        version VARCHAR,
        map_type VARCHAR,
        country VARCHAR,
        timezone VARCHAR,
        tag_type VARCHAR,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS wrappers (
        id INTEGER PRIMARY KEY DEFAULT nextval('wrappers_id_seq'),
        name VARCHAR NOT NULL,
        wrapper_type VARCHAR,
        database VARCHAR,
        data_source_name VARCHAR,
        parameters_content TEXT,
        stream_tuples_config JSON,
        parameters JSON,
        is_excel_wrapper BOOLEAN DEFAULT FALSE,
        type_of_file VARCHAR,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS associations (
        id INTEGER PRIMARY KEY DEFAULT nextval('associations_id_seq'),
        name VARCHAR NOT NULL,
        kind VARCHAR,
        database VARCHAR NOT NULL,
        folder VARCHAR,
        endpoints JSON,
        mapping JSON,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS webservices (
        id INTEGER PRIMARY KEY DEFAULT nextval('webservices_id_seq'),
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        database VARCHAR NOT NULL,
        folder VARCHAR,
        resource_name VARCHAR,
        schema_name VARCHAR,
        created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS view_stats (
        id INTEGER PRIMARY KEY DEFAULT nextval('view_stats_id_seq'),
        view_name VARCHAR NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        statement_type VARCHAR,
        database VARCHAR,
        statistics JSON,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS resource_plans (
        id INTEGER PRIMARY KEY DEFAULT nextval('resource_plans_id_seq'),
        name VARCHAR NOT NULL,
        type VARCHAR,
        database VARCHAR NOT NULL,
        description TEXT,
        condition TEXT,
        action TEXT,
        parameters JSON,
        full_definition TEXT,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS resource_rules (
        id INTEGER PRIMARY KEY DEFAULT nextval('resource_rules_id_seq'),
        name VARCHAR NOT NULL,
        type VARCHAR,
        database VARCHAR NOT NULL,
        description TEXT,
        condition TEXT,
        plan VARCHAR,
        priority INTEGER,
        full_definition TEXT,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS cache_data (
        id INTEGER PRIMARY KEY DEFAULT nextval('cache_data_id_seq'),
        name VARCHAR NOT NULL,
        database VARCHAR NOT NULL,
        cache_type VARCHAR,
        cache_status VARCHAR,
        configuration JSON,
        analysis_id VARCHAR
      );

      -- Database-level cache configuration (from ALTER DATABASE ... CACHE ...)
      CREATE TABLE IF NOT EXISTS database_cache (
        id INTEGER PRIMARY KEY DEFAULT nextval('database_cache_id_seq'),
        database VARCHAR NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        datasource VARCHAR,
        ttl VARCHAR,
        maintainer_period INTEGER,
        raw TEXT,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS duplicates (
        id INTEGER PRIMARY KEY DEFAULT nextval('duplicates_id_seq'),
        type VARCHAR NOT NULL,
        connection_string VARCHAR NOT NULL,
        count INTEGER NOT NULL,
        sources JSON,
        similarity DOUBLE,
        analysis_id VARCHAR
      );

      -- Solution Manager tables
      CREATE TABLE IF NOT EXISTS sm_environments (
        id INTEGER PRIMARY KEY DEFAULT nextval('sm_environments_id_seq'),
        env_id INTEGER NOT NULL,
        name VARCHAR NOT NULL,
        uuid VARCHAR,
        description VARCHAR,
        license_alias VARCHAR,
        environment_type VARCHAR,
        minimum_update_mandatory BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS sm_clusters (
        id INTEGER PRIMARY KEY DEFAULT nextval('sm_clusters_id_seq'),
        cluster_id INTEGER NOT NULL,
        env_id INTEGER NOT NULL,
        name VARCHAR NOT NULL,
        uuid VARCHAR,
        description VARCHAR,
        cluster_order INTEGER,
        enabled BOOLEAN,
        environment_type VARCHAR
      );

      CREATE TABLE IF NOT EXISTS sm_nodes (
        id INTEGER PRIMARY KEY DEFAULT nextval('sm_nodes_id_seq'),
        node_id INTEGER NOT NULL,
        cluster_id INTEGER NOT NULL,
        name VARCHAR NOT NULL,
        uuid VARCHAR,
        description VARCHAR,
        type_node VARCHAR,
        url_ip VARCHAR,
        url_port INTEGER,
        use_kerberos BOOLEAN,
        use_pass_through BOOLEAN,
        username VARCHAR,
        enabled BOOLEAN,
        use_default_license_alias BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS sm_deployment_config (
        id INTEGER PRIMARY KEY DEFAULT nextval('sm_deployment_config_id_seq'),
        env_id INTEGER NOT NULL,
        deployments_enabled BOOLEAN,
        deployment_type VARCHAR,
        shared_cache BOOLEAN,
        cluster_strategy VARCHAR,
        server_strategy VARCHAR,
        configured_clusters INTEGER,
        rollback_enabled BOOLEAN,
        backup_enabled BOOLEAN,
        data_catalog_synchronize_enabled BOOLEAN,
        shared_metadata BOOLEAN,
        fast_cloud_deployments BOOLEAN,
        queue_deployments_enabled BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS sm_monitoring_config (
        id INTEGER PRIMARY KEY DEFAULT nextval('sm_monitoring_config_id_seq'),
        env_id INTEGER NOT NULL,
        active_monitors JSON,
        enabled_cloud_storage BOOLEAN,
        enabled_jdbc_storage BOOLEAN,
        jdbc_provider VARCHAR,
        jdbc_database_uri VARCHAR,
        jdbc_driver_class VARCHAR,
        jdbc_auth_type VARCHAR,
        jdbc_user VARCHAR
      );

      CREATE TABLE IF NOT EXISTS sm_vcs_config (
        id INTEGER PRIMARY KEY DEFAULT nextval('sm_vcs_config_id_seq'),
        type VARCHAR,
        url VARCHAR,
        use_default_branch BOOLEAN,
        branch VARCHAR,
        user_authentication BOOLEAN,
        user VARCHAR,
        local_repository_home VARCHAR,
        vql_chunk_size_in_mb INTEGER
      );

      CREATE TABLE IF NOT EXISTS sm_global_monitoring (
        id INTEGER PRIMARY KEY DEFAULT nextval('sm_global_monitoring_id_seq'),
        active_monitors JSON,
        enabled_cloud_storage BOOLEAN,
        enabled_jdbc_storage BOOLEAN,
        jdbc_provider VARCHAR,
        jdbc_database_uri VARCHAR,
        jdbc_driver_class VARCHAR,
        jdbc_auth_type VARCHAR,
        jdbc_user VARCHAR,
        autostart_global_monitors BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS sm_metadata (
        id INTEGER PRIMARY KEY,
        version VARCHAR
      );

      -- Analysis and metadata tables (exact match to current)
      CREATE TABLE IF NOT EXISTS analysis_metadata (
        id INTEGER PRIMARY KEY DEFAULT nextval('analysis_metadata_id_seq'),
        file_name VARCHAR NOT NULL,
        file_size INTEGER,
        parse_time INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        analysis_id VARCHAR NOT NULL
      );

      CREATE TABLE IF NOT EXISTS parsing_progress (
        id INTEGER PRIMARY KEY DEFAULT nextval('parsing_progress_id_seq'),
        analysis_id VARCHAR NOT NULL,
        stage VARCHAR NOT NULL,
        progress INTEGER DEFAULT 0,
        status VARCHAR DEFAULT 'pending'
      );

      -- Tags table (view of global_elements filtered by type='tag')
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY DEFAULT nextval('tags_id_seq'),
        name VARCHAR NOT NULL,
        type VARCHAR DEFAULT 'tag',
        database VARCHAR,
        description TEXT,
        multi_tags JSON,
        analysis_id VARCHAR
      );

      -- Map entries table (view of global_elements filtered by type='map')
      CREATE TABLE IF NOT EXISTS map_entries (
        id INTEGER PRIMARY KEY DEFAULT nextval('map_entries_id_seq'),
        name VARCHAR NOT NULL,
        type VARCHAR DEFAULT 'map',
        map_type VARCHAR,
        database VARCHAR,
        country VARCHAR,
        timezone VARCHAR,
        full_definition TEXT,
        analysis_id VARCHAR
      );

      CREATE TABLE IF NOT EXISTS cache_configuration (
        id INTEGER PRIMARY KEY DEFAULT nextval('cache_configuration_id_seq'),
        analysis_id VARCHAR NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        database_type VARCHAR,
        maintenance JSON
      );

      CREATE TABLE IF NOT EXISTS server_configuration (
        id INTEGER PRIMARY KEY DEFAULT nextval('server_configuration_id_seq'),
        analysis_id VARCHAR NOT NULL,
        configuration JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY DEFAULT nextval('performance_metrics_id_seq'),
        analysis_id VARCHAR NOT NULL,
        metric VARCHAR NOT NULL,
        value JSON,
        category VARCHAR
      );

      CREATE TABLE IF NOT EXISTS resource_plans (
        id INTEGER PRIMARY KEY DEFAULT nextval('resource_plans_id_seq'),
        name VARCHAR NOT NULL,
        description TEXT,
        analysis_id VARCHAR NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resource_rules (
        id INTEGER PRIMARY KEY DEFAULT nextval('resource_rules_id_seq'),
        name VARCHAR NOT NULL,
        condition TEXT,
        plan VARCHAR,
        analysis_id VARCHAR NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_modifications (
        id INTEGER PRIMARY KEY DEFAULT nextval('role_modifications_id_seq'),
        name VARCHAR NOT NULL,
        granted_roles JSON,
        admin_privileges JSON,
        is_admin BOOLEAN DEFAULT FALSE,
        analysis_id VARCHAR NOT NULL
      );

      -- Materialized database statistics for fast VDB Breakdown page
      CREATE TABLE IF NOT EXISTS database_stats (
        database VARCHAR PRIMARY KEY,
        data_sources INTEGER DEFAULT 0,
        total_views INTEGER DEFAULT 0,
        base_views INTEGER DEFAULT 0,
        derived_views INTEGER DEFAULT 0,
        interface_views INTEGER DEFAULT 0,
        cached_views INTEGER DEFAULT 0,
        associations INTEGER DEFAULT 0
      );
    `);

    // Create single-column indexes for performance (matching current IndexedDB patterns)
    await this.execute(`
      -- Indexes matching current IndexedDB compound index performance patterns
      CREATE INDEX IF NOT EXISTS idx_databases_name ON databases(name);
      CREATE INDEX IF NOT EXISTS idx_databases_denodo_version ON databases(denodo_version);
      CREATE INDEX IF NOT EXISTS idx_database_stats_database ON database_stats(database);

      CREATE INDEX IF NOT EXISTS idx_datasources_database ON datasources(database);
      CREATE INDEX IF NOT EXISTS idx_datasources_type ON datasources(type);
      CREATE INDEX IF NOT EXISTS idx_datasources_name ON datasources(name);

      CREATE INDEX IF NOT EXISTS idx_views_database ON views(database);
      CREATE INDEX IF NOT EXISTS idx_views_kind ON views(kind);
      CREATE INDEX IF NOT EXISTS idx_views_cache_status ON views(cache_status);

      CREATE INDEX IF NOT EXISTS idx_global_elements_type ON global_elements(type);
      CREATE INDEX IF NOT EXISTS idx_global_elements_category ON global_elements(category);

      CREATE INDEX IF NOT EXISTS idx_wrappers_data_source_name ON wrappers(data_source_name);
      CREATE INDEX IF NOT EXISTS idx_wrappers_stream_tuples_config ON wrappers(stream_tuples_config);

      CREATE INDEX IF NOT EXISTS idx_associations_database ON associations(database);
      CREATE INDEX IF NOT EXISTS idx_associations_name ON associations(name);

      CREATE INDEX IF NOT EXISTS idx_view_stats_database ON view_stats(database);
      CREATE INDEX IF NOT EXISTS idx_view_stats_enabled ON view_stats(enabled);
      CREATE INDEX IF NOT EXISTS idx_view_stats_view_name ON view_stats(view_name);

      CREATE INDEX IF NOT EXISTS idx_cache_data_database ON cache_data(database);
      CREATE INDEX IF NOT EXISTS idx_cache_data_cache_type ON cache_data(cache_type);
      CREATE INDEX IF NOT EXISTS idx_cache_data_cache_status ON cache_data(cache_status);

      CREATE INDEX IF NOT EXISTS idx_database_cache_database ON database_cache(database);
      CREATE INDEX IF NOT EXISTS idx_database_cache_enabled ON database_cache(enabled);

      CREATE INDEX IF NOT EXISTS idx_duplicates_type ON duplicates(type);
      CREATE INDEX IF NOT EXISTS idx_duplicates_count ON duplicates(count);

      CREATE INDEX IF NOT EXISTS idx_analysis_metadata_analysis_id ON analysis_metadata(analysis_id);
      CREATE INDEX IF NOT EXISTS idx_role_modifications_analysis_id ON role_modifications(analysis_id);
      CREATE INDEX IF NOT EXISTS idx_role_modifications_is_admin ON role_modifications(is_admin);
    `);

  }

  // Method matching current MetadataDatabase interface
  async clearAnalysisData(): Promise<void> {

    const tables = [
      'databases', 'datasources', 'views', 'global_elements',
      'wrappers', 'associations', 'view_stats', 'cache_data',
      'database_cache', 'duplicates', 'analysis_metadata', 'parsing_progress',
      'cache_configuration', 'server_configuration', 'performance_metrics',
      'resource_plans', 'resource_rules', 'role_modifications', 'database_stats'
    ];

    // Use DELETE FROM instead of TRUNCATE for WASM compatibility
    for (const table of tables) {
      await this.execute(`DELETE FROM ${table}`);
    }

    // Reset sequences
    const sequences = [
      'databases_id_seq', 'data_sources_id_seq', 'views_id_seq',
      'global_elements_id_seq', 'wrappers_id_seq', 'associations_id_seq',
      'view_stats_id_seq', 'cache_data_id_seq', 'database_cache_id_seq', 'duplicates_id_seq',
      'analysis_metadata_id_seq', 'parsing_progress_id_seq',
      'cache_configuration_id_seq', 'server_configuration_id_seq',
      'performance_metrics_id_seq', 'resource_plans_id_seq',
      'resource_rules_id_seq', 'role_modifications_id_seq'
    ];

    for (const seq of sequences) {
      await this.execute(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
    }


  }

  async batchInsert(tableName: string, items: any[], batchSize: number = 1000): Promise<void> {
    if (!items || items.length === 0) return;

    const startTime = performance.now();

    // Convert camelCase to snake_case for table compatibility
    const convertedItems = items.map(item => this.convertCamelCaseToSnakeCase(item));

    // Define allowed columns for each table (matching schema exactly)
    const tableColumns: { [key: string]: string[] } = {
      databases: ['name', 'denodo_version', 'created', 'analysis_id'],
      datasources: ['name', 'type', 'database', 'url', 'driver', 'database_name', 'database_version',
                    'username', 'classpath', 'vendor', 'class_name', 'folder', 'route_type',
                    'route_connection', 'web_service_type', 'wsdl_location', 'server_name', 'dsn',
                    'connection_string', 'properties', 'analysis_id'],
      views: ['name', 'kind', 'database', 'cache_status', 'select_body', 'folder', 'implementation', 'properties', 'analysis_id'],
      global_elements: ['type', 'name', 'category', 'database', 'auth_type', 'user_type',
                        'ldap_datasource', 'ldap_username', 'description', 'privileges', 'role_type',
                        'admin_privileges', 'file_path', 'file_name', 'file_type', 'version',
                        'map_type', 'country', 'timezone', 'tag_type', 'analysis_id'],
      wrappers: ['name', 'wrapper_type', 'database', 'data_source_name', 'parameters_content',
                 'stream_tuples_config', 'parameters', 'is_excel_wrapper', 'type_of_file', 'analysis_id'],
      associations: ['name', 'kind', 'database', 'folder', 'endpoints', 'mapping', 'analysis_id'],
      webservices: ['name', 'type', 'database', 'folder', 'resource_name', 'schema_name', 'created', 'analysis_id'],
      view_stats: ['view_name', 'enabled', 'statement_type', 'database', 'statistics', 'analysis_id'],
      resource_plans: ['name', 'type', 'database', 'description', 'condition', 'action', 'parameters',
                       'full_definition', 'analysis_id'],
      resource_rules: ['name', 'type', 'database', 'description', 'condition', 'plan', 'priority',
                       'full_definition', 'analysis_id'],
      cache_data: ['name', 'database', 'cache_type', 'cache_status', 'configuration', 'analysis_id'],
      database_cache: ['database', 'enabled', 'datasource', 'ttl', 'maintainer_period', 'raw', 'analysis_id'],
      duplicates: ['type', 'connection_string', 'count', 'sources', 'similarity', 'analysis_id'],
      analysis_metadata: ['file_name', 'file_size', 'parse_time', 'timestamp', 'analysis_id'],
      parsing_progress: ['analysis_id', 'stage', 'progress', 'status'],
      tags: ['name', 'type', 'database', 'description', 'multi_tags', 'analysis_id'],
      map_entries: ['name', 'type', 'map_type', 'database', 'country', 'timezone', 'full_definition', 'analysis_id'],
      cache_configuration: ['analysis_id', 'enabled', 'database_type', 'maintenance'],
      server_configuration: ['analysis_id', 'configuration'], // timestamp is auto-populated by DEFAULT CURRENT_TIMESTAMP
      performance_metrics: ['analysis_id', 'metric', 'value', 'category'],
      role_modifications: ['name', 'granted_roles', 'admin_privileges', 'is_admin', 'analysis_id']
    };

    // Get allowed columns for this table, or use all columns if table not defined
    const allowedColumns = tableColumns[tableName] || Object.keys(convertedItems[0]).filter(col => col !== 'id');

    // Choose columns that appear in ANY item (not just the first), so sparse fields (e.g., resource_name/schema_name) are preserved
    const columns = allowedColumns.filter(col => convertedItems.some(item => Object.prototype.hasOwnProperty.call(item, col)));

    let totalInserted = 0;

    // Process in batches with multi-row INSERT for 10-100x speedup
    // Don't use explicit transactions - let DuckDB handle it internally for better concurrency
    for (let i = 0; i < convertedItems.length; i += batchSize) {
      const batch = convertedItems.slice(i, i + batchSize);

      // Build multi-row INSERT: INSERT INTO table VALUES (row1), (row2), (row3)...
      const valueRows = batch.map(item => {
        const values = columns.map(col => {
          const value = item[col];
          if (value === null || value === undefined) return "NULL";
          if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
          return `'${String(value).replace(/'/g, "''")}'`;
        });
        return `(${values.join(', ')})`;
      }).join(',\n');

      const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valueRows}`;

      try {
        await this.conn!.query(sql);
        totalInserted += batch.length;
        if (batch.length >= 100) {
          console.log(`[DuckDB] ✓ Bulk inserted ${batch.length} rows into ${tableName} (batch ${Math.floor(i / batchSize) + 1})`);
        }
      } catch (error) {
        console.error(`❌ [DuckDB] Batch insert failed for ${tableName}, trying row-by-row for this batch`, error);

        // Fallback to row-by-row for this batch only
        for (const item of batch) {
          try {
            const values = columns.map(col => {
              const value = item[col];
              if (value === null || value === undefined) return "NULL";
              if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
              return `'${String(value).replace(/'/g, "''")}'`;
            });
            await this.conn!.query(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`);
            totalInserted++;
          } catch (rowError) {
            console.error(`❌ [DuckDB] Row insert failed:`, item, rowError);
          }
        }
      }
    }

    const endTime = performance.now();
    const throughput = totalInserted / ((endTime - startTime) / 1000);
    console.log(`[DuckDB] ✓ Batch insert completed for ${tableName}: ${totalInserted} rows in ${(endTime - startTime).toFixed(2)}ms (${throughput.toFixed(0)} rows/sec)`);
  }

  private convertCamelCaseToSnakeCase(obj: any): any {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert camelCase to snake_case (don't add _ before first letter)
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      converted[snakeKey] = value;
    }
    return converted;
  }

  async getAnalysisSummary(): Promise<any> {
    const result = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM databases) as databases,
        (SELECT COUNT(*) FROM datasources) as datasources,
        (SELECT COUNT(*) FROM views) as views,
        (SELECT COUNT(*) FROM global_elements) as global_elements,
        (SELECT COUNT(*) FROM wrappers) as wrappers,
        (SELECT COUNT(*) FROM duplicates) as duplicates
    `);

    return result[0];
  }

  // Enhanced query method with detailed analytics capabilities
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.conn) throw new Error('DuckDB not initialized');

    // If params provided, use prepared statement
    if (params.length > 0) {
      const stmt = await this.conn.prepare(sql);
      const result = await stmt.query(...params);
      await stmt.close();
      return result.toArray().map(row => this.convertSnakeCaseToCamelCase(row.toJSON())) as T[];
    }

    // Otherwise, simple query
    const result = await this.conn.query(sql);
    return result.toArray().map(row => this.convertSnakeCaseToCamelCase(row.toJSON())) as T[];
  }

  private convertSnakeCaseToCamelCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.convertSnakeCaseToCamelCase(item));

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.conn) throw new Error('DuckDB not initialized');
    await this.conn.query(sql);
  }

  // Advanced analytics methods leveraging DuckDB's SQL capabilities
  async getAdvancedAnalytics(analysisId: string): Promise<any> {
    const [
      databaseStats,
      dataSourceBreakdown,
      viewComplexity,
      connectionAnalysis
    ] = await Promise.all([
      this.getDatabaseStatistics(analysisId),
      this.getDataSourceBreakdown(analysisId),
      this.getViewComplexityMetrics(analysisId),
      this.getConnectionAnalysis(analysisId)
    ]);

    return {
      databaseStats,
      dataSourceBreakdown,
      viewComplexity,
      connectionAnalysis,
      generatedAt: new Date().toISOString()
    };
  }

  private async getDatabaseStatistics(analysisId: string): Promise<any> {
    return await this.query(`
      SELECT
        d.name as database_name,
        d.denodo_version,
        COUNT(DISTINCT ds.id) as data_source_count,
        COUNT(DISTINCT v.id) as view_count,
        COUNT(DISTINCT ge.id) as global_element_count,
        COUNT(DISTINCT w.id) as wrapper_count
      FROM databases d
      LEFT JOIN data_sources ds ON d.name = ds.database
      LEFT JOIN views v ON d.name = v.database
      LEFT JOIN global_elements ge ON d.name = ge.database
      LEFT JOIN wrappers w ON ds.name = w.data_source_name
      WHERE d.analysis_id = ?
      GROUP BY d.name, d.denodo_version
      ORDER BY view_count DESC
    `, [analysisId]);
  }

  private async getDataSourceBreakdown(analysisId: string): Promise<any> {
    return await this.query(`
      SELECT
        type,
        vendor,
        COUNT(*) as count,
        COUNT(DISTINCT database) as database_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM data_sources
      WHERE analysis_id = ?
      GROUP BY type, vendor
      ORDER BY count DESC
    `, [analysisId]);
  }

  private async getViewComplexityMetrics(analysisId: string): Promise<any> {
    return await this.query(`
      SELECT
        database,
        type,
        COUNT(*) as count,
        COUNT(CASE WHEN cache_status IS NOT NULL THEN 1 END) as cached_count,
        ROUND(AVG(LENGTH(select_body)), 2) as avg_sql_length,
        MAX(LENGTH(select_body)) as max_sql_length
      FROM views
      WHERE analysis_id = ?
      GROUP BY database, type
      ORDER BY count DESC
    `, [analysisId]);
  }

  private async getConnectionAnalysis(analysisId: string): Promise<any> {
    return await this.query(`
      SELECT
        connection_string,
        vendor,
        type,
        COUNT(*) as usage_count,
        COUNT(DISTINCT database) as database_count,
        string_split(connection_string, ':')[1] as protocol
      FROM data_sources
      WHERE analysis_id = ? AND connection_string IS NOT NULL
      GROUP BY connection_string, vendor, type
      HAVING COUNT(*) > 1  -- Only show connections used by multiple sources
      ORDER BY usage_count DESC
    `, [analysisId]);
  }

  /**
   * Rebuild materialized database_stats table for fast VDB Breakdown queries
   * Call this after data ingestion or when stats are stale
   */
  async rebuildDatabaseStats(): Promise<void> {
    if (!this.conn) throw new Error('DuckDB not initialized');

    console.log('[DuckDB] 🔄 Rebuilding database statistics...');
    const startTime = performance.now();

    await this.execute('DELETE FROM database_stats');

    // Single optimized query to compute all stats at once
    // Use subqueries to avoid cartesian product from multiple LEFT JOINs
    const statsQuery = `
      INSERT INTO database_stats (
        database, data_sources, total_views, base_views, derived_views,
        interface_views, cached_views, associations
      )
      SELECT
        d.name as database,
        COALESCE((SELECT COUNT(DISTINCT id) FROM datasources WHERE database = d.name), 0) as data_sources,
        COALESCE((SELECT COUNT(DISTINCT id) FROM views WHERE database = d.name), 0) as total_views,
        COALESCE((SELECT COUNT(DISTINCT id) FROM views WHERE database = d.name AND kind = 'table'), 0) as base_views,
        COALESCE((SELECT COUNT(DISTINCT id) FROM views WHERE database = d.name AND kind = 'view'), 0) as derived_views,
        COALESCE((SELECT COUNT(DISTINCT id) FROM views WHERE database = d.name AND kind = 'interface view'), 0) as interface_views,
        COALESCE((SELECT COUNT(DISTINCT id) FROM cache_data WHERE database = d.name), 0) as cached_views,
        COALESCE((SELECT COUNT(DISTINCT id) FROM associations WHERE database = d.name), 0) as associations
      FROM databases d
    `;

    await this.execute(statsQuery);

    const endTime = performance.now();
    console.log(`[DuckDB] ✅ Database stats rebuilt in ${(endTime - startTime).toFixed(2)}ms`);
  }

  async close(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }
    console.log('[DuckDB] ✓ Database connection closed');
  }

  // Check if DuckDB is initialized
  isInitialized(): boolean {
    // Check both database connection AND that OPFS loading is complete
    return this.conn !== null && this.db !== null && !this.isLoadingFromOPFS;
  }

  // Wait for initialization to complete
  async waitForInitialization(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    while (!this.isInitialized()) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('DuckDB initialization timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // ============================================================================
  // PARQUET PERSISTENCE WITH OPFS (Origin Private File System)
  // ============================================================================

  private readonly PARQUET_FILE_NAME = 'denodo_metadata.parquet';
  private readonly OPFS_ROOT_DIR = 'denodo-analyzer';

  /**
   * Get OPFS file handle for Parquet storage
   */
  private async getOPFSFileHandle(create: boolean = false): Promise<FileSystemFileHandle | null> {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const dirHandle = await opfsRoot.getDirectoryHandle(this.OPFS_ROOT_DIR, { create });
      const fileHandle = await dirHandle.getFileHandle(this.PARQUET_FILE_NAME, { create });
      return fileHandle;
    } catch (error) {
      if (!create) return null;
      throw error;
    }
  }

  /**
   * Export all tables to Parquet file and save to OPFS
   * This is called after VQL parsing is complete
   */
  async saveToParquet(): Promise<void> {
    if (!this.conn) throw new Error('DuckDB not initialized');

    console.log('[DuckDB] 💾 Exporting data to Parquet...');
    const startTime = performance.now();

    try {
      // Get list of all tables
      const tables = await this.query<{ name: string }>(`
        SELECT table_name as name
        FROM information_schema.tables
        WHERE table_schema = 'main'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      if (tables.length === 0) {
        console.log('[DuckDB] No tables to export');
        return;
      }

      // Export each table to JSON (simpler than Parquet for browser compatibility)
      const allData: Record<string, any[]> = {};

      for (const table of tables) {
        const data = await this.query(`SELECT * FROM ${table.name}`);
        allData[table.name] = data;
      }

      // Add metadata
      const exportData = {
        tables: allData,
        exported_at: new Date().toISOString(),
        version: 1
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(exportData);
      const encoder = new TextEncoder();
      const jsonBytes = encoder.encode(jsonString);

      // Save to OPFS
      const fileHandle = await this.getOPFSFileHandle(true);
      const writable = await fileHandle!.createWritable();
      await writable.write(jsonBytes);
      await writable.close();

      const exportTime = performance.now() - startTime;
      const sizeInMB = (jsonBytes.byteLength / 1024 / 1024).toFixed(2);
      console.log(`[DuckDB] ✅ Data exported in ${exportTime.toFixed(2)}ms (${sizeInMB} MB)`);

      // Log storage info
      const estimate = await navigator.storage.estimate();
      console.log(`[DuckDB] 💾 Storage used: ${((estimate.usage || 0) / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
      console.error('[DuckDB] Failed to export:', error);
      throw error;
    }
  }

  /**
   * Load data from OPFS storage
   * This is called automatically on initialization
   */
  async loadFromParquet(): Promise<boolean> {
    if (!this.conn) throw new Error('DuckDB not initialized');

    this.isLoadingFromOPFS = true;

    try {
      console.log('[DuckDB] 📂 Checking for saved data...');

      const fileHandle = await this.getOPFSFileHandle(false);
      if (!fileHandle) {
        console.log('[DuckDB] No saved data found');
        this.isLoadingFromOPFS = false;
        return false;
      }

      const startTime = performance.now();
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();

      console.log(`[DuckDB] 📥 Loading ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB from storage...`);

      // Decode JSON
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(buffer);
      const exportData = JSON.parse(jsonString);

      if (!exportData.tables) {
        console.log('[DuckDB] Invalid data format');
        return false;
      }

      // Recreate tables from saved data
      for (const [tableName, rows] of Object.entries(exportData.tables)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        // Fix timestamp fields before inserting
        const fixedRows = rows.map((row: any) => {
          const fixed = { ...row };
          // Convert 'created' field from milliseconds to ISO string if needed
          if (fixed.created && typeof fixed.created === 'number') {
            fixed.created = new Date(fixed.created).toISOString();
          }
          return fixed;
        });

        // Insert data using batch insert
        await this.batchInsert(tableName, fixedRows as any[]);
      }

      const loadTime = performance.now() - startTime;
      console.log(`[DuckDB] ✅ Data loaded in ${loadTime.toFixed(2)}ms`);
      console.log(`[DuckDB] 📊 Data from: ${exportData.exported_at}`);

      this.isLoadingFromOPFS = false;
      return true;

    } catch (error) {
      console.log('[DuckDB] Failed to load from storage:', error);
      this.isLoadingFromOPFS = false;
      return false;
    }
  }

  /**
   * Check if currently loading from OPFS
   */
  isLoading(): boolean {
    return this.isLoadingFromOPFS;
  }

  /**
   * Check if saved data exists in OPFS
   */
  async hasSavedData(): Promise<boolean> {
    try {
      const fileHandle = await this.getOPFSFileHandle(false);
      return fileHandle !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear saved Parquet data from OPFS
   */
  async clearSavedData(): Promise<void> {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const dirHandle = await opfsRoot.getDirectoryHandle(this.OPFS_ROOT_DIR, { create: false });
      await dirHandle.removeEntry(this.PARQUET_FILE_NAME);
      console.log('[DuckDB] 🗑️ Saved data cleared');
    } catch (error) {
      console.log('[DuckDB] No saved data to clear');
    }
  }
}

// Export singleton instance
export const duckdb = new DuckDBClient();

// Auto-initialize DuckDB on import (like React's Dexie pattern)
// This runs only in browser context
if (typeof window !== 'undefined') {
  // Set loading flag IMMEDIATELY to prevent race conditions
  duckdb['isLoadingFromOPFS'] = true;

  duckdb.initialize().then(async () => {
    // Auto-load saved data from OPFS (like React's IndexedDB auto-load)
    // This makes navigation instant after page refresh
    try {
      const hasData = await duckdb.loadFromParquet();
      if (hasData) {
        console.log('[DuckDB] 🎉 Restored previous session data from OPFS');
      } else {
        console.log('[DuckDB] No saved session found - ready for new upload');
      }
    } catch (error) {
      console.log('[DuckDB] Could not load saved data:', error);
      duckdb['isLoadingFromOPFS'] = false;
    }
  }).catch((error) => {
    console.error('[DuckDB] Failed to auto-initialize:', error);
    duckdb['isLoadingFromOPFS'] = false;
  });
}
