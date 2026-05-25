/**
 * Streaming Parsing Web Worker - TypeScript exact port
 * Enhanced version using modular parsers and ParserRegistry for reliable parsing
 * Replaces brittle regex-based statement splitting with quotes/comments aware parsing
 */

import * as Comlink from 'comlink';
import { DuckDBClient } from '../database/duckdb-client';
import { ParserRegistry } from '../parsers/parser-registry';

export interface WorkerInitResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface AnalysisStartResult {
  success: boolean;
  analysisId: string;
  message?: string;
  error?: string;
}

export interface ParseResult {
  success: boolean;
  analysisId?: string;
  parseTime?: number;
  summary?: any;
  finalCounts?: any;
  errors?: any[];
  cacheConfiguration?: any;
  propertiesCount?: number;
  error?: string;
}

export interface ProgressUpdate {
  stage: string;
  progress: number;
  analysisId?: string;
  processedStatements?: number;
  currentDatabase?: string;
}

export interface ParseResults {
  databases: any[];
  dataSources: any[];
  views: any[];
  globalElements: any[];
  wrappers: any[];
  resourcePlans: any[];
  resourceRules: any[];
  webServices: any[];
  associations: any[];
  viewStats: any[];
  cacheData: any[];
  roleModifications: any[];
  serverConfiguration: any;
  parseErrors: any[];
}

export interface ViewRegistryEntry {
  name: string;
  database: string;
  statementType: string;
  hasCreateCache: boolean;
}

export interface Counters {
  orphans: number;
  alterViewsClassified: number;
  alterViewsWithoutCache: number;
}

class StreamingParsingWorker {
  private duckdb: DuckDBClient | null = null;
  private parserRegistry: ParserRegistry | null = null;
  private isInitialized = false;
  private currentAnalysisId: string | null = null;
  private userStatementsProcessed = 0;

  constructor() {
    this.duckdb = null;
    this.parserRegistry = null;
    this.isInitialized = false;
    this.currentAnalysisId = null;
  }

  /**
   * Initialize the worker with database and parsers
   */
  async initialize(): Promise<WorkerInitResult> {
    try {
      // Initialize DuckDB
      this.duckdb = new DuckDBClient();
      await this.duckdb.initialize();

      // Initialize parser registry
      this.parserRegistry = new ParserRegistry(this.duckdb);

      this.isInitialized = true;

      return { success: true, message: 'Worker initialized' };
    } catch (error) {
      console.error('Failed to initialize streaming parsing worker:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error'
      };
    }
  }

