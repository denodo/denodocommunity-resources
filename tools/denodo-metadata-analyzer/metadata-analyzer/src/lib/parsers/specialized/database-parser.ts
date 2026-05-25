/**
 * Database Parser - TypeScript version with DuckDB integration
 * Parses CREATE [OR REPLACE] DATABASE statements
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface DatabaseData {
  name: string;
  description?: string;
  denodoVersion: string;
  metrics: {
    dataSources: number;
    baseViews: number;
    derivedViews: number;
    interfaceViews: number;
    totalViews: number;
    folders: number;
    associations: number;
    webServices: number;
    cacheEnabledViews: number;
    cacheDisabledViews: number;
    users: number;
    roles: number;
  };
  dataSources: any[];
  views: any[];
  interfaceViewMappings: any[];
  associations: any[];
  users: any[];
  roles: any[];
  _bounds?: {
    startLine: number;
    endLine: number;
    startIndex: number;
    endIndex: number;
  };
}

export interface DatabaseParseResults {
  databases: DatabaseData[];
  parseErrors: Array<{
    type: string;
    error: string;
    match?: string;
  }>;
}

/**
 * Database Parser - handles DATABASE, USE_DATABASE, ALTER_DATABASE statements
 */
export class DatabaseParser extends BaseParser {
  private configs: { [key: string]: any } = {};
  private static parseCallCount = 0;

  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    const databaseConfig = grammarConfig.statements['DATABASE'];
    super(databaseConfig, duckdb);

    // Store configs for all database statement types
    this.configs['DATABASE'] = grammarConfig.statements['DATABASE'];
    this.configs['USE_DATABASE'] = grammarConfig.statements['USE_DATABASE'];
    this.configs['ALTER_DATABASE'] = grammarConfig.statements['ALTER_DATABASE'];
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      // React approach: extract all DATABASE matches from full content
      this.config = this.configs['DATABASE'];
      this.initializePatterns();
      const matches = this.extractMatches(content);

      // console.log(`🗄️ [DatabaseParser] Found ${matches.length} CREATE DATABASE statements`);

      for (const matchData of matches) {
        try {
          const extractedData = this.processExtractors(matchData, content, database);

          // Extract additional database information
          const databaseData = this.extractDatabaseInfo(extractedData, matchData.fullMatch, content);

          // Validate the data
          if (this.validateExtractedData(databaseData)) {
            results.push({
              data: databaseData,
              statement: matchData.fullMatch,
              statementType: 'DATABASE',
              database: databaseData.name
            });
          }

        } catch (error) {
          console.error('Error parsing database:', error);
        }
      }

      // Add admin database if CONNECT DATABASE admin is found (admin has no CREATE statement)
      if (content.match(/CONNECT\s+DATABASE\s+admin/i)) {
        const adminExists = results.find(r => r.data.name === 'admin');
        if (!adminExists) {
          // console.log('🔧 Adding synthetic admin database entry (default database)');
          results.push({
            data: {
              name: 'admin',
              description: 'Default Denodo admin database',
              denodoVersion: null,
              metrics: {
                dataSources: 0,
                baseViews: 0,
                derivedViews: 0,
                interfaceViews: 0,
                cachedViews: 0,
                wrappers: 0
              },
              dataSources: [],
              baseViews: [],
              derivedViews: [],
              interfaceViews: [],
              wrappers: [],
              storedProcedures: [],
              webServices: [],
              interfaceViewMappings: [],
              associations: [],
              users: [],
              roles: []
            },
            statement: 'CONNECT DATABASE admin',
            statementType: 'DATABASE',
            database: 'admin'
          });
        }
      }

      // Store to DuckDB
      if (results.length > 0) {
        // console.log(`✅ Storing ${results.length} database(s) to DuckDB:`, results.map(r => r.data.name));
        await this.storeToDatabase(results.map(r => r.data), 'DATABASE');
      }

      // Parse ALTER DATABASE statements to capture database-level cache configuration
      // Switch config to ALTER_DATABASE and re-extract matches
      this.config = this.configs['ALTER_DATABASE'];
      this.initializePatterns();
      const alterMatches = this.extractMatches(content);

      if (alterMatches.length > 0 && this.duckdb) {
        const cacheByDb: Record<string, any> = {};

        let searchFrom = 0;
        for (const matchData of alterMatches) {
          // Extract database name using existing extractor config
          const extracted = this.processExtractors(matchData, content, database);
          const dbName = extracted.name as string | undefined;
          if (!dbName) continue;

          // Find full statement text starting at this match occurrence
          const localIdx = content.indexOf(matchData.fullMatch, searchFrom);
          const startIdx = localIdx >= 0 ? localIdx : content.indexOf(matchData.fullMatch);
          if (startIdx >= 0) {
            searchFrom = startIdx + matchData.fullMatch.length;
          }
          const fullStmt = startIdx >= 0 ? this.extractStatementContent(content, startIdx) : matchData.fullMatch;

          // Determine cache enabled/disabled
          const enabled = /CACHE\s+ON\b/i.test(fullStmt)
            ? true
            : (/CACHE\s+OFF\b/i.test(fullStmt) ? false : undefined);

          // Extract cache datasource if present
          let datasource: string | null = null;
          const dsMatch = /DATASOURCE\s+(?:"([^"]+)"|([\w.-]+))/i.exec(fullStmt);
          if (dsMatch) {
            datasource = (dsMatch[1] || dsMatch[2] || '').trim() || null;
          }

          // Extract TTL and maintainer period
          let ttl: string | null = null;
          const ttlMatch = /TIMETOLIVE\s+(NOEXPIRE|\d+)/i.exec(fullStmt);
          if (ttlMatch) ttl = ttlMatch[1];

          let maintainerPeriod: number | null = null;
          const mpMatch = /MAINTAINERPERIOD\s+(\d+)/i.exec(fullStmt);
          if (mpMatch) maintainerPeriod = parseInt(mpMatch[1], 10);

          // Build record, prefer the latest ALTER for each database (overwrite)
          cacheByDb[dbName] = {
            database: dbName,
            enabled: enabled === true,
            datasource,
            ttl,
            maintainer_period: maintainerPeriod ?? null,
            raw: fullStmt
          };
        }

