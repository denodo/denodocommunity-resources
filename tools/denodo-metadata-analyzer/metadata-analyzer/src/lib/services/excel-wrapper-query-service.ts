/**
 * ExcelWrapperQueryService - TypeScript port with DuckDB WASM integration
 * Direct DuckDB queries to find Excel wrappers and analyze stream tuples
 * Bypasses any parsing issues to get accurate counts from stored data
 */

import type { DuckDBClient } from '../database/duckdb-client';

export interface ExcelWrapperResult {
  excelWrappers: ExcelWrapper[];
  streamTuplesStats: StreamTuplesStats;
  detailedStats: DetailedStats;
}

export interface ExcelWrapper {
  name: string;
  database: string;
  dataSourceName?: string;
  folder?: string;
  wrapperType?: string;
  parameters?: Record<string, any>;
  streamTuplesConfig?: StreamTuplesConfig;
  streamTuples?: boolean | string;
  detectionMethods: string[];
  streamTuplesValue?: any;
  streamEnabled: boolean;
  streamDisabled: boolean;
  streamUnconfigured: boolean;
  isExcelWrapper: boolean;
}

export interface StreamTuplesStats {
  total: number;
  enabled: number;
  disabled: number;
  unconfigured?: number;
}

export interface DetailedStats {
  totalWrappers: number;
  customWrappers: number;
  byMethod: {
    typeOfFile: number;
    datasourceClassname: number;
    parameters: number;
    fileExtension: number;
    wrapperName: number;
    combined: number;
  };
  disabledWrappers: DisabledWrapper[];
}

export interface DisabledWrapper {
  name: string;
  database: string;
  dataSourceName?: string;
  folder?: string;
  streamTuplesValue: any;
  parameters?: Record<string, any>;
}

export interface StreamTuplesConfig {
  enabled?: boolean;
  disabled?: boolean;
  configured?: boolean;
  value?: any;
  rawValue?: any;
  streamTuples?: boolean;
}

export interface StreamTuplesAnalysisResult {
  excelWrapperCount: number;
  streamTuplesStats: StreamTuplesStats;
  disabledWrappers: DisabledWrapper[];
}

/**
 * ExcelWrapperQueryService - Direct DuckDB queries for Excel wrapper analysis
 */
export class ExcelWrapperQueryService {
  // Simple cache to prevent multiple identical queries
  private static _cache: ExcelWrapperResult | null = null;
  private static _cacheTimestamp: number | null = null;
  private static readonly CACHE_DURATION = 30000; // 30 seconds

  private duckdb: DuckDBClient;

  constructor(duckdb: DuckDBClient) {
    this.duckdb = duckdb;
  }

