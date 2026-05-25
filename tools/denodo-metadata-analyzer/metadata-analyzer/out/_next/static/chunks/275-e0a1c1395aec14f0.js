"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[275],{2275:function(e,a,t){t.d(a,{$:function(){return i},duckdb:function(){return n}});var s=t(1284);class i{async initialize(){try{let e,a;let t=new s.df;try{e=await s.Dn({mvp:{mainModule:"/duckdb-mvp.wasm",mainWorker:"/duckdb-browser-mvp.worker.js"},eh:{mainModule:"/duckdb-eh.wasm",mainWorker:"/duckdb-browser-eh.worker.js"}}),a=new Worker(e.mainWorker)}catch(i){try{let e=await s.Dn(s.sq());this.db=new s.ak(t),await this.db.instantiate(e.mainModule,e.pthreadWorker),this.conn=await this.db.connect(),await this.initializeSchema();return}catch(o){let t=s.sq();e=await s.Dn(t);let i=await fetch(e.mainWorker),n=await i.blob(),E=URL.createObjectURL(n);a=new Worker(E)}}this.db=new s.ak(t,a),await this.db.instantiate(e.mainModule,e.pthreadWorker),this.conn=await this.db.connect(),await this.initializeSchema()}catch(e){throw console.error("[DuckDB] Failed to initialize:",e),e}}async initializeSchema(){await this.execute(`
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
    `),await this.execute(`
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
    `),await this.execute(`
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
    `)}async clearAnalysisData(){for(let e of["databases","datasources","views","global_elements","wrappers","associations","view_stats","cache_data","database_cache","duplicates","analysis_metadata","parsing_progress","cache_configuration","server_configuration","performance_metrics","resource_plans","resource_rules","role_modifications","database_stats"])await this.execute(`DELETE FROM ${e}`);for(let e of["databases_id_seq","data_sources_id_seq","views_id_seq","global_elements_id_seq","wrappers_id_seq","associations_id_seq","view_stats_id_seq","cache_data_id_seq","database_cache_id_seq","duplicates_id_seq","analysis_metadata_id_seq","parsing_progress_id_seq","cache_configuration_id_seq","server_configuration_id_seq","performance_metrics_id_seq","resource_plans_id_seq","resource_rules_id_seq","role_modifications_id_seq"])await this.execute(`ALTER SEQUENCE ${e} RESTART WITH 1`)}async batchInsert(e,a){let t=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1e3;if(!a||0===a.length)return;let s=performance.now(),i=a.map(e=>this.convertCamelCaseToSnakeCase(e)),n=(({databases:["name","denodo_version","created","analysis_id"],datasources:["name","type","database","url","driver","database_name","database_version","username","classpath","vendor","class_name","folder","route_type","route_connection","web_service_type","wsdl_location","server_name","dsn","connection_string","properties","analysis_id"],views:["name","kind","database","cache_status","select_body","folder","implementation","properties","analysis_id"],global_elements:["type","name","category","database","auth_type","user_type","ldap_datasource","ldap_username","description","privileges","role_type","admin_privileges","file_path","file_name","file_type","version","map_type","country","timezone","tag_type","analysis_id"],wrappers:["name","wrapper_type","database","data_source_name","parameters_content","stream_tuples_config","parameters","is_excel_wrapper","type_of_file","analysis_id"],associations:["name","kind","database","folder","endpoints","mapping","analysis_id"],webservices:["name","type","database","folder","resource_name","schema_name","created","analysis_id"],view_stats:["view_name","enabled","statement_type","database","statistics","analysis_id"],resource_plans:["name","type","database","description","condition","action","parameters","full_definition","analysis_id"],resource_rules:["name","type","database","description","condition","plan","priority","full_definition","analysis_id"],cache_data:["name","database","cache_type","cache_status","configuration","analysis_id"],database_cache:["database","enabled","datasource","ttl","maintainer_period","raw","analysis_id"],duplicates:["type","connection_string","count","sources","similarity","analysis_id"],analysis_metadata:["file_name","file_size","parse_time","timestamp","analysis_id"],parsing_progress:["analysis_id","stage","progress","status"],tags:["name","type","database","description","multi_tags","analysis_id"],map_entries:["name","type","map_type","database","country","timezone","full_definition","analysis_id"],cache_configuration:["analysis_id","enabled","database_type","maintenance"],server_configuration:["analysis_id","configuration"],performance_metrics:["analysis_id","metric","value","category"],role_modifications:["name","granted_roles","admin_privileges","is_admin","analysis_id"]})[e]||Object.keys(i[0]).filter(e=>"id"!==e)).filter(e=>i.some(a=>Object.prototype.hasOwnProperty.call(a,e))),E=0;for(let a=0;a<i.length;a+=t){let s=i.slice(a,a+t),o=s.map(e=>{let a=n.map(a=>{let t=e[a];return null==t?"NULL":"object"==typeof t?`'${JSON.stringify(t).replace(/'/g,"''")}'`:`'${String(t).replace(/'/g,"''")}'`});return`(${a.join(", ")})`}).join(",\n"),r=`INSERT INTO ${e} (${n.join(", ")}) VALUES ${o}`;try{await this.conn.query(r),E+=s.length,s.length>=100&&console.log(`[DuckDB] ✓ Bulk inserted ${s.length} rows into ${e} (batch ${Math.floor(a/t)+1})`)}catch(a){for(let t of(console.error(`❌ [DuckDB] Batch insert failed for ${e}, trying row-by-row for this batch`,a),s))try{let a=n.map(e=>{let a=t[e];return null==a?"NULL":"object"==typeof a?`'${JSON.stringify(a).replace(/'/g,"''")}'`:`'${String(a).replace(/'/g,"''")}'`});await this.conn.query(`INSERT INTO ${e} (${n.join(", ")}) VALUES (${a.join(", ")})`),E++}catch(e){console.error(`❌ [DuckDB] Row insert failed:`,t,e)}}}let o=performance.now(),r=E/((o-s)/1e3);console.log(`[DuckDB] ✓ Batch insert completed for ${e}: ${E} rows in ${(o-s).toFixed(2)}ms (${r.toFixed(0)} rows/sec)`)}convertCamelCaseToSnakeCase(e){let a={};for(let[t,s]of Object.entries(e))a[t.replace(/([A-Z])/g,"_$1").toLowerCase().replace(/^_/,"")]=s;return a}async getAnalysisSummary(){return(await this.query(`
      SELECT
        (SELECT COUNT(*) FROM databases) as databases,
        (SELECT COUNT(*) FROM datasources) as datasources,
        (SELECT COUNT(*) FROM views) as views,
        (SELECT COUNT(*) FROM global_elements) as global_elements,
        (SELECT COUNT(*) FROM wrappers) as wrappers,
        (SELECT COUNT(*) FROM duplicates) as duplicates
    `))[0]}async query(e){let a=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[];if(!this.conn)throw Error("DuckDB not initialized");if(a.length>0){let t=await this.conn.prepare(e),s=await t.query(...a);return await t.close(),s.toArray().map(e=>this.convertSnakeCaseToCamelCase(e.toJSON()))}return(await this.conn.query(e)).toArray().map(e=>this.convertSnakeCaseToCamelCase(e.toJSON()))}convertSnakeCaseToCamelCase(e){if(!e||"object"!=typeof e)return e;if(Array.isArray(e))return e.map(e=>this.convertSnakeCaseToCamelCase(e));let a={};for(let[t,s]of Object.entries(e))a[t.replace(/_([a-z])/g,(e,a)=>a.toUpperCase())]=s;return a}async execute(e){if(arguments.length>1&&void 0!==arguments[1]&&arguments[1],!this.conn)throw Error("DuckDB not initialized");await this.conn.query(e)}async getAdvancedAnalytics(e){let[a,t,s,i]=await Promise.all([this.getDatabaseStatistics(e),this.getDataSourceBreakdown(e),this.getViewComplexityMetrics(e),this.getConnectionAnalysis(e)]);return{databaseStats:a,dataSourceBreakdown:t,viewComplexity:s,connectionAnalysis:i,generatedAt:new Date().toISOString()}}async getDatabaseStatistics(e){return await this.query(`
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
    `,[e])}async getDataSourceBreakdown(e){return await this.query(`
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
    `,[e])}async getViewComplexityMetrics(e){return await this.query(`
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
    `,[e])}async getConnectionAnalysis(e){return await this.query(`
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
    `,[e])}async rebuildDatabaseStats(){if(!this.conn)throw Error("DuckDB not initialized");console.log("[DuckDB] \uD83D\uDD04 Rebuilding database statistics...");let e=performance.now();await this.execute("DELETE FROM database_stats");let a=`
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
    `;await this.execute(a);let t=performance.now();console.log(`[DuckDB] ✅ Database stats rebuilt in ${(t-e).toFixed(2)}ms`)}async close(){this.conn&&(await this.conn.close(),this.conn=null),this.db&&(await this.db.terminate(),this.db=null),console.log("[DuckDB] ✓ Database connection closed")}isInitialized(){return null!==this.conn&&null!==this.db&&!this.isLoadingFromOPFS}async waitForInitialization(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:3e4,a=Date.now();for(;!this.isInitialized();){if(Date.now()-a>e)throw Error("DuckDB initialization timeout");await new Promise(e=>setTimeout(e,100))}}async getOPFSFileHandle(){let e=arguments.length>0&&void 0!==arguments[0]&&arguments[0];try{let a=await navigator.storage.getDirectory(),t=await a.getDirectoryHandle(this.OPFS_ROOT_DIR,{create:e});return await t.getFileHandle(this.PARQUET_FILE_NAME,{create:e})}catch(a){if(!e)return null;throw a}}async saveToParquet(){if(!this.conn)throw Error("DuckDB not initialized");console.log("[DuckDB] \uD83D\uDCBE Exporting data to Parquet...");let e=performance.now();try{let a=await this.query(`
        SELECT table_name as name
        FROM information_schema.tables
        WHERE table_schema = 'main'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);if(0===a.length){console.log("[DuckDB] No tables to export");return}let t={};for(let e of a){let a=await this.query(`SELECT * FROM ${e.name}`);t[e.name]=a}let s={tables:t,exported_at:new Date().toISOString(),version:1},i=JSON.stringify(s),n=new TextEncoder().encode(i),E=await this.getOPFSFileHandle(!0),o=await E.createWritable();await o.write(n),await o.close();let r=performance.now()-e,d=(n.byteLength/1024/1024).toFixed(2);console.log(`[DuckDB] ✅ Data exported in ${r.toFixed(2)}ms (${d} MB)`);let _=await navigator.storage.estimate();console.log(`[DuckDB] 💾 Storage used: ${((_.usage||0)/1024/1024).toFixed(2)} MB`)}catch(e){throw console.error("[DuckDB] Failed to export:",e),e}}async loadFromParquet(){if(!this.conn)throw Error("DuckDB not initialized");this.isLoadingFromOPFS=!0;try{console.log("[DuckDB] \uD83D\uDCC2 Checking for saved data...");let e=await this.getOPFSFileHandle(!1);if(!e)return console.log("[DuckDB] No saved data found"),this.isLoadingFromOPFS=!1,!1;let a=performance.now(),t=await e.getFile(),s=await t.arrayBuffer();console.log(`[DuckDB] 📥 Loading ${(s.byteLength/1024/1024).toFixed(2)} MB from storage...`);let i=new TextDecoder().decode(s),n=JSON.parse(i);if(!n.tables)return console.log("[DuckDB] Invalid data format"),!1;for(let[e,a]of Object.entries(n.tables)){if(!Array.isArray(a)||0===a.length)continue;let t=a.map(e=>{let a={...e};return a.created&&"number"==typeof a.created&&(a.created=new Date(a.created).toISOString()),a});await this.batchInsert(e,t)}let E=performance.now()-a;return console.log(`[DuckDB] ✅ Data loaded in ${E.toFixed(2)}ms`),console.log(`[DuckDB] 📊 Data from: ${n.exported_at}`),this.isLoadingFromOPFS=!1,!0}catch(e){return console.log("[DuckDB] Failed to load from storage:",e),this.isLoadingFromOPFS=!1,!1}}isLoading(){return this.isLoadingFromOPFS}async hasSavedData(){try{let e=await this.getOPFSFileHandle(!1);return null!==e}catch{return!1}}async clearSavedData(){try{let e=await navigator.storage.getDirectory(),a=await e.getDirectoryHandle(this.OPFS_ROOT_DIR,{create:!1});await a.removeEntry(this.PARQUET_FILE_NAME),console.log("[DuckDB] \uD83D\uDDD1️ Saved data cleared")}catch(e){console.log("[DuckDB] No saved data to clear")}}constructor(){this.db=null,this.conn=null,this.isLoadingFromOPFS=!1,this.PARQUET_FILE_NAME="denodo_metadata.parquet",this.OPFS_ROOT_DIR="denodo-analyzer"}}let n=new i;n.isLoadingFromOPFS=!0,n.initialize().then(async()=>{try{await n.loadFromParquet()?console.log("[DuckDB] \uD83C\uDF89 Restored previous session data from OPFS"):console.log("[DuckDB] No saved session found - ready for new upload")}catch(e){console.log("[DuckDB] Could not load saved data:",e),n.isLoadingFromOPFS=!1}}).catch(e=>{console.error("[DuckDB] Failed to auto-initialize:",e),n.isLoadingFromOPFS=!1})}}]);