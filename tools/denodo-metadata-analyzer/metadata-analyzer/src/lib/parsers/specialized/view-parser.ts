/**
 * View Parser - TypeScript version with DuckDB integration
 * Parses CREATE [OR REPLACE] TABLE, VIEW, and INTERFACE VIEW statements
 * Handles cache configuration and interface view mappings
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface ViewData {
  name: string;
  kind: string; // 'view', 'interface view', 'table'
  database?: string;
  selectBody?: string;
  implementation?: string;
  cacheStatus: string;
  cacheConfig?: {
    mode?: string;
    batchSize?: number;
    timeToLive?: number;
    preload?: boolean;
  };
  interfaceMapping?: {
    implementation: string;
    mappings: Array<{
      viewField: string;
      implField: string;
    }>;
  };
}

/**
 * View Parser - handles VIEW, INTERFACE_VIEW, TABLE, ALTER_VIEW statements
 */
export class ViewParser extends BaseParser {
  private cacheStatusMapping = {
    'FULL': 'full',
    'PARTIAL': 'partial',
    'OFF': 'off',
    'COMPLETE': 'full' // Alternative syntax
  };

  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    // We'll use the VIEW config as the primary one since it has the most complete extractors
    const viewConfig = grammarConfig.statements['VIEW'];
    super(viewConfig, duckdb);
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      // Parse VIEW statements
      await this.parseStatementType(content, 'VIEW', database, results);

      // Parse INTERFACE_VIEW statements
      await this.parseStatementType(content, 'INTERFACE_VIEW', database, results);

      // Parse TABLE statements
      await this.parseStatementType(content, 'TABLE', database, results);

      // Parse ALTER_VIEW statements
      await this.parseStatementType(content, 'ALTER_VIEW', database, results);

      // console.log(`📊 ViewParser found ${results.length} view statements`);

      // Separate CREATE statements from ALTER statements
      const createStatements = results.filter(r => r.statementType !== 'ALTER_VIEW');
      const alterStatements = results.filter(r => r.statementType === 'ALTER_VIEW');

      // Copy database to currentDatabase for normalize map (which uses $currentDatabase)
      createStatements.forEach(r => {
        if (r.data.database && !r.data.currentDatabase) {
          r.data.currentDatabase = r.data.database;
        }
      });

      // Store CREATE statements to DuckDB
      if (createStatements.length > 0) {
        await this.storeToDatabase(createStatements.map(r => r.data), 'VIEW');
        // console.log(`✅ Stored ${createStatements.length} views to DuckDB (${alterStatements.length} ALTER_VIEW statements processed separately)`);
      }

      // Create cache_data entries from CREATE statements with cache enabled
      const cacheDataFromCreates = this.extractCacheDataEntries(createStatements);

      // Create cache_data entries from ALTER_VIEW statements (React logic)
      // Pass createStatements so Worker can build viewMap without DuckDB
      const cacheDataFromAlters = await this.extractCacheDataFromAlters(alterStatements, createStatements);