  /**
   * Start new analysis - clear previous data and set up new analysis
   */
  async startNewAnalysis(analysisMetadata: any = {}): Promise<AnalysisStartResult> {
    if (!this.isInitialized) {
      throw new Error('Worker not initialized');
    }

    try {
      // Clear all previous analysis data
      await this.clearAnalysisData();

      // Generate new analysis ID
      this.currentAnalysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Reset parser registry state
      if (this.parserRegistry) {
        this.parserRegistry.setCurrentDatabase(null);
      }

      // Store analysis metadata
      if (this.duckdb) {
        await this.duckdb.query(`
          INSERT INTO analysis_metadata (
            analysis_id, file_name, file_size, timestamp, status
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          this.currentAnalysisId,
          analysisMetadata.fileName || 'unknown',
          analysisMetadata.fileSize || 0,
          new Date().toISOString(),
          'started'
        ]);
      }

      return {
        success: true,
        analysisId: this.currentAnalysisId,
        message: 'New analysis started'
      };
    } catch (error) {
      console.error('Failed to start new analysis:', error);
      return {
        success: false,
        analysisId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse VQL file content with streaming parser processing
   */
  async parseVQLFile(
    fileContent: string,
    onProgress: ((progress: ProgressUpdate) => void) | null = null,
    propertiesData: Record<string, any> = {}
  ): Promise<ParseResult> {
    if (!this.isInitialized || !this.currentAnalysisId) {
      throw new Error('Worker not initialized or no active analysis');
    }

    try {
      const startTime = Date.now();

      // Extract Denodo version from VQL file
      const denodoVersion = this.extractDenodoVersion(fileContent);
      if (denodoVersion) {
        console.log(`📋 Detected Denodo version: ${denodoVersion}`);
      }

      // Update progress
      if (onProgress) {
        await onProgress({
          stage: 'Initializing streaming parser',
          progress: 0,
          analysisId: this.currentAnalysisId
        });
      }

      // Use streaming parser to parse statements
      const parseResults = await this.streamingParseVQL(fileContent, onProgress);

      // Parse server configuration separately if properties provided
      if (Object.keys(propertiesData).length > 0) {
        if (onProgress) {
          await onProgress({
            stage: 'Processing server configuration',
            progress: 87,
            analysisId: this.currentAnalysisId
          });
        }

        try {
          const serverConfig = await this.parseServerConfiguration(fileContent, propertiesData);
          parseResults.serverConfiguration = serverConfig;
        } catch (error) {
          console.warn('Server configuration parsing failed:', error);
          parseResults.serverConfiguration = {};
        }
      }

      // Store server configuration separately
      if (parseResults.serverConfiguration && Object.keys(parseResults.serverConfiguration).length > 0) {
        if (onProgress) {
          await onProgress({
            stage: 'Storing server configuration',
            progress: 95,
            analysisId: this.currentAnalysisId
          });
        }

        await this.duckdb!.query(`
          INSERT INTO server_configuration (
            analysis_id, configuration, timestamp
          ) VALUES (?, ?, ?)
        `, [
          this.currentAnalysisId,
          JSON.stringify(parseResults.serverConfiguration),
          new Date().toISOString()
        ]);
      }

      const parseTime = Date.now() - startTime;

      // Update analysis metadata
      await this.duckdb!.query(`
        UPDATE analysis_metadata
        SET parse_time = ?, status = ?, completed_at = ?, denodo_version = ?
        WHERE analysis_id = ?
      `, [
        parseTime,
        'completed',
        new Date().toISOString(),
        denodoVersion,
        this.currentAnalysisId
      ]);

      // Final progress update
      if (onProgress) {
        await onProgress({
          stage: 'Parsing complete',
          progress: 100,
          analysisId: this.currentAnalysisId
        });
      }

      // Get summary statistics from database
      const summary = await this.getAnalysisSummary();

      // Get final counts from database to verify all items were stored
      const finalCounts = {
        databases: (await this.duckdb!.query('SELECT COUNT(*) as count FROM databases'))[0]?.count || 0,
        dataSources: (await this.duckdb!.query('SELECT COUNT(*) as count FROM datasources'))[0]?.count || 0,
        views: (await this.duckdb!.query('SELECT COUNT(*) as count FROM views'))[0]?.count || 0,
        globalElements: (await this.duckdb!.query('SELECT COUNT(*) as count FROM global_elements'))[0]?.count || 0,
        wrappers: (await this.duckdb!.query('SELECT COUNT(*) as count FROM wrappers'))[0]?.count || 0,
        associations: (await this.duckdb!.query('SELECT COUNT(*) as count FROM associations'))[0]?.count || 0
      };

      return {
        success: true,
        analysisId: this.currentAnalysisId,
        parseTime: parseTime,
        summary: summary,
        finalCounts: finalCounts,
        errors: parseResults.parseErrors || []
      };

    } catch (error) {
      console.error('VQL parsing failed:', error);

      // Update analysis metadata with error
      if (this.currentAnalysisId) {
        await this.duckdb!.query(`
          UPDATE analysis_metadata
          SET status = ?, error = ?, failed_at = ?
          WHERE analysis_id = ?
        `, [
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
          new Date().toISOString(),
          this.currentAnalysisId
        ]);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        analysisId: this.currentAnalysisId
      };
    }
  }

  /**
   * Streaming VQL parser using parser registry
   */
  async streamingParseVQL(content: string, onProgress: ((progress: ProgressUpdate) => void) | null = null): Promise<ParseResults> {
    const results: ParseResults = {
      databases: [],
      dataSources: [],
      views: [],
      globalElements: [],
      wrappers: [],
      resourcePlans: [],
      resourceRules: [],
      webServices: [],
      associations: [],
      viewStats: [],
      cacheData: [],
      roleModifications: [],
      serverConfiguration: {},
      parseErrors: []
    };

    // View registry for matching CREATE statements (database context) with ALTER statements (cache info)
    const viewRegistry = new Map<string, ViewRegistryEntry>();
    const counters: Counters = {
      orphans: 0,
      alterViewsClassified: 0,
      alterViewsWithoutCache: 0
    };

    // MEMORY OPTIMIZATION: Increase chunk size to avoid splitting DATASOURCE statements with complex folder paths
    const chunkSize = 2 * 1024 * 1024; // 2MB chunks to handle complex statements
    const totalChunks = Math.ceil(content.length / chunkSize);
    let processedChunks = 0;
    let processedStatements = 0;

    // Track wrapper statement counts (simplified)
    let totalWrapperStatements = 0;
    let classifiedWrapperStatements = 0;
    let processedWrapperStatements = 0;
    let storedWrapperStatements = 0;

    // Track CUSTOM datasource statements specifically
    let totalCustomDatasourceStatements = 0;
    let classifiedCustomDatasourceStatements = 0;
    let processedCustomDatasourceStatements = 0;

    // Track association statements
    let totalAssociationStatements = 0;
    let classifiedAssociationStatements = 0;
    let processedAssociationStatements = 0;

    // Track VIEWSTATSUMMARY statements
    let totalViewStatsStatements = 0;
    let classifiedViewStatsStatements = 0;
    let processedViewStatsStatements = 0;

    // Use ParserRegistry to parse content
    const parseResults = await this.parserRegistry!.parseContent(content, 'uploaded_file.vql');

    // Process each parsed result
    for (const result of parseResults) {
      try {
        // Count statement types
        const statementType = result.statementType;
        if (statementType === 'WRAPPER') {
          totalWrapperStatements++;
          classifiedWrapperStatements++;
          processedWrapperStatements++;
        }

        if (statementType === 'DATASOURCE_CUSTOM' || (result.data.type === 'CUSTOM' && statementType === 'DATASOURCE')) {
          totalCustomDatasourceStatements++;
          classifiedCustomDatasourceStatements++;
          processedCustomDatasourceStatements++;
        }

        if (statementType === 'ASSOCIATION') {
          totalAssociationStatements++;
          classifiedAssociationStatements++;
          processedAssociationStatements++;
        }

        if (statementType === 'VIEWSTATSUMMARY') {
          totalViewStatsStatements++;
          classifiedViewStatsStatements++;
          processedViewStatsStatements++;
        }

        // Add to appropriate result collection based on statement type
        this.categorizeResult(result.data, results, viewRegistry, counters);
        processedStatements++;

        // MEMORY OPTIMIZATION: Batch store results periodically to reduce memory usage
        if (processedStatements % 1000 === 0) {
          storedWrapperStatements += results.wrappers.length;
          await this.storeIntermediateResults(results);
          // Clear processed results from memory after storing
          this.clearResultsMemory(results);
        }

      } catch (error) {
        console.warn(`Error processing statement ${processedStatements + 1}:`, error instanceof Error ? error.message : 'Unknown error');
        results.parseErrors.push({
          parser: 'StreamingParser',
          error: error instanceof Error ? error.message : 'Unknown error',
          statementIndex: processedStatements,
          statement: result.statement.substring(0, 200) + '...',
          timestamp: new Date().toISOString()
        });
      }
    }

    processedChunks = totalChunks; // Mark as complete

    // Progress updates
    if (onProgress) {
      const progress = 85;
      await onProgress({
        stage: `Processing complete - ${processedStatements} statements`,
        progress: progress,
        analysisId: this.currentAnalysisId || undefined,
        processedStatements: processedStatements,
        currentDatabase: this.parserRegistry?.getCurrentDatabase() || undefined
      });
    }

    // Store any remaining results
    await this.storeIntermediateResults(results);

    // Only show warnings for significant discrepancies
    if (totalWrapperStatements - classifiedWrapperStatements > 5) {
      console.warn(`${totalWrapperStatements - classifiedWrapperStatements} WRAPPER statements were found but NOT classified`);
    }
    if (totalCustomDatasourceStatements - classifiedCustomDatasourceStatements > 5) {
      console.warn(`${totalCustomDatasourceStatements - classifiedCustomDatasourceStatements} CUSTOM DATASOURCE statements were found but NOT classified`);
    }

    return results;
  }

  /**
   * Store intermediate results to reduce memory pressure
   */
  async storeIntermediateResults(results: ParseResults): Promise<void> {
    try {
      const storePromises: Promise<any>[] = [];
      const counts = {
        databases: results.databases.length,
        dataSources: results.dataSources.length,
        views: results.views.length,
        globalElements: results.globalElements.length,
        wrappers: results.wrappers.length,
        associations: results.associations.length,
        viewStats: results.viewStats.length,
        cacheData: results.cacheData.length,
        resourcePlans: results.resourcePlans.length,
        resourceRules: results.resourceRules.length,
        roleModifications: results.roleModifications.length
      };

      if (results.databases.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('databases', results.databases));
      }
      if (results.dataSources.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('datasources', results.dataSources));
      }
      if (results.views.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('views', results.views));
      }
      if (results.globalElements.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('global_elements', results.globalElements));
      }
      if (results.wrappers.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('wrappers', results.wrappers));
      }
      if (results.associations.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('associations', results.associations));
      }
      if (results.viewStats.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('view_stats', results.viewStats));
      }
      if (results.cacheData.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('cache_data', results.cacheData));
      }
      if (results.resourcePlans.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('resource_plans', results.resourcePlans));
      }
      if (results.resourceRules.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('resource_rules', results.resourceRules));
      }
      if (results.roleModifications.length > 0) {
        storePromises.push(this.duckdb!.batchInsert('role_modifications', results.roleModifications));
      }

      await Promise.all(storePromises);

    } catch (error) {
      console.error('Failed to store intermediate results:', error);
      // Don't throw - continue processing
    }
  }

  /**
   * Clear results from memory after storing to DuckDB
   */
  clearResultsMemory(results: ParseResults): void {
    // Keep arrays but clear their contents to reduce memory pressure
    results.databases.length = 0;
    results.dataSources.length = 0;
    results.views.length = 0;
    results.globalElements.length = 0;
    results.wrappers.length = 0;
    results.associations.length = 0;
    results.viewStats.length = 0;
    results.cacheData.length = 0;
    results.webServices.length = 0;
    results.resourcePlans.length = 0;
    results.resourceRules.length = 0;
    results.roleModifications.length = 0;
    // Keep parseErrors for final reporting
  }

  /**
   * Categorize processed statement data into result collections
   */
  categorizeResult(processedData: any, results: ParseResults, viewRegistry: Map<string, ViewRegistryEntry>, counters: Counters): void {
    const { statementType } = processedData;

    switch (statementType) {
      case 'DATABASE':
        results.databases.push(this.normalizeDatabase(processedData));
        break;

      case 'USE_DATABASE':
        // Create database entry for CONNECT/USE DATABASE statements (e.g., admin database)
        const systemDatabase = {
          name: processedData.name,
          type: 'system_database', // Mark as system database for special styling
          isSystemDatabase: true, // Flag to distinguish from user databases
          timestamp: processedData.timestamp,
          currentDatabase: processedData.name
        };
        results.databases.push(this.normalizeDatabase(systemDatabase));
        break;

      case 'VIEW':
      case 'INTERFACE_VIEW':
      case 'TABLE':
        const normalizedView = this.normalizeView(processedData);
        results.views.push(normalizedView);

        // Register this view in the registry with correct database context
        viewRegistry.set(processedData.name, {
          name: processedData.name,
          database: processedData.currentDatabase,
          statementType: processedData.statementType,
          hasCreateCache: processedData.cacheStatus && processedData.cacheStatus !== 'off'
        });

        // If this CREATE statement has cache status, add to cache data immediately
        if (processedData.cacheStatus && processedData.cacheStatus !== 'off') {
          results.cacheData.push(this.normalizeCacheData(processedData));
        }
        break;

      case 'ALTER_VIEW':
        counters.alterViewsClassified++;

        // Handle ALTER VIEW cache statements using registry for correct database context
        if (processedData.cacheStatus && processedData.cacheStatus !== 'off') {
          const registeredView = viewRegistry.get(processedData.name);

          if (registeredView) {
            // Use database from CREATE statement, cache info from ALTER statement
            const cacheData = {
              ...processedData,
              currentDatabase: registeredView.database, // CORRECT database from CREATE
              statementType: registeredView.statementType // Original statement type
            };

            // Only add if CREATE statement didn't already have cache (avoid duplicates)
            if (!registeredView.hasCreateCache) {
              results.cacheData.push(this.normalizeCacheData(cacheData));
            }
          } else {
            counters.orphans++;
          }
        } else {
          counters.alterViewsWithoutCache++;
        }
        break;

      case 'DATASOURCE_JDBC':
      case 'DATASOURCE_CUSTOM':
      case 'DATASOURCE_DF':
      case 'DATASOURCE_JSON':
      case 'DATASOURCE_XML':
      case 'DATASOURCE_WS':
      case 'DATASOURCE_MONGODB':
      case 'DATASOURCE_SALESFORCE':
      case 'DATASOURCE_LDAP':
      case 'DATASOURCE_ODBC':
      case 'REST_WEBSERVICE':
        const normalized = this.normalizeDataSource(processedData);
        results.dataSources.push(normalized);
        break;

      case 'WRAPPER':
        results.wrappers.push(this.normalizeWrapper(processedData));
        break;

      case 'ASSOCIATION':
        results.associations.push(this.normalizeAssociation(processedData));
        break;

      case 'viewstatsummary':
      case 'VIEWSTATSUMMARY':
        results.viewStats.push(this.normalizeViewStats(processedData));
        break;

      case 'ALTER_ROLE':
        results.roleModifications.push(this.normalizeRoleModification(processedData));
        break;

      case 'USER':
        this.userStatementsProcessed = (this.userStatementsProcessed || 0) + 1;
        results.globalElements.push(this.normalizeGlobalElement(processedData));
        break;
      case 'ROLE':
      case 'JAR':
      case 'MAP':
        results.globalElements.push(this.normalizeGlobalElement(processedData));
        break;

      case 'TAG':
        // Handle multi-tag statements that have multiple tags
        if (processedData.multiTags && processedData.multiTags.tags) {
          processedData.multiTags.tags.forEach((tagName: string) => {
            const normalizedTag = this.normalizeGlobalElement({
              name: tagName,
              type: 'tag',
              description: processedData.multiTags.description,
              currentDatabase: processedData.currentDatabase,
              timestamp: processedData.timestamp
            });
            results.globalElements.push(normalizedTag);
          });
        } else {
          // Single tag statement
          results.globalElements.push(this.normalizeGlobalElement(processedData));
        }
        break;

      case 'WEBSERVICE':
        results.webServices.push(this.normalizeWebService(processedData));
        break;

      case 'RESOURCE_MANAGER_PLAN':
        results.resourcePlans.push(this.normalizeResourcePlan(processedData));
        break;

      case 'RESOURCE_MANAGER_RULE':
        results.resourceRules.push(this.normalizeResourceRule(processedData));
        break;

      default:
        // Ignore unknown statement types
        break;
    }
  }

  /**
   * Normalize database data
   */
  normalizeDatabase(data: any): any {
    const normalized = {
      analysis_id: this.currentAnalysisId,
      name: data.name,
      type: data.type || 'database',
      timestamp: data.timestamp
    };

    // Add system database flag for special handling
    if (data.isSystemDatabase) {
      (normalized as any).is_system_database = true;
    }

    return normalized;
  }

  /**
   * Normalize view data
   */
  normalizeView(data: any): any {
    const normalized = {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      kind: data.kind,
      timestamp: data.timestamp
    };

    // Include implementation for interface views
    if (data.implementation) {
      (normalized as any).implementation = data.implementation;
    }

    // Include SELECT body for view complexity analysis
    if (data.selectBody) {
      (normalized as any).select_body = data.selectBody;
    }

    // Include cache status for cache tracking
    if (data.cacheStatus) {
      (normalized as any).cache_status = data.cacheStatus;
    }

    return normalized;
  }

  /**
   * Normalize datasource data
   */
  normalizeDataSource(data: any): any {
    const normalized = {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      type: data.type,
      timestamp: data.timestamp
    };

    // Add common fields
    if (data.url) (normalized as any).url = data.url;
    if (data.driver) (normalized as any).driver = data.driver;
    if (data.className) (normalized as any).class_name = data.className;

    // Add JDBC-specific fields and vendor detection
    if (data.databaseName) (normalized as any).database_name = data.databaseName;
    if (data.databaseVersion) (normalized as any).database_version = data.databaseVersion;
    if (data.username) (normalized as any).username = data.username;
    if (data.classpath) (normalized as any).classpath = data.classpath;
    if (data.driverClassName) (normalized as any).driver_class_name = data.driverClassName;
    if (data.databaseUri) (normalized as any).database_uri = data.databaseUri;

    // Use extracted vendor field or detect for JDBC connections
    if (data.vendor) {
      (normalized as any).vendor = data.vendor;
    } else if (data.type === 'JDBC') {
      (normalized as any).vendor = this.detectJdbcVendor(data.databaseName, data.driver, data.url);
    }

    // Add route fields for file-based datasources
    if (data.routeType) (normalized as any).route_type = data.routeType;
    if (data.routeConnection) (normalized as any).route_connection = data.routeConnection;

    // Add ODBC-specific fields
    if (data.dsn) (normalized as any).dsn = data.dsn;

    // Add LDAP-specific fields
    if (data.serverName) (normalized as any).server_name = data.serverName;

    // Add web service fields
    if (data.webServiceType) (normalized as any).web_service_type = data.webServiceType;
    if (data.wsdlLocation) (normalized as any).wsdl_location = data.wsdlLocation;
    if (data.endpoint) (normalized as any).endpoint = data.endpoint;

    return normalized;
  }

  /**
   * Normalize wrapper data
   */
  normalizeWrapper(data: any): any {
    const normalized = {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      wrapper_type: data.wrapperType,
      timestamp: data.timestamp
    };

    // Add datasource reference if present
    if (data.dataSourceName) {
      (normalized as any).datasource_name = data.dataSourceName;
    }

    // Add stream tuples configuration if present
    if (data.streamTuplesConfig) {
      (normalized as any).stream_tuples_config = JSON.stringify(data.streamTuplesConfig);
    }

    // Add parameters if present
    if (data.parameters) {
      (normalized as any).parameters = JSON.stringify(data.parameters);
    }

    // Add Excel detection fields from grammar config processors
    if (data.isExcelWrapper !== undefined) {
      (normalized as any).is_excel_wrapper = data.isExcelWrapper;
    }

    if (data.excelWrapperType) {
      (normalized as any).excel_wrapper_type = data.excelWrapperType;
    }

    return normalized;
  }

  /**
   * Normalize association data
   */
  normalizeAssociation(data: any): any {
    const normalized = {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      folder: data.folder,
      kind: data.kind || 'association',
      timestamp: data.timestamp
    };

    // Add endpoints if present
    if (data.endpoints) {
      (normalized as any).endpoints = JSON.stringify(data.endpoints);
    }

    // Add mapping if present
    if (data.mapping) {
      (normalized as any).mapping = JSON.stringify(data.mapping);
    }

    return normalized;
  }

  /**
   * Normalize view stats data
   */
  normalizeViewStats(data: any): any {
    const normalized = {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      view_name: data.viewName,
      enabled: data.enabled || false,
      statement_type: data.statementType,
      timestamp: data.timestamp
    };

    return normalized;
  }

  /**
   * Normalize cache data
   */
  normalizeCacheData(data: any): any {
    const normalized = {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      cache_type: data.statementType,  // VIEW, INTERFACE_VIEW, or TABLE
      cache_status: data.cacheStatus,  // 'full' or 'partial'
      timestamp: data.timestamp
    };

    return normalized;
  }

  /**
   * Normalize global element data
   */
  normalizeGlobalElement(data: any): any {
    const normalized = {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      type: data.type,
      timestamp: data.timestamp
    };

    // Add type-specific fields
    if (data.mapType) (normalized as any).map_type = data.mapType;
    if (data.description) (normalized as any).description = data.description;

    // Add MAP-specific fields
    if (data.type === 'map') {
      if (data.country) (normalized as any).country = data.country;
      if (data.timezone) (normalized as any).timezone = data.timezone;
      if (data.fullDefinition) (normalized as any).full_definition = data.fullDefinition;
    }

    // Add USER-specific authentication fields
    if (data.type === 'user') {
      if (data.authType) (normalized as any).auth_type = data.authType;
      if (data.userType) (normalized as any).user_type = data.userType;
      if (data.passwordType) (normalized as any).password_type = data.passwordType;
      if (data.ldapDatasource) (normalized as any).ldap_datasource = data.ldapDatasource;
      if (data.ldapUsername) (normalized as any).ldap_username = data.ldapUsername;
      if (data.hasPrivileges) (normalized as any).has_privileges = data.hasPrivileges;
      if (data.assignPrivilegesRole) (normalized as any).assign_privileges_role = data.assignPrivilegesRole;
    }

    return normalized;
  }

  /**
   * Normalize web service data
   */
  normalizeWebService(data: any): any {
    return {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      type: data.type || 'WEBSERVICE',
      timestamp: data.timestamp
    };
  }

  /**
   * Normalize resource plan data
   */
  normalizeResourcePlan(data: any): any {
    return {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      type: 'resource_plan',
      description: data.description,
      condition: data.condition,
      action: data.action,
      parameters: data.parameters ? JSON.stringify(data.parameters) : null,
      full_definition: data.fullDefinition,
      timestamp: data.timestamp
    };
  }

  /**
   * Normalize resource rule data
   */
  normalizeResourceRule(data: any): any {
    return {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      type: 'resource_rule',
      description: data.description,
      condition: data.condition,
      plan: data.plan,
      priority: data.priority,
      full_definition: data.fullDefinition,
      timestamp: data.timestamp
    };
  }

  /**
   * Normalize role modification data (ALTER ROLE statements)
   */
  normalizeRoleModification(data: any): any {
    return {
      analysis_id: this.currentAnalysisId,
      database: data.currentDatabase,
      name: data.name,
      type: 'alter_role',
      granted_roles: data.grantedRoles ? JSON.stringify(data.grantedRoles) : null,
      admin_privileges: data.adminPrivileges ? JSON.stringify(data.adminPrivileges) : null,
      is_admin: data.isAdmin || false,
      full_definition: data.fullDefinition,
      timestamp: data.timestamp
    };
  }

  /**
   * Extract Denodo version from VQL content
   */
  extractDenodoVersion(content: string): string | null {
    try {
      const lines = content.split('\n').slice(0, 50); // Check first 50 lines
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#') && trimmedLine.includes('Generated with Denodo Platform')) {
          // Extract everything after "Denodo Platform " until end of line
          const versionMatch = trimmedLine.match(/Denodo Platform (.+)$/);
          if (versionMatch) {
            return versionMatch[1].trim();
          }
        }
      }
    } catch (error) {
      console.warn('Error extracting Denodo version from VQL:', error);
    }
    return null;
  }

  /**
   * Parse server configuration using existing ServerConfigParser
   */
  async parseServerConfiguration(vqlContent: string, propertiesData: Record<string, any>): Promise<any> {
    try {
      console.log('[Worker] parseServerConfiguration called with', Object.keys(propertiesData).length, 'properties');
      // Use our TypeScript ServerConfigParser
      const { default: ServerConfigParser } = await import('../parsers/specialized/server-config-parser');
      const parser = new ServerConfigParser(this.duckdb!);
      const results = await parser.parse(vqlContent, undefined, propertiesData);

      if (results.length > 0) {
        console.log('[Worker] ServerConfig parsed successfully:', results[0].data);
        return results[0].data;
      }
      return {};
    } catch (error) {
      console.warn('⚠️ Server configuration parsing failed:', error);
      return {};
    }
  }

  /**
   * Parse properties file content
   */
  async parsePropertiesFile(fileContent: string): Promise<ParseResult> {
    if (!this.isInitialized || !this.currentAnalysisId) {
      throw new Error('Worker not initialized or no active analysis');
    }

    try {
      const properties = this.parsePropertiesContent(fileContent);
      const cacheConfig = this.analyzeCacheConfiguration(properties);

      // Store cache configuration in DuckDB
      if (cacheConfig) {
        await this.duckdb!.query(`
          INSERT INTO cache_configuration (
            analysis_id, enabled, database_type, database_uri, maintenance,
            max_threads, jvm_settings, cost_optimization, data_movement, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          this.currentAnalysisId,
          cacheConfig.enabled,
          cacheConfig.databaseType,
          cacheConfig.databaseUri,
          cacheConfig.maintenance,
          cacheConfig.maxThreads,
          cacheConfig.jvmSettings,
          cacheConfig.costOptimization,
          cacheConfig.dataMovement,
          new Date().toISOString()
        ]);
      }

      return {
        success: true,
        analysisId: this.currentAnalysisId,
        cacheConfiguration: cacheConfig,
        propertiesCount: Object.keys(properties).length
      };

    } catch (error) {
      console.error('Properties parsing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse properties file content into key-value pairs
   */
  parsePropertiesContent(content: string): Record<string, any> {
    const properties: Record<string, any> = {};
    const lines = content.split('\n');

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=');

        const cleanKey = key.trim();
        const cleanValue = value.trim()
          .replace(/\\:/g, ':')
          .replace(/\\\\/g, '\\')
          .replace(/\\=/g, '=');

        properties[cleanKey] = cleanValue;
      }
    });

    return properties;
  }

