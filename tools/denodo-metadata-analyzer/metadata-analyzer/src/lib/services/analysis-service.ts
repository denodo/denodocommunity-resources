/**
 * Analysis Service - TypeScript port with DuckDB WASM integration
 * Manages communication with Web Worker and DuckDB operations
 * Provides high-level API for file analysis and data retrieval
 */

import * as Comlink from 'comlink';
import type { DuckDBClient } from '../database/duckdb-client';
import { DuplicateDetectionService } from './duplicate-detection-service';

export interface AnalysisResults {
  databases: DatabaseWithData[];
  views: any[];
  globalElements: any[];
  wrappers: any[];
  duplicates: any[];
  cacheData: any[];
  cacheConfiguration: any;
  resourcePlans: any[];
  resourceRules: any[];
  roleModifications: any[];
  serverConfiguration: any;
  denodoVersion: string | null;
  summary: any;
  analysisMetadata: any;
  properties: Record<string, any>;
  parseTime: number;
  stats: AnalysisStats;
}

export interface AnalysisStats {
  totalDatabases: number;
  totalDataSources: number;
  totalViews: number;
  totalBaseViews: number;
  totalDerivedViews: number;
  totalInterfaceViews: number;
  totalGlobalElements: number;
  totalWrappers: number;
  totalAssociations: number;
  totalStatsEnabled: number;
  totalCachedViews: number;
  totalDuplicates: number;
}

export interface DatabaseWithData {
  name: string;
  dataSources: any[];
  views: any[];
  wrappers: any[];
  associations: any[];
  viewStats: any[];
  metrics: DatabaseMetrics;
  interfaceViewMappings: InterfaceViewMapping[];
}

export interface DatabaseMetrics {
  dataSources: number;
  views: number;
  wrappers: number;
  associations: number;
  statsEnabled: number;
  viewsByType: ViewsByType;
  viewsByCache: ViewsByCache;
  dataSourcesByType: Record<string, number>;
  cachePercentage: number | string;
}

export interface ViewsByType {
  base: number;
  derived: number;
  interface: number;
}

export interface ViewsByCache {
  full: number;
  partial: number;
  off: number;
}

export interface InterfaceViewMapping {
  interfaceView: string;
  implementation: string;
}

export interface FileUpload {
  vqlFile?: File;
  propertiesFile?: File;
}

export interface ProgressCallback {
  (progress: { stage: string; progress: number }): void;
}

/**
 * Analysis Service - handles file analysis and data retrieval with DuckDB
 */
export class AnalysisService {
  private worker: Worker | null = null;
  private workerProxy: any = null;
  private isInitialized = false;
  private currentAnalysisId: string | null = null;
  private duckdb: DuckDBClient;
  private currentProperties: Record<string, any> = {};

  constructor(duckdb: DuckDBClient) {
    this.duckdb = duckdb;
  }