      // Combine all cache_data entries and add them as special results for main thread insertion
      const allCacheData = [...cacheDataFromCreates, ...cacheDataFromAlters];
      if (allCacheData.length > 0) {
        // Add cache_data entries as special result type for main thread to insert
        allCacheData.forEach(cacheEntry => {
          results.push({
            data: cacheEntry,
            statement: '', // No statement for cache entries
            statementType: 'CACHE_DATA', // Special type for cache entries
            database: cacheEntry.database
          });
        });
        // console.log(`✅ Extracted ${allCacheData.length} cache_data entries (${cacheDataFromCreates.length} from CREATE, ${cacheDataFromAlters.length} from ALTER)`);
      }

    } catch (error) {
      console.error('ViewParser error:', error);
      throw error;
    }

    return results;
  }

  /**
   * Extract cache_data entries from views with cache enabled
   * Matches React's normalizeCacheData logic
   */
  private extractCacheDataEntries(viewResults: ParseResult[]): any[] {
    const cacheDataEntries: any[] = [];

    viewResults.forEach(result => {
      const view = result.data;

      // Only create cache_data entry if cache is enabled (full or partial)
      if (view.cacheStatus === 'full' || view.cacheStatus === 'partial') {
        cacheDataEntries.push({
          name: view.name,
          database: view.database || view.currentDatabase,
          cacheType: view.kind, // 'view', 'table', 'interface view'
          cacheStatus: view.cacheStatus, // 'full' or 'partial'
          configuration: view.cacheConfig || null
        });
      }
    });

    return cacheDataEntries;
  }

  /**
   * Extract cache_data entries from ALTER_VIEW statements
   * Matches React's StreamingParsingWorker ALTER_VIEW handling
   */
  private async extractCacheDataFromAlters(alterResults: ParseResult[], createResults: ParseResult[]): Promise<any[]> {
    const cacheDataEntries: any[] = [];

    // console.log(`[ViewParser] Processing ${alterResults.length} ALTER_VIEW statements for cache_data`);

    // Build viewMap from CREATE results instead of querying database (for Worker compatibility)
    // In Worker: use CREATE results. In main thread: use database query if available.
    let viewMap: Map<string, any>;

    if (this.duckdb) {
      // Main thread with DuckDB access - query database
      const allViews = await this.duckdb.query('SELECT name, database, kind FROM views');
      viewMap = new Map(allViews.map((v: any) => [v.name.toLowerCase(), v]));
      // console.log(`[ViewParser] Found ${allViews.length} views in database for lookup`);
    } else {
      // Worker without DuckDB - use CREATE results
      viewMap = new Map(createResults.map(r => [r.data.name.toLowerCase(), {
        name: r.data.name,
        database: r.data.database,
        kind: r.data.kind
      }]));
      // console.log(`[ViewParser] Using ${createResults.length} CREATE results for ALTER lookup (Worker mode)`);
    }

    let withCache = 0;
    let withoutCache = 0;
    let notFound = 0;

    alterResults.forEach((result, index) => {
      const alter = result.data;

      // Debug first few ALTER statements
      if (index < 3) {
        // console.log(`[ViewParser] ALTER #${index + 1}: name=${alter.name}, cacheStatus=${alter.cacheStatus}`);
        // console.log(`[ViewParser] ALTER #${index + 1} statement:`, result.statement.substring(0, 150));
      }

      // Only process ALTER statements with cache enabled (full or partial)
      if (alter.cacheStatus === 'full' || alter.cacheStatus === 'partial') {
        withCache++;
        // Look up the view's database from the views table (React's viewRegistry pattern)
        const existingView = viewMap.get(alter.name.toLowerCase());

        if (existingView) {
          cacheDataEntries.push({
            name: alter.name,
            database: existingView.database, // Use database from CREATE statement
            cacheType: existingView.kind, // Use kind from CREATE statement
            cacheStatus: alter.cacheStatus, // Use cache status from ALTER statement
            configuration: alter.cacheConfig || null
          });
        } else {
          notFound++;
          if (notFound <= 3) {
            // console.warn(`[ViewParser] ALTER_VIEW ${alter.name} not found in views table`);
          }
        }
      } else {
        withoutCache++;
      }
    });

    // console.log(`[ViewParser] ALTER_VIEW summary: ${withCache} with cache, ${withoutCache} without cache, ${notFound} not found in views table`);

    return cacheDataEntries;
  }

  /**
   * Process custom extractors using the grammar system's processors
   */
  private async processCustomExtractors(
    baseData: any,
    statement: string,
    config: any
  ): Promise<any> {
    const grammarConfig = getGrammarConfig();
    const processedData = { ...baseData };

    // Process fields that use custom processors
    Object.entries(config.extractors || {}).forEach(([fieldName, extractor]) => {
      if ((extractor as any).type === 'customProcessor' && (extractor as any).processor) {
        const processorName = (extractor as any).processor;
        const processor = grammarConfig.processors[processorName];

        if (processor && typeof processor === 'function') {
          try {
            processedData[fieldName] = processor(statement);
          } catch (error) {
            // console.warn(`Processor ${processorName} failed for field ${fieldName}:`, error);
          }
        }
      }
    });

    return processedData;
  }

  /**
   * Parse specific statement type
   */
  private async parseStatementType(
    content: string,
    statementType: string,
    database: string | undefined,
    results: ParseResult[]
  ): Promise<void> {
    const grammarConfig = getGrammarConfig();
    const config = grammarConfig.statements[statementType];

    if (!config || !config.patterns) return;

    // Temporarily update patterns for this statement type
    const originalPatterns = this.patterns;
    this.patterns = config.patterns.map(pattern => new RegExp(pattern, 'gim'));
    const originalExtractors = this.extractors;
    this.extractors = config.extractors || {};

    const matches = this.extractMatches(content);

    for (const matchData of matches) {
      try {
        // Extract basic data using the configuration
        let extractedData = this.processExtractors(matchData, content, database);

        // Extract complete statement for processing
        const completeStatement = this.extractCompleteStatement(content, matchData.match.index || 0);

        // Process custom extractors (like extractCacheStatus) and UPDATE extractedData with results
        extractedData = await this.processCustomExtractors(extractedData, completeStatement, config);

        // Extract view-specific information
        const viewData = this.extractViewInfo(extractedData, matchData.fullMatch, content, matchData.match.index || 0);

        // Always use findDatabaseContext to get accurate database (React approach)
        // Don't rely on global database parameter which may be stale
        viewData.database = this.findDatabaseContext(content, matchData.match.index || 0) || database;

        // Debug first few views
        if (results.length < 5) {
          // console.log(`[ViewParser] View #${results.length + 1}: ${viewData.name} -> database: ${viewData.database} (matchIndex: ${matchData.match.index})`);
        }

        // Normalize cache status
        this.normalizeCacheStatus(viewData);

        // Extract cache configuration details using the full statement
        this.extractCacheDetails(viewData, completeStatement);

        // For interface views, extract mapping information
        if (viewData.kind === 'interface view') {
          this.extractInterfaceViewMapping(viewData, completeStatement);
        }

        // Validate the data
        if (this.validateExtractedData(viewData)) {
          results.push({
            data: viewData,
            statement: completeStatement,
            statementType,
            database: viewData.database
          });
        }

      } catch (error) {
        console.error(`Error parsing ${statementType}:`, error);
        // Continue with other matches
      }
    }

    // Restore original patterns and extractors
    this.patterns = originalPatterns;
    this.extractors = originalExtractors;
  }

  /**
   * Extract view-specific information
   */
  private extractViewInfo(baseData: any, statementContent: string, fullContent: string, matchIndex: number): ViewData {
    const viewData: ViewData = {
      name: baseData.name,
      kind: baseData.kind || 'view',
      database: baseData.database,
      selectBody: baseData.selectBody,
      cacheStatus: baseData.cacheStatus || 'off'
    };

    // Debug logging for selectBody
    if (baseData.selectBody) {
      console.log(`✅ [ViewParser] View "${baseData.name}" has selectBody, length: ${baseData.selectBody.length}`);
    } else {
      console.log(`⚠️  [ViewParser] View "${baseData.name}" has NO selectBody`);
    }

    // Note: implementation will be set by extractInterfaceViewMapping for interface views

    return viewData;
  }

  /**
   * Extract complete multiline statement
   */
  private extractCompleteStatement(content: string, startIndex: number): string {
    return this.extractStatementContent(content, startIndex);
  }

  /**
   * Find database context for a view
   */
  private findDatabaseContext(content: string, matchIndex: number): string | undefined {
    // Look backwards for the nearest CREATE DATABASE or USE DATABASE statement
    const contentBeforeMatch = content.substring(0, matchIndex);
    const lines = contentBeforeMatch.split('\n').reverse();

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for CONNECT/USE DATABASE (most common context setter)
      const useMatch = trimmedLine.match(/(?:USE|CONNECT)\s+DATABASE\s+(?:"([^"]+)"|(\w+))/i);
      if (useMatch) {
        return useMatch[1] || useMatch[2];
      }

      // Check for CREATE DATABASE
      const createMatch = trimmedLine.match(/CREATE\s+(?:OR\s+REPLACE\s+)?DATABASE\s+(?:"([^"]+)"|(\w+))/i);
      if (createMatch) {
        return createMatch[1] || createMatch[2];
      }
    }

    return undefined;
  }

  /**
   * Normalize cache status
   */
  private normalizeCacheStatus(viewData: ViewData): void {
    if (viewData.cacheStatus) {
      viewData.cacheStatus = this.cacheStatusMapping[viewData.cacheStatus.toUpperCase() as keyof typeof this.cacheStatusMapping] || 'off';
    } else {
      viewData.cacheStatus = 'off';
    }
  }

  /**
   * Extract cache configuration details
   */
  private extractCacheDetails(viewData: ViewData, completeStatement: string): void {
    if (viewData.cacheStatus === 'off') return;

    const cacheConfig: ViewData['cacheConfig'] = {};

    // Extract batch size
    const batchSizeMatch = completeStatement.match(/BATCHSIZEINCACHE\s+(\d+)/i);
    if (batchSizeMatch) {
      cacheConfig.batchSize = parseInt(batchSizeMatch[1], 10);
    }

    // Extract time to live
    const ttlMatch = completeStatement.match(/TIMETOLIVEINCACHE\s+(\d+)/i);
    if (ttlMatch) {
      cacheConfig.timeToLive = parseInt(ttlMatch[1], 10);
    }

    // Check for PRELOAD
    cacheConfig.preload = /\bPRELOAD\b/i.test(completeStatement);

    // Set cache mode
    cacheConfig.mode = viewData.cacheStatus;

    if (Object.keys(cacheConfig).length > 0) {
      viewData.cacheConfig = cacheConfig;
    }
  }

  /**
   * Extract interface view mapping information
   */
  private extractInterfaceViewMapping(viewData: ViewData, completeStatement: string): void {
    console.log(`🔍 [extractInterfaceViewMapping] Processing ${viewData.name}`);
    console.log(`📄 Statement length: ${completeStatement.length}, first 300 chars:`, completeStatement.substring(0, 300));

    // Extract SET IMPLEMENTATION
    const implMatch = completeStatement.match(/SET\s+IMPLEMENTATION\s+(?:"([^"]+)"|([^\\s;()]+))/i);
    console.log(`🎯 Regex match result:`, implMatch);

    if (implMatch) {
      const implementation = implMatch[1] || implMatch[2];
      console.log(`✅ Found implementation: ${implementation}`);

      // Set both the top-level implementation field and the interfaceMapping object
      viewData.implementation = implementation;

      viewData.interfaceMapping = {
        implementation,
        mappings: []
      };

      // Extract field mappings (simplified - full implementation would be more complex)
      const mappingMatches = completeStatement.matchAll(/(\w+)\s*=\s*(\w+)/gi);
      for (const match of mappingMatches) {
        viewData.interfaceMapping.mappings.push({
          viewField: match[1],
          implField: match[2]
        });
      }
    }
  }

  /**
   * Log view statistics
   */
  private logViewStats(views: ViewData[]): void {
    const stats = {
      total: views.length,
      byType: {} as { [type: string]: number },
      cached: views.filter(v => v.cacheStatus !== 'off').length,
      withSelectBody: views.filter(v => v.selectBody).length
    };

    views.forEach(view => {
      const viewType = (view as any).type;
      if (viewType) {
        stats.byType[viewType] = (stats.byType[viewType] || 0) + 1;
      }
    });

    // console.log('View Statistics:', stats);
  }
}