  /**
   * Analyze cache configuration from properties
   */
  analyzeCacheConfiguration(properties: Record<string, any>): any {
    const cacheInfo: any = {
      enabled: false,
      databaseType: null,
      databaseUri: null,
      maintenance: false,
      maxThreads: null,
      jvmSettings: null,
      costOptimization: false,
      dataMovement: false
    };

    // Check cache status
    const cacheStatus = properties['config.PROPERTY.com.denodo.vdb.cache.cacheStatus'];
    if (cacheStatus) {
      cacheInfo.enabled = cacheStatus.toUpperCase() === 'ON';
    }

    // Extract database information if cache is enabled
    if (cacheInfo.enabled) {
      const cacheDbUri = properties['databases.admin.datasources.jdbc.vdpcachedatasource.DATABASEURI'];
      if (cacheDbUri) {
        cacheInfo.databaseUri = cacheDbUri;

        // Extract database type from JDBC URI
        const jdbcMatch = cacheDbUri.match(/^jdbc\\?:([^:]+):/);
        if (jdbcMatch) {
          let dbType = jdbcMatch[1].toLowerCase();

          // Normalize database type names
          const typeMapping: Record<string, string> = {
            'postgresql': 'PostgreSQL',
            'sqlserver': 'SQL Server',
            'mysql': 'MySQL',
            'oracle': 'Oracle',
            'h2': 'H2'
          };

          cacheInfo.databaseType = typeMapping[dbType] ||
            (dbType.charAt(0).toUpperCase() + dbType.slice(1));
        }
      }
    }

    // Check other cache settings
    const cacheMaintenance = properties['config.PROPERTY.com.denodo.vdb.cache.cacheMaintenance'];
    if (cacheMaintenance) {
      cacheInfo.maintenance = cacheMaintenance.toUpperCase() === 'ON';
    }

    const maxThreads = properties['config.PROPERTY.com.denodo.vdb.engine.thread.ThreadPool.maxThreads'];
    if (maxThreads) {
      cacheInfo.maxThreads = parseInt(maxThreads);
    }

    const jvmSettings = properties['config.PROPERTY.java.env.DENODO_OPTS_START'];
    if (jvmSettings) {
      cacheInfo.jvmSettings = jvmSettings.replace(/\\:/g, ':').replace(/\\=/g, '=');
    }

    const costOptimization = properties['config.PROPERTY.com.denodo.vdb.interpreter.execution.SelectAction.costoptimization'];
    if (costOptimization) {
      cacheInfo.costOptimization = costOptimization.toLowerCase() === 'true';
    }

    const dataMovement = properties['config.PROPERTY.com.denodo.vdb.interpreter.execution.SelectAction.dataMovement'];
    if (dataMovement) {
      cacheInfo.dataMovement = dataMovement.toLowerCase() === 'true';
    }

    return cacheInfo;
  }