  /**
   * Initialize the service and Web Worker
   */
  async initialize(): Promise<void> {
    try {
      // Create Web Worker - using streaming parsing worker
      this.worker = new Worker(
        new URL('../workers/streaming-parsing-worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Wrap worker with Comlink
      this.workerProxy = Comlink.wrap(this.worker);

      // Initialize worker
      const result = await this.workerProxy.initialize();
      if (!result.success) {
        throw new Error(result.error);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('AnalysisService initialization error:', error);
      throw error;
    }
  }

  /**
   * Start new analysis session
   */
  async startNewAnalysis(): Promise<{ success: boolean; analysisId: string; error?: string }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      const result = await this.workerProxy.startNewAnalysis();
      if (result.success) {
        this.currentAnalysisId = result.analysisId;
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Start new analysis error:', error);
      throw error;
    }
  }

  /**
   * Analyze uploaded files with optimized processing
   */
  async analyzeFiles(files: FileUpload, onProgress?: ProgressCallback): Promise<{ success: boolean; error?: string; cacheConfiguration?: any }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      const { vqlFile, propertiesFile } = files;

      // Show file size info for large files
      if (vqlFile && vqlFile.size > 100 * 1024 * 1024) {
        console.log(`Processing large VQL file: ${(vqlFile.size / 1024 / 1024).toFixed(2)} MB`);
      }

      // Start new analysis
      await this.startNewAnalysis();

      // Create progress callback that works with Comlink
      const progressCallback = onProgress ? Comlink.proxy(onProgress) : null;

      let results: any = { success: false };

      // Parse VQL file (required)
      if (vqlFile) {
        // Use streaming file reader for large files
        const vqlContent = await this.readFileOptimized(vqlFile, progressCallback || undefined);
        const analysisMetadata = {
          fileName: vqlFile.name,
          fileSize: vqlFile.size
        };

        // Parse properties file first if available
        let propertiesData = {};
        if (propertiesFile) {
          const propertiesContent = await this.readFileAsText(propertiesFile);
          propertiesData = this.parseProperties(propertiesContent);
        }

        results = await this.workerProxy.parseVQLFile(vqlContent, progressCallback, propertiesData);

        if (!results.success) {
          throw new Error(results.error);
        }
      } else {
        throw new Error('VQL file is required');
      }

      // Parse properties file (optional)
      if (propertiesFile) {
        const propertiesContent = await this.readFileAsText(propertiesFile);
        const propertiesResult = await this.workerProxy.parsePropertiesFile(propertiesContent);

        if (propertiesResult.success) {
          results.cacheConfiguration = propertiesResult.cacheConfiguration;
        }
      }

      // Analyze duplicates (pass properties for advanced detection)
      let properties: Record<string, any> | null = null;
      if (propertiesFile) {
        const propertiesContent = await this.readFileAsText(propertiesFile);
        properties = this.parseProperties(propertiesContent);

        // Store properties for later use
        this.currentProperties = properties;
      }
      await this.analyzeDuplicates(properties);

      return results;
    } catch (error) {
      console.error('Analyze files error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get analysis results from DuckDB
   */
  async getAnalysisResults(): Promise<AnalysisResults> {
    try {
      // Get data from all tables
      const [
        databases,
        dataSources,
        views,
        globalElements,
        wrappers,
        associations,
        viewStats,
        cacheData,
        duplicates,
        cacheConfig,
        serverConfig,
        resourcePlans,
        resourceRules,
        roleModifications,
        analysisMetadata
      ] = await Promise.all([
        this.duckdb.query('SELECT * FROM databases'),
        this.duckdb.query('SELECT * FROM datasources'),
        this.duckdb.query('SELECT * FROM views'),
        this.duckdb.query('SELECT * FROM global_elements'),
        this.duckdb.query('SELECT * FROM wrappers'),
        this.duckdb.query('SELECT * FROM associations'),
        this.duckdb.query('SELECT * FROM view_stats'),
        this.duckdb.query('SELECT * FROM cache_data'),
        this.duckdb.query('SELECT * FROM duplicates'),
        this.duckdb.query('SELECT * FROM cache_configuration'),
        this.duckdb.query('SELECT * FROM server_configuration'),
        this.duckdb.query('SELECT * FROM resource_plans'),
        this.duckdb.query('SELECT * FROM resource_rules'),
        this.duckdb.query('SELECT * FROM role_modifications'),
        this.duckdb.query('SELECT * FROM analysis_metadata')
      ]);

      // Get summary data
      const summary = await this.getAnalysisSummary();

      // Import DataSourceAnalyticsService for deduplication
      const { DataSourceAnalyticsService } = await import('./datasource-analytics-service');

      // Deduplicate databases and data sources to prevent duplicate counting
      const deduplicatedDatabases = DataSourceAnalyticsService.deduplicateDatabases(databases);

      // Deduplicate data sources within databases
      const uniqueDataSources = new Map<string, boolean>();
      const deduplicatedDataSources = dataSources.filter((ds: any) => {
        const key = `${ds.database}:${ds.type}:${ds.name}`;
        if (uniqueDataSources.has(key)) {
          return false;
        }
        uniqueDataSources.set(key, true);
        return true;
      });

      // Group data by database using deduplicated data
      const databasesWithData = await this.groupDataByDatabase(deduplicatedDatabases, {
        dataSources: deduplicatedDataSources,
        views,
        wrappers,
        associations,
        viewStats,
        cacheData
      });

      // Extract Denodo version from analysis metadata
      let denodoVersion: string | null = null;
      if (analysisMetadata && analysisMetadata.length > 0 && analysisMetadata[0].denodoVersion) {
        denodoVersion = analysisMetadata[0].denodoVersion;
      }

      const results: AnalysisResults = {
        databases: databasesWithData,
        views,
        globalElements,
        wrappers,
        duplicates,
        cacheData,
        cacheConfiguration: cacheConfig[0] || null,
        resourcePlans,
        resourceRules,
        roleModifications,
        serverConfiguration: serverConfig[0]?.configuration || {},
        denodoVersion,
        summary,
        analysisMetadata: analysisMetadata[0] || null,
        properties: this.currentProperties || {},
        parseTime: analysisMetadata[0]?.parseTime || 0,

        // Statistics with detailed breakdowns using kind field and deduplicated counts
        stats: {
          totalDatabases: deduplicatedDatabases.length,
          totalDataSources: deduplicatedDataSources.length,
          totalViews: views.length,
          totalBaseViews: views.filter((v: any) => v.kind === 'table').length,
          totalDerivedViews: views.filter((v: any) => v.kind === 'view').length,
          totalInterfaceViews: views.filter((v: any) => v.kind === 'interface view').length,
          totalGlobalElements: globalElements.length,
          totalWrappers: wrappers.length,
          totalAssociations: associations.length,
          totalStatsEnabled: viewStats.filter((vs: any) => vs.enabled === true).length,
          totalCachedViews: cacheData.length,
          totalDuplicates: duplicates.length
        }
      };

      return results;
    } catch (error) {
      console.error('Get analysis results error:', error);
      throw error;
    }
  }

  /**
   * Group related data by database
   */
  async groupDataByDatabase(databases: any[], data: any): Promise<DatabaseWithData[]> {
    return await Promise.all(databases.map(async (database: any): Promise<DatabaseWithData> => {
      // Get data sources for this database
      const databaseDataSources = data.dataSources.filter((ds: any) => ds.database === database.name);

      // Get views for this database
      const databaseViews = data.views.filter((v: any) => v.database === database.name);

      // Get wrappers related to data sources in this database
      const databaseWrappers = data.wrappers.filter((w: any) => {
        return databaseDataSources.some((ds: any) => ds.name === w.dataSourceName);
      });

      // Get associations for this database
      const databaseAssociations = data.associations ? data.associations.filter((a: any) => a.database === database.name) : [];

      // Get view stats for this database
      const databaseViewStats = data.viewStats ? data.viewStats.filter((vs: any) => vs.database === database.name) : [];

      // Calculate metrics - use consistent mapping from lexer grammar config
      const viewsByType: ViewsByType = {
        base: databaseViews.filter((v: any) => v.kind === 'table').length,
        derived: databaseViews.filter((v: any) => v.kind === 'view').length,
        interface: databaseViews.filter((v: any) => v.kind === 'interface view').length
      };

      // Get cached views for this database from cacheData table
      const databaseCachedViews = data.cacheData ? data.cacheData.filter((c: any) => c.database === database.name) : [];

      const viewsByCache: ViewsByCache = {
        full: databaseCachedViews.filter((c: any) => c.cacheStatus === 'full').length,
        partial: databaseCachedViews.filter((c: any) => c.cacheStatus === 'partial').length,
        off: databaseCachedViews.filter((c: any) => c.cacheStatus === 'off').length
      };

      const dataSourcesByType = this.groupByType(databaseDataSources);

      return {
        ...database,
        dataSources: databaseDataSources,
        views: databaseViews,
        wrappers: databaseWrappers,
        associations: databaseAssociations,
        viewStats: databaseViewStats,

        // Metrics
        metrics: {
          dataSources: databaseDataSources.length,
          views: databaseViews.length,
          wrappers: databaseWrappers.length,
          associations: databaseAssociations.length,
          statsEnabled: databaseViewStats.filter((vs: any) => vs.enabled === true).length,
          viewsByType,
          viewsByCache,
          dataSourcesByType,
          cachePercentage: (() => {
            if (databaseViews.length === 0) return 0;
            const cachedCount = viewsByCache.full + viewsByCache.partial;
            const exactPercentage = (cachedCount / databaseViews.length) * 100;
            // Show "<1%" when there are cached views but percentage rounds to 0 for consistency
            return cachedCount > 0 && exactPercentage < 0.5 ? "<1" : Math.round(exactPercentage);
          })()
        },

        // Interface view mappings
        interfaceViewMappings: (() => {
          const interfaceViews = databaseViews.filter((v: any) => v.kind === 'interface view');
          const interfaceViewsWithImpl = interfaceViews.filter((v: any) => v.implementation);

          return interfaceViewsWithImpl.map((v: any) => ({
            interfaceView: v.name,
            implementation: v.implementation
          }));
        })()
      };
    }));
  }

  /**
   * Group items by type
   */
  groupByType(items: any[]): Record<string, number> {
    return items.reduce((acc: Record<string, number>, item: any) => {
      const type = item.type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Analyze duplicate connections with advanced detection
   */
  async analyzeDuplicates(properties: Record<string, any> | null = null): Promise<void> {
    try {
      const duplicateService = new DuplicateDetectionService();
      let combinedProperties = properties || {};

      // Always augment with direct values from datasources
      const allDataSources = await this.duckdb.query('SELECT * FROM datasources WHERE analysis_id = ?', [this.currentAnalysisId]);

      // Convert datasources with direct values to synthetic properties
      const syntheticProperties = duplicateService.convertDataSourcesToProperties(allDataSources);

      // Merge synthetic properties with real properties (real properties take precedence)
      combinedProperties = { ...syntheticProperties, ...combinedProperties };

      // Use the existing property-based duplicate detection with combined properties
      const result = duplicateService.analyzeDuplicateConnections(combinedProperties);

      // Store duplicate analysis results (align with DuckDB duplicates schema)
      // Schema: (id, type, connection_string, count, sources, similarity, analysis_id)
      for (const duplicate of result.duplicates) {
        const connectionString = (duplicate as any).connectionString || duplicate.normalizedUri || duplicate.uri || '';
        await this.duckdb.query(
          `INSERT INTO duplicates (
            type, connection_string, count, sources, similarity, analysis_id
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            duplicate.type,
            connectionString,
            duplicate.count,
            JSON.stringify(duplicate.connections || []),
            null,
            this.currentAnalysisId
          ]
        );
      }
    } catch (error) {
      console.error('Analyze duplicates error:', error);
      // Duplicate analysis failed - continue without failing the entire process
    }
  }

  /**
   * Parse properties file content
   */
  parseProperties(content: string): Record<string, any> {
    const properties: Record<string, any> = {};
    const lines = content.split('\n');

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=');

        // Clean up the key and value, handling escaped characters
        const cleanKey = key.trim();
        const cleanValue = value.trim()
          .replace(/\\:/g, ':')  // Unescape colons
          .replace(/\\\\/g, '\\') // Unescape backslashes
          .replace(/\\=/g, '=');  // Unescape equals

        properties[cleanKey] = cleanValue;
      }
    });

    return properties;
  }

  /**
   * Get storage information from DuckDB
   */
  async getStorageInfo(): Promise<any> {
    try {
      // Get table sizes and counts
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
          const result = await this.duckdb.query(`SELECT COUNT(*) as count FROM ${table}`);
          const count = result[0]?.count || 0;
          storageInfo.tables[table] = count;
          storageInfo.totalRecords += count;
        } catch (error) {
          storageInfo.tables[table] = 0;
        }
      }

      return storageInfo;
    } catch (error) {
      console.error('Get storage info error:', error);
      return { tables: {}, totalRecords: 0 };
    }
  }

  /**
   * Optimized file reader for large files with progress tracking
   */
  async readFileOptimized(file: File, progressCallback?: ProgressCallback): Promise<string> {
    const fileSizeMB = file.size / 1024 / 1024;

    // For small files, use regular FileReader
    if (fileSizeMB < 50) {
      return this.readFileAsText(file);
    }

    // For large files, use streaming ArrayBuffer to reduce memory pressure
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onprogress = (e) => {
        if (e.lengthComputable && progressCallback) {
          const progress = (e.loaded / e.total) * 10; // First 10% for file reading
          progressCallback({
            stage: `Loading file (${(e.loaded / 1024 / 1024).toFixed(1)}MB / ${fileSizeMB.toFixed(1)}MB)`,
            progress: progress
          });
        }
      };

      reader.onload = (e) => {
        try {
          // Use ArrayBuffer -> Uint8Array -> TextDecoder to reduce memory pressure
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          const textDecoder = new TextDecoder('utf-8');

          // Process in smaller chunks to avoid memory spikes
          const chunkSize = 4 * 1024 * 1024; // 4MB chunks
          let result = '';

          for (let offset = 0; offset < uint8Array.length; offset += chunkSize) {
            const chunk = uint8Array.slice(offset, offset + chunkSize);
            result += textDecoder.decode(chunk, { stream: offset + chunkSize < uint8Array.length });

            // Force garbage collection hint after each chunk
            if (typeof window !== 'undefined' && (window as any).gc) {
              (window as any).gc();
            }
          }

          if (progressCallback) {
            progressCallback({
              stage: 'File loaded, starting parser...',
              progress: 10
            });
          }

          resolve(result);
        } catch (decodeError) {
          reject(decodeError);
        }
      };

      reader.onerror = (error) => {
        reject(error);
      };

      // Use ArrayBuffer instead of Text to reduce initial memory pressure
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Read file as text (for smaller files)
   */
  async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Get analysis summary
   */
  private async getAnalysisSummary(): Promise<any> {
    try {
      // Get basic counts
      const counts = await Promise.all([
        this.duckdb.query('SELECT COUNT(*) as count FROM databases'),
        this.duckdb.query('SELECT COUNT(*) as count FROM datasources'),
        this.duckdb.query('SELECT COUNT(*) as count FROM views'),
        this.duckdb.query('SELECT COUNT(*) as count FROM global_elements')
      ]);

      return {
        totalDatabases: counts[0][0]?.count || 0,
        totalDataSources: counts[1][0]?.count || 0,
        totalViews: counts[2][0]?.count || 0,
        totalGlobalElements: counts[3][0]?.count || 0,
        lastAnalyzed: new Date().toISOString()
      };
    } catch (error) {
      console.error('Get analysis summary error:', error);
      return {
        totalDatabases: 0,
        totalDataSources: 0,
        totalViews: 0,
        totalGlobalElements: 0,
        lastAnalyzed: new Date().toISOString()
      };
    }
  }

  /**
   * Export analysis results to JSON
   */
  async exportToJSON(): Promise<void> {
    try {
      const results = await this.getAnalysisResults();

      const exportData = {
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        data: results
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `denodo-analysis-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export to JSON error:', error);
      throw error;
    }
  }

  /**
   * Cleanup service and worker
   */
  async cleanup(): Promise<void> {
    if (this.workerProxy) {
      await this.workerProxy.cleanup();
    }

    if (this.worker) {
      this.worker.terminate();
    }

    this.isInitialized = false;
  }
}