        const cacheRows = Object.values(cacheByDb);
        if (cacheRows.length > 0) {
          await this.duckdb.batchInsert('database_cache', cacheRows);
        }
      }

    } catch (error) {
      console.error('DatabaseParser error:', error);
      throw error;
    }

    return results;
  }

  /**
   * Extract additional database information from the full statement
   */
  private extractDatabaseInfo(baseData: any, statementMatch: string, fullContent: string): DatabaseData {
    const databaseData: DatabaseData = {
      name: baseData.name,
      description: baseData.description,
      denodoVersion: this.extractDenodoVersion(fullContent),
      metrics: {
        dataSources: 0,
        baseViews: 0,
        derivedViews: 0,
        interfaceViews: 0,
        totalViews: 0,
        folders: 0,
        associations: 0,
        webServices: 0,
        cacheEnabledViews: 0,
        cacheDisabledViews: 0,
        users: 0,
        roles: 0
      },
      dataSources: [],
      views: [],
      interfaceViewMappings: [],
      associations: [],
      users: [],
      roles: []
    };

    // Extract description if not already found
    if (!databaseData.description) {
      const descMatch = statementMatch.match(/DESCRIPTION\s*=\s*'([^']*)'?/i);
      if (descMatch) {
        databaseData.description = descMatch[1];
      }
    }

    // Calculate database context bounds for efficient sub-parsing
    databaseData._bounds = this.findDatabaseBounds(databaseData.name, fullContent);

    return databaseData;
  }

  /**
   * Extract Denodo version from VQL content
   */
  private extractDenodoVersion(content: string): string {
    // Check first 10 lines for version information
    const lines = content.split('\n').slice(0, 10);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('# Generated with Denodo Platform')) {
        const versionMatch = trimmedLine.match(/# Generated with (.+)/);
        if (versionMatch) {
          return versionMatch[1].trim();
        }
      }
    }

    return 'Unknown';
  }

  /**
   * Find the content boundaries for a specific database
   * This helps optimize parsing by limiting scope to database-specific content
   */
  private findDatabaseBounds(databaseName: string, content: string) {
    const lines = content.split('\n');
    let startLine = -1;
    let endLine = lines.length;

    // Find database creation line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('CREATE OR REPLACE DATABASE') &&
          line.includes(databaseName) &&
          !line.includes('CONNECT DATABASE')) {
        startLine = i;
        break;
      }
    }

    // Find next database or end of file
    if (startLine >= 0) {
      for (let i = startLine + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('CREATE OR REPLACE DATABASE') &&
            !line.includes('CONNECT DATABASE') &&
            !line.includes(databaseName)) {
          endLine = i;
          break;
        }
      }
    }

    return {
      startLine,
      endLine,
      startIndex: startLine >= 0 ? lines.slice(0, startLine).join('\n').length : 0,
      endIndex: endLine < lines.length ? lines.slice(0, endLine).join('\n').length : content.length
    };
  }

  /**
   * Update database metrics (called by other parsers)
   */
  static updateDatabaseMetrics(databases: DatabaseData[], metricType: keyof DatabaseData['metrics'], databaseName: string, increment: number = 1): void {
    const database = databases.find(db => db.name === databaseName);
    if (database && database.metrics) {
      database.metrics[metricType] = (database.metrics[metricType] || 0) + increment;

      // Update total views count
      if (['baseViews', 'derivedViews', 'interfaceViews'].includes(metricType)) {
        database.metrics.totalViews =
          (database.metrics.baseViews || 0) +
          (database.metrics.derivedViews || 0) +
          (database.metrics.interfaceViews || 0);
      }
    }
  }

  /**
   * Get database by name
   */
  static getDatabaseByName(databases: DatabaseData[], name: string): DatabaseData | undefined {
    return databases.find(db => db.name === name);
  }

  /**
   * Get database statistics summary
   */
  public getDatabaseStats(databases: DatabaseData[]) {
    return {
      totalDatabases: databases.length,
      withDescriptions: databases.filter(db => db.description).length,
      denodoVersions: [...new Set(databases.map(db => db.denodoVersion))],
      averageDataSources: databases.reduce((sum, db) => sum + (db.metrics?.dataSources || 0), 0) / databases.length || 0,
      averageViews: databases.reduce((sum, db) => sum + (db.metrics?.totalViews || 0), 0) / databases.length || 0
    };
  }
}