  /**
   * Query DuckDB directly to find all Excel wrappers based on datasource className and wrapper parameters
   */
  async findExcelWrappers(): Promise<ExcelWrapperResult> {
    // Check cache first to prevent duplicate queries
    const now = Date.now();
    if (ExcelWrapperQueryService._cache &&
        ExcelWrapperQueryService._cacheTimestamp &&
        (now - ExcelWrapperQueryService._cacheTimestamp) < ExcelWrapperQueryService.CACHE_DURATION) {
      console.log('🔍 Returning cached Excel wrapper results...');
      return ExcelWrapperQueryService._cache;
    }

    try {
      console.log('🔍 Querying DuckDB for Excel wrappers...');

      // Step 1: Get all datasources and find Excel ones by className
      const allDataSources = await this.duckdb.query('SELECT * FROM datasources');
      console.log(`📊 Found ${allDataSources.length} total datasources in DuckDB`);

      // DEBUG: Show breakdown by type and className
      const typeBreakdown: Record<string, number> = {};
      const classNameBreakdown: Record<string, number> = {};

      allDataSources.forEach((ds: any) => {
        typeBreakdown[ds.type] = (typeBreakdown[ds.type] || 0) + 1;
        if (ds.class_name) {
          classNameBreakdown[ds.class_name] = (classNameBreakdown[ds.class_name] || 0) + 1;
        }
      });

      console.log('📊 Datasource type breakdown:', typeBreakdown);
      console.log('📊 Datasource className breakdown:', classNameBreakdown);

      // Deduplicate data sources first
      const uniqueDataSources = new Map<string, boolean>();
      const deduplicatedDataSources = allDataSources.filter((ds: any) => {
        const key = `${ds.database}:${ds.type}:${ds.name}`;
        if (uniqueDataSources.has(key)) {
          console.log(`🔄 Skipping duplicate data source: ${key}`);
          return false;
        }
        uniqueDataSources.set(key, true);
        return true;
      });

      console.log(`🔄 DataSource deduplication: ${allDataSources.length} → ${deduplicatedDataSources.length}`);

      const excelDataSources = new Set<string>();
      deduplicatedDataSources.forEach((ds: any) => {
        // Enhanced Excel datasource detection - handle case variations and multiple possible classNames
        const isExcelDataSource = (ds.type === 'CUSTOM' || ds.type === 'Custom') && (
          ds.class_name === 'com.denodo.vdb.contrib.wrapper.xls.ExcelWrapper' ||
          ds.class_name === 'com.denodo.wrapper.xls.ExcelWrapper' ||
          ds.class_name === 'ExcelWrapper' ||
          (ds.class_name && ds.class_name.toLowerCase().includes('excel'))
        );

        if (isExcelDataSource) {
          excelDataSources.add(ds.name);
          console.log(`🎯 Found Excel datasource: ${ds.name} -> ${ds.class_name} (type: ${ds.type}, folder: ${ds.folder || 'none'})`);
        }
      });

      console.log(`📊 Found ${excelDataSources.size} Excel datasources by className`);
      console.log('🎯 Excel datasource names:', Array.from(excelDataSources));

      // Step 2: Get all wrappers from DuckDB - focus on Excel datasource references
      const allWrappers = await this.duckdb.query('SELECT * FROM wrappers');
      console.log(`📊 Found ${allWrappers.length} total wrappers in DuckDB`);

      // Debug: Show breakdown by wrapper type
      const allWrapperTypeStats: Record<string, number> = {};
      allWrappers.forEach((wrapper: any) => {
        const type = wrapper.wrapper_type || 'UNKNOWN';
        allWrapperTypeStats[type] = (allWrapperTypeStats[type] || 0) + 1;
      });
      console.log(`📊 All wrappers from DB by type:`, allWrapperTypeStats);

      // Filter for CUSTOM wrappers that reference Excel datasources (primary method)
      const excelWrappersByDatasource = allWrappers.filter((wrapper: any) => {
        return (wrapper.wrapper_type === 'CUSTOM' || wrapper.wrapper_type === 'Custom') &&
               wrapper.datasource_name &&
               excelDataSources.has(wrapper.datasource_name);
      });

      console.log(`🎯 Found ${excelWrappersByDatasource.length} CUSTOM wrappers referencing Excel datasources`);

      // DEBUG: Show which datasources are referenced by wrappers
      const referencedDataSources = new Set<string>();
      excelWrappersByDatasource.forEach((wrapper: any) => {
        referencedDataSources.add(wrapper.datasource_name);
      });
      console.log('📊 Excel datasources referenced by wrappers:', Array.from(referencedDataSources));

      // DEBUG: Find unreferenced Excel datasources
      const unreferencedDataSources: string[] = [];
      excelDataSources.forEach(dsName => {
        if (!referencedDataSources.has(dsName)) {
          unreferencedDataSources.push(dsName);
        }
      });

      if (unreferencedDataSources.length > 0) {
        console.warn(`⚠️ Found ${unreferencedDataSources.length} Excel datasources without wrapper references:`, unreferencedDataSources);
      }

      // Also find any other CUSTOM wrappers with Excel indicators (secondary method)
      const otherExcelWrappers = allWrappers.filter((wrapper: any) => {
        if (wrapper.wrapper_type !== 'CUSTOM' && wrapper.wrapper_type !== 'Custom') return false;
        if (excelWrappersByDatasource.some((ew: any) => ew.name === wrapper.name && ew.database === wrapper.database)) {
          return false; // Already found by datasource method
        }

        // Check for Excel indicators in parameters
        if (wrapper.parameters) {
          let parameters: Record<string, any>;
          try {
            parameters = typeof wrapper.parameters === 'string' ? JSON.parse(wrapper.parameters) : wrapper.parameters;
          } catch {
            return false;
          }

          const hasExcelTypeOfFile = Object.keys(parameters).some(key => {
            if (key.toLowerCase().includes('type') && key.toLowerCase().includes('file')) {
              const value = parameters[key]?.toString()?.toLowerCase() || '';
              return value.includes('excel') || value.includes('xls');
            }
            return false;
          });

          if (hasExcelTypeOfFile) return true;

          // Check for Excel file extensions
          const hasExcelFile = Object.keys(parameters).some(key => {
            if (key.toLowerCase().includes('file') && key.toLowerCase().includes('location')) {
              const value = parameters[key]?.toString()?.toLowerCase() || '';
              return value.includes('.xls') || value.includes('.xlsx');
            }
            return false;
          });

          if (hasExcelFile) return true;
        }

        return false;
      });

      console.log(`🔍 Found ${otherExcelWrappers.length} additional CUSTOM wrappers with Excel indicators`);

      // Combine both methods and deduplicate by wrapper identity
      const allExcelWrappers = [...excelWrappersByDatasource, ...otherExcelWrappers];
      const uniqueExcelWrappers = new Map<string, boolean>();
      const deduplicatedExcelWrappers = allExcelWrappers.filter((wrapper: any) => {
        const key = `${wrapper.name}:${wrapper.database || 'NONE'}:${wrapper.folder || 'NONE'}`;
        if (uniqueExcelWrappers.has(key)) {
          return false;
        }
        uniqueExcelWrappers.set(key, true);
        return true;
      });

      console.log(`📊 Total unique Excel wrappers: ${deduplicatedExcelWrappers.length} (${excelWrappersByDatasource.length} by datasource + ${otherExcelWrappers.length} by indicators, deduplicated)`);

      if (deduplicatedExcelWrappers.length === 0) {
        console.log('⚠️ No Excel wrappers found - VQL file may not have been processed yet');
        return {
          excelWrappers: [],
          streamTuplesStats: { total: 0, enabled: 0, disabled: 0 },
          detailedStats: {
            totalWrappers: 0,
            customWrappers: 0,
            byMethod: { typeOfFile: 0, datasourceClassname: 0, parameters: 0, fileExtension: 0, wrapperName: 0, combined: 0 },
            disabledWrappers: []
          }
        };
      }

      // Analyze the Excel wrappers for stream tuples configuration
      const excelWrappers: ExcelWrapper[] = [];
      const stats = {
        total: deduplicatedExcelWrappers.length,
        customWrappers: deduplicatedExcelWrappers.length,
        excelByTypeOfFile: 0,
        excelByDatasourceClassname: excelWrappersByDatasource.length,
        excelByParameters: otherExcelWrappers.length,
        excelByFileExtension: 0,
        excelByWrapperName: 0,
        excelTotal: deduplicatedExcelWrappers.length,
        streamTuplesEnabled: 0,
        streamTuplesDisabled: 0,
        streamTuplesUnconfigured: 0,
        disabledWrappers: [] as DisabledWrapper[]
      };

      console.log('🔍 Analyzing Excel wrappers for stream tuples configuration...');
      console.log(`🎯 Processing ${deduplicatedExcelWrappers.length} confirmed Excel wrappers`);

      // Enhanced parameter key analysis - check all common variations
      const parameterKeyVariations = new Set<string>();
      deduplicatedExcelWrappers.slice(0, 20).forEach((wrapper: any) => {
        if (wrapper.parameters) {
          let parameters: Record<string, any>;
          try {
            parameters = typeof wrapper.parameters === 'string' ? JSON.parse(wrapper.parameters) : wrapper.parameters;
            Object.keys(parameters).forEach(key => {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes('type') || lowerKey.includes('file') ||
                  lowerKey.includes('excel') || lowerKey.includes('xls') ||
                  lowerKey.includes('sheet') || lowerKey.includes('location') ||
                  lowerKey.includes('stream') || lowerKey.includes('tuples')) {
                parameterKeyVariations.add(key);
              }
            });
          } catch {
            // Ignore parsing errors
          }
        }
      });
      console.log('🔍 Parameter key variations found:', Array.from(parameterKeyVariations));

      // Debug: Show database distribution of Excel wrappers
      const excelWrappersByDatabase: Record<string, number> = {};
      deduplicatedExcelWrappers.forEach((wrapper: any) => {
        const db = wrapper.database || 'unknown';
        excelWrappersByDatabase[db] = (excelWrappersByDatabase[db] || 0) + 1;
      });
      console.log('📊 Excel wrappers by database:', excelWrappersByDatabase);

      // Process each Excel wrapper for stream tuples analysis
      deduplicatedExcelWrappers.forEach((wrapper: any, index: number) => {
        // Debug: Log wrapper data structure for first few Excel wrappers
        if (index < 10) {
          console.log(`🔧 Debug Excel wrapper ${index + 1}:`, {
            name: wrapper.name,
            wrapperType: wrapper.wrapper_type,
            dataSourceName: wrapper.datasource_name,
            database: wrapper.database,
            hasParameters: !!wrapper.parameters,
            hasStreamTuplesConfig: !!wrapper.stream_tuples_config,
            streamTuples: wrapper.stream_tuples
          });
        }

        // All wrappers here are already confirmed Excel wrappers - analyze stream tuples
        stats.excelTotal++;

        // Enhanced stream tuples configuration analysis
        let streamEnabled = false;
        let streamDisabled = false;
        let streamUnconfigured = false;
        let streamTuplesValue: any = undefined;

        // Parse parameters if they exist
        let parameters: Record<string, any> = {};
        if (wrapper.parameters) {
          try {
            parameters = typeof wrapper.parameters === 'string' ? JSON.parse(wrapper.parameters) : wrapper.parameters;
          } catch {
            parameters = {};
          }
        }

        // Parse stream tuples config if it exists
        let streamTuplesConfig: StreamTuplesConfig | undefined;
        if (wrapper.stream_tuples_config) {
          try {
            streamTuplesConfig = typeof wrapper.stream_tuples_config === 'string'
              ? JSON.parse(wrapper.stream_tuples_config)
              : wrapper.stream_tuples_config;
          } catch {
            streamTuplesConfig = undefined;
          }
        }

        // Check for streamTuplesConfig from lexer architecture (most reliable)
        if (streamTuplesConfig) {
          streamTuplesValue = streamTuplesConfig.value;
          streamEnabled = streamTuplesConfig.enabled === true;
          streamDisabled = streamTuplesConfig.disabled === true;

          console.log(`🌊 Found streamTuplesConfig for ${wrapper.name}:`, {
            enabled: streamTuplesConfig.enabled,
            disabled: streamTuplesConfig.disabled,
            value: streamTuplesConfig.value
          });
        }
        // Check direct streamTuples property
        else if (wrapper.stream_tuples !== undefined) {
          streamTuplesValue = wrapper.stream_tuples;
          if (wrapper.stream_tuples === true || wrapper.stream_tuples === 'true') {
            streamEnabled = true;
          } else if (wrapper.stream_tuples === false || wrapper.stream_tuples === 'false') {
            streamDisabled = true;
          }
          console.log(`🌊 Found direct streamTuples for ${wrapper.name}: ${streamTuplesValue} (${typeof streamTuplesValue})`);
        }
        // Fallback: Check for 'Stream tuples' parameter (most reliable for VQL parsing)
        else if (Object.keys(parameters).length > 0) {
          const paramKeys = Object.keys(parameters);
          const streamTuplesKey = paramKeys.find(key =>
            key.toLowerCase() === 'stream tuples' ||
            key.toLowerCase() === 'streamtuples' ||
            key === 'Stream tuples'
          );

          if (streamTuplesKey) {
            streamTuplesValue = parameters[streamTuplesKey];
            console.log(`🌊 Found Stream tuples parameter for ${wrapper.name}: "${streamTuplesKey}" = ${streamTuplesValue} (${typeof streamTuplesValue})`);

            if (streamTuplesValue === true || streamTuplesValue === 'true') {
              streamEnabled = true;
            } else if (streamTuplesValue === false || streamTuplesValue === 'false') {
              streamDisabled = true;
            }
          } else {
            // If no stream tuples configuration found, consider it unconfigured
            streamUnconfigured = true;
            console.log(`🌊 No stream tuples configuration found for ${wrapper.name} - considering as unconfigured`);
          }
        } else {
          streamUnconfigured = true;
        }

        // Update statistics based on stream tuples analysis
        if (streamEnabled) {
          stats.streamTuplesEnabled++;
          console.log(`🌊 Stream tuples ENABLED for ${wrapper.name} (value: ${streamTuplesValue})`);
        } else if (streamDisabled) {
          stats.streamTuplesDisabled++;
          stats.disabledWrappers.push({
            name: wrapper.name,
            database: wrapper.database || 'unknown',
            dataSourceName: wrapper.datasource_name,
            folder: wrapper.folder,
            streamTuplesValue: streamTuplesValue,
            parameters: parameters
          });
          console.log(`🌊 Stream tuples DISABLED for ${wrapper.name} (value: ${streamTuplesValue})`);
        } else {
          // Default to enabled if unconfigured (Excel wrappers default to enabled stream tuples)
          stats.streamTuplesEnabled++;
          stats.streamTuplesUnconfigured++;
          console.log(`🌊 Stream tuples UNCONFIGURED for ${wrapper.name} - defaulting to ENABLED`);
        }

        // Add to Excel wrappers list
        excelWrappers.push({
          name: wrapper.name,
          database: wrapper.database,
          dataSourceName: wrapper.datasource_name,
          folder: wrapper.folder,
          wrapperType: wrapper.wrapper_type,
          parameters: parameters,
          streamTuplesConfig: streamTuplesConfig,
          streamTuples: wrapper.stream_tuples,
          detectionMethods: ['Excel datasource reference'],
          streamTuplesValue: streamTuplesValue,
          streamEnabled: streamEnabled,
          streamDisabled: streamDisabled,
          streamUnconfigured: streamUnconfigured,
          isExcelWrapper: true
        });

        // Log progress for large datasets
        if ((index + 1) % 20 === 0) {
          console.log(`📊 Processed ${index + 1}/${deduplicatedExcelWrappers.length} Excel wrappers...`);
        }
      });

      console.log('📊 Enhanced Excel Wrapper Analysis Complete:', {
        totalWrappers: stats.total,
        customWrappers: stats.customWrappers,
        excelByTypeOfFile: stats.excelByTypeOfFile,
        excelByDatasourceClassname: stats.excelByDatasourceClassname,
        excelByParameters: stats.excelByParameters,
        excelByFileExtension: stats.excelByFileExtension,
        excelByWrapperName: stats.excelByWrapperName,
        excelTotal: stats.excelTotal,
        streamTuplesEnabled: stats.streamTuplesEnabled,
        streamTuplesDisabled: stats.streamTuplesDisabled,
        streamTuplesUnconfigured: stats.streamTuplesUnconfigured
      });

      // Log disabled stream tuples with details
      if (stats.disabledWrappers.length > 0) {
        console.log('🚫 Disabled Stream Tuples Wrappers:');
        stats.disabledWrappers.forEach(wrapper => {
          console.log(`  - ${wrapper.name} in database ${wrapper.database} (value: ${wrapper.streamTuplesValue})`);
        });
      }

      const result: ExcelWrapperResult = {
        excelWrappers,
        streamTuplesStats: {
          total: stats.excelTotal,
          enabled: stats.streamTuplesEnabled,
          disabled: stats.streamTuplesDisabled,
          unconfigured: stats.streamTuplesUnconfigured
        },
        detailedStats: {
          totalWrappers: stats.total,
          customWrappers: stats.customWrappers,
          byMethod: {
            typeOfFile: stats.excelByTypeOfFile,
            datasourceClassname: stats.excelByDatasourceClassname,
            parameters: stats.excelByParameters,
            fileExtension: stats.excelByFileExtension,
            wrapperName: stats.excelByWrapperName,
            combined: stats.excelTotal
          },
          disabledWrappers: stats.disabledWrappers
        }
      };

      // Cache the result
      ExcelWrapperQueryService._cache = result;
      ExcelWrapperQueryService._cacheTimestamp = Date.now();

      return result;

    } catch (error) {
      console.error('❌ Error querying Excel wrappers from DuckDB:', error);
      throw error;
    }
  }

  /**
   * Get simple count of Excel wrappers for dashboard display
   */
  async getExcelWrapperCount(): Promise<number> {
    try {
      const result = await this.findExcelWrappers();
      return result.excelWrappers.length;
    } catch (error) {
      console.error('❌ Error getting Excel wrapper count:', error);
      return 0;
    }
  }

  /**
   * Get stream tuples analysis for Excel wrappers
   */
  async getStreamTuplesAnalysis(): Promise<StreamTuplesAnalysisResult> {
    try {
      const result = await this.findExcelWrappers();

      // Ensure we have valid data structure
      if (!result || !result.streamTuplesStats) {
        console.warn('⚠️ Invalid result from findExcelWrappers, returning default values');
        return {
          excelWrapperCount: 0,
          streamTuplesStats: { total: 0, enabled: 0, disabled: 0 },
          disabledWrappers: []
        };
      }

      return {
        excelWrapperCount: result.excelWrappers ? result.excelWrappers.length : 0,
        streamTuplesStats: result.streamTuplesStats,
        disabledWrappers: result.detailedStats && result.detailedStats.disabledWrappers
          ? result.detailedStats.disabledWrappers
          : []
      };
    } catch (error) {
      console.error('❌ Error getting stream tuples analysis:', error);
      return {
        excelWrapperCount: 0,
        streamTuplesStats: { total: 0, enabled: 0, disabled: 0 },
        disabledWrappers: []
      };
    }
  }

  /**
   * Log detailed information about all parameters in DuckDB wrappers
   */
  async debugWrapperParameters(): Promise<void> {
    try {
      const allWrappers = await this.duckdb.query('SELECT * FROM wrappers');
      console.log(`🔍 Debugging ${allWrappers.length} wrappers in DuckDB...`);

      allWrappers.forEach((wrapper: any, index: number) => {
        console.log(`\n🔧 Wrapper ${index + 1}: ${wrapper.name}`);
        console.log(`  Database: ${wrapper.database}`);
        console.log(`  DataSource: ${wrapper.datasource_name}`);
        console.log(`  DataSource ClassName: ${wrapper.datasource_class_name}`);

        if (wrapper.parameters) {
          let parameters: Record<string, any>;
          try {
            parameters = typeof wrapper.parameters === 'string' ? JSON.parse(wrapper.parameters) : wrapper.parameters;
            console.log(`  Parameters:`, Object.keys(parameters));
            Object.keys(parameters).forEach(key => {
              const value = parameters[key];
              console.log(`    "${key}" = ${JSON.stringify(value)} (${typeof value})`);

              // Highlight stream tuples
              if (key.toLowerCase().includes('stream') && key.toLowerCase().includes('tuples')) {
                console.log(`    🌊 STREAM TUPLES FOUND: "${key}" = ${value} (${typeof value})`);
              }

              // Highlight type of file
              if (key.toLowerCase().includes('type') && key.toLowerCase().includes('file')) {
                console.log(`    📄 TYPE OF FILE FOUND: "${key}" = ${value}`);
              }
            });
          } catch {
            console.log(`  Parameters: PARSE ERROR`);
          }
        } else {
          console.log(`  Parameters: NONE`);
        }

        if (wrapper.stream_tuples_config) {
          try {
            const config = typeof wrapper.stream_tuples_config === 'string'
              ? JSON.parse(wrapper.stream_tuples_config)
              : wrapper.stream_tuples_config;
            console.log(`  StreamTuplesConfig:`, config);
          } catch {
            console.log(`  StreamTuplesConfig: PARSE ERROR`);
          }
        }
      });

    } catch (error) {
      console.error('❌ Error debugging wrapper parameters:', error);
    }
  }

  /**
   * Static methods for backward compatibility
   */
  static async findExcelWrappers(duckdb: DuckDBClient): Promise<ExcelWrapperResult> {
    const service = new ExcelWrapperQueryService(duckdb);
    return service.findExcelWrappers();
  }

  static async getExcelWrapperCount(duckdb: DuckDBClient): Promise<number> {
    const service = new ExcelWrapperQueryService(duckdb);
    return service.getExcelWrapperCount();
  }

  static async getStreamTuplesAnalysis(duckdb: DuckDBClient): Promise<StreamTuplesAnalysisResult> {
    const service = new ExcelWrapperQueryService(duckdb);
    return service.getStreamTuplesAnalysis();
  }

  static async debugWrapperParameters(duckdb: DuckDBClient): Promise<void> {
    const service = new ExcelWrapperQueryService(duckdb);
    return service.debugWrapperParameters();
  }
}