  /**
   * Get analysis summary
   */
  async getAnalysisSummary(): Promise<any> {
    try {
      const [
        databaseCount,
        dataSourceCount,
        viewCount,
        globalElementCount
      ] = await Promise.all([
        this.duckdb!.query('SELECT COUNT(*) as count FROM databases WHERE analysis_id = ?', [this.currentAnalysisId]),
        this.duckdb!.query('SELECT COUNT(*) as count FROM datasources WHERE analysis_id = ?', [this.currentAnalysisId]),
        this.duckdb!.query('SELECT COUNT(*) as count FROM views WHERE analysis_id = ?', [this.currentAnalysisId]),
        this.duckdb!.query('SELECT COUNT(*) as count FROM global_elements WHERE analysis_id = ?', [this.currentAnalysisId])
      ]);

      return {
        totalDatabases: databaseCount[0]?.count || 0,
        totalDataSources: dataSourceCount[0]?.count || 0,
        totalViews: viewCount[0]?.count || 0,
        totalGlobalElements: globalElementCount[0]?.count || 0,
        analysisId: this.currentAnalysisId,
        lastAnalyzed: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting analysis summary:', error);
      return {
        totalDatabases: 0,
        totalDataSources: 0,
        totalViews: 0,
        totalGlobalElements: 0,
        analysisId: this.currentAnalysisId,
        lastAnalyzed: new Date().toISOString()
      };
    }
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<any> {
    try {
      const tables = [
        'databases', 'datasources', 'views', 'global_elements', 'wrappers',
        'associations', 'view_stats', 'cache_data', 'duplicates',
        'cache_configuration', 'server_configuration', 'resource_plans',
        'resource_rules', 'role_modifications', 'analysis_metadata', 'tags', 'map_entries'
      ];

      const storageInfo: any = {
        tables: {},
        totalRecords: 0
      };

      for (const table of tables) {
        try {
          const result = await this.duckdb!.query(`SELECT COUNT(*) as count FROM ${table}`);
          const count = result[0]?.count || 0;
          storageInfo.tables[table] = count;
          storageInfo.totalRecords += count;
        } catch (error) {
          storageInfo.tables[table] = 0;
        }
      }

      return storageInfo;
    } catch (error) {
      console.error('Error getting storage info:', error);
      return { tables: {}, totalRecords: 0 };
    }
  }

  /**
   * Detect JDBC database vendor from URL and driver info
   * Based on vql_insights.ts detectVendor function
   */
  detectJdbcVendor(databaseName: string, driver: string, url: string): string {
    const u = (url || '').toLowerCase();
    const d = (driver || '').toLowerCase();

    // Vendor detection patterns from vql_insights.ts
    const pairs: [string, string[]][] = [
      ['Oracle', ['jdbc:oracle:', 'oracle.jdbc', 'thin:@']],
      ['SQL Server', ['jdbc:sqlserver:', 'microsoft.sqlserver', 'sqlserverdriver']],
      ['PostgreSQL', ['jdbc:postgresql:', 'org.postgresql']],
      ['MySQL', ['jdbc:mysql:', 'com.mysql', 'mysql.cj']],
      ['MariaDB', ['jdbc:mariadb:', 'org.mariadb']],
      ['DB2', ['jdbc:db2:', 'ibm.db2']],
      ['Snowflake', ['jdbc:snowflake:', 'snowflake']],
      ['Redshift', ['jdbc:redshift:', 'redshift']],
      ['SAP HANA', ['jdbc:sap:', 'sap.db.jdbc', 'hana']],
      ['Teradata', ['jdbc:teradata:', 'teradata']],
      ['Vertica', ['jdbc:vertica:', 'vertica']],
      ['Sybase', ['jdbc:sybase:', 'sybase']],
      ['BigQuery', ['simba.googlebigquery', 'jdbc:bigquery:', 'bigquery']],
      ['Athena', ['jdbc:awsathena', 'jdbc:athena:', 'athena']],
      ['Trino/Presto', ['jdbc:trino:', 'jdbc:presto:', 'trino', 'presto']],
      ['SQLite', ['jdbc:sqlite:', 'sqlite']],
      ['Denodo', ['jdbc:denodo:']],
      ['Derby', ['jdbc:derby:']]
    ];

    // Check URL and driver patterns
    for (const [vendor, needles] of pairs) {
      if (needles.some(needle => u.includes(needle) || d.includes(needle))) {
        return vendor;
      }
    }

    // Fallback: extract scheme from JDBC URL
    if (u.startsWith('jdbc:')) {
      const parts = u.split(':');
      if (parts.length >= 2) {
        // Capitalize first letter
        const scheme = parts[1];
        return scheme.charAt(0).toUpperCase() + scheme.slice(1);
      }
    }

    // Final fallback: use databaseName if available, otherwise 'Unknown'
    return databaseName || 'Unknown';
  }

  /**
   * Clear all analysis data from DuckDB
   */
  async clearAnalysisData(): Promise<void> {
    try {
      const tables = [
        'databases', 'datasources', 'views', 'global_elements', 'wrappers',
        'associations', 'view_stats', 'cache_data', 'duplicates',
        'cache_configuration', 'server_configuration', 'resource_plans',
        'resource_rules', 'role_modifications', 'analysis_metadata', 'tags', 'map_entries'
      ];

      for (const table of tables) {
        try {
          await this.duckdb!.query(`DELETE FROM ${table}`);
        } catch (error) {
          console.warn(`Warning: Could not clear table ${table}:`, error);
        }
      }
    } catch (error) {
      console.error('Error clearing analysis data:', error);
    }
  }

  /**
   * Cleanup and terminate worker
   */
  async cleanup(): Promise<void> {
    try {
      if (this.duckdb) {
        // DuckDB cleanup if needed
        this.duckdb = null;
      }
      this.parserRegistry = null;
      this.isInitialized = false;
      this.currentAnalysisId = null;
    } catch (error) {
      console.warn('Worker cleanup warning:', error);
    }
  }
}

// Create worker instance
const parsingWorker = new StreamingParsingWorker();

// Expose worker methods via Comlink
Comlink.expose(parsingWorker);