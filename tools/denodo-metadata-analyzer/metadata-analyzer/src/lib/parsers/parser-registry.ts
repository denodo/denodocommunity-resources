/**
 * Parser Registry - OPTIMIZED with VQLLexer streaming
 * Single-pass parsing like React version for maximum performance
 */

import type { DuckDBClient } from '../database/duckdb-client';
import type { GrammarConfig } from '../../types/grammar';
import { getGrammarConfig } from '../grammar';
import { StatementDispatcher, type DispatchResult } from './statement-dispatcher';
import { BaseParser, type ParseResult } from './base-parser';
import { VQLLexer } from '../lexer/vql-lexer';

// Import specialized parsers
import { DatabaseParser } from './specialized/database-parser';
import { ViewParser } from './specialized/view-parser';
import { DataSourceParser } from './specialized/datasource-parser';
import { WrapperParser } from './specialized/wrapper-parser';
import { SecurityParser } from './specialized/security-parser';
import { ResourceParser } from './specialized/resource-parser';
import { AssociationParser } from './specialized/association-parser';
import { GlobalElementsParser } from './specialized/global-elements-parser';
import { WebServiceParser } from './specialized/webservice-parser';
import ServerConfigParser from './specialized/server-config-parser';

export interface ParserInfo {
  parser: BaseParser;
  priority: number;
  statementTypes: string[];
  enabled: boolean;
}

export interface ParseStats {
  totalStatements: number;
  successfulParses: number;
  failedParses: number;
  statementTypeBreakdown: { [type: string]: number };
  parsingTime: number;
}

/**
 * Central registry for all VQL statement parsers
 */
export class ParserRegistry {
  private parsers = new Map<string, ParserInfo>();
  private dispatcher: StatementDispatcher;
  private grammarConfig: GrammarConfig;
  private duckdb?: DuckDBClient;
  private parseStats: ParseStats;

  constructor(duckdb?: DuckDBClient) {
    this.duckdb = duckdb;
    this.grammarConfig = getGrammarConfig();
    this.dispatcher = new StatementDispatcher();
    this.parseStats = this.initializeStats();

    this.initializeParsers();
  }

  /**
   * Utility function to check if a statement is database-related
   */
  private isDbStatement(statement: string): boolean {
    const trimmed = statement.trim().toLowerCase();
    return trimmed.startsWith('create or replace database') ||
           trimmed.startsWith('create database') ||
           trimmed.startsWith('use database') ||
           trimmed.startsWith('connect database');
  }

  /**
   * Initialize statistics tracking
   */
  private initializeStats(): ParseStats {
    return {
      totalStatements: 0,
      successfulParses: 0,
      failedParses: 0,
      statementTypeBreakdown: {},
      parsingTime: 0
    };
  }

  /**
   * Initialize all specialized parsers
   */
  private initializeParsers(): void {
    console.log('🔧 Initializing parser registry...');

    // Create specialized parser instances - all 12 exact ports
    const parserInstances = [
      {
        key: 'database',
        parser: new DatabaseParser(this.duckdb),
        statementTypes: ['DATABASE', 'USE_DATABASE', 'ALTER_DATABASE'],
        priority: 100
      },
      {
        key: 'views',
        parser: new ViewParser(this.duckdb),
        statementTypes: ['VIEW', 'INTERFACE_VIEW', 'TABLE', 'ALTER_VIEW'],
        priority: 80
      },
      {
        key: 'datasources',
        parser: new DataSourceParser(this.duckdb),
        statementTypes: [
          'DATASOURCE_JDBC', 'DATASOURCE_CUSTOM', 'DATASOURCE_DF',
          'DATASOURCE_JSON', 'DATASOURCE_XML', 'DATASOURCE_WS',
          'DATASOURCE_MONGODB', 'DATASOURCE_SALESFORCE',
          'DATASOURCE_LDAP', 'DATASOURCE_ODBC'
        ],
        priority: 70
      },
      {
        key: 'wrappers',
        parser: new WrapperParser(this.duckdb),
        statementTypes: ['WRAPPER'],
        priority: 60
      },
      {
        key: 'webservices',
        parser: new WebServiceParser(this.duckdb),
        statementTypes: ['REST_WEBSERVICE', 'SOAP_WEBSERVICE', 'WEBSERVICE'],
        priority: 55
      },
      {
        key: 'security',
        parser: new SecurityParser(this.duckdb),
        statementTypes: ['USER', 'ROLE', 'ALTER_ROLE'],
        priority: 50
      },
      {
        key: 'associations',
        parser: new AssociationParser(this.duckdb),
        statementTypes: ['ASSOCIATION'],
        priority: 45
      },
      {
        key: 'resources',
        parser: new ResourceParser(this.duckdb),
        statementTypes: [
          'VIEWSTATSUMMARY', 'RESOURCE_MANAGER_PLAN', 'RESOURCE_MANAGER_RULE',
          'MAP', 'TAG'
        ],
        priority: 40
      },
      {
        key: 'globalElements',
        parser: new GlobalElementsParser(this.duckdb),
        statementTypes: ['JAR'],
        priority: 35
      },
      {
        key: 'serverConfig',
        parser: new ServerConfigParser(this.duckdb),
        statementTypes: ['SERVER_CONFIG'],
        priority: 30
      }
    ];

    // Register all parsers
    parserInstances.forEach(({ key, parser, statementTypes, priority }) => {
      this.parsers.set(key, {
        parser,
        priority,
        statementTypes,
        enabled: true
      });
    });

    console.log(`✅ Registered ${this.parsers.size} specialized parsers`);
    console.log(`📊 Supporting ${this.dispatcher.getSupportedStatementTypes().length} statement types`);
  }

  /**
   * Parse VQL content - OPTIMIZED: Run parsers with reduced logging
   * Still uses specialized parsers for correct data extraction
   */
  public async parseContent(content: string, filename?: string): Promise<ParseResult[]> {
    if (!content?.trim()) return [];

    const startTime = performance.now();
    const results: ParseResult[] = [];

    try {
      // Get all parsers sorted by priority
      const sortedParsers = Array.from(this.parsers.entries())
        .sort(([, a], [, b]) => b.priority - a.priority);

      // Run each parser (they're optimized with no logging)
      for (const [, parserInfo] of sortedParsers) {
        if (!parserInfo.enabled) continue;

        const parserResults = await parserInfo.parser.parse(content, this.dispatcher.getCurrentDatabase() || undefined);

        if (parserResults && parserResults.length > 0) {
          results.push(...parserResults);

          // Update database context
          parserResults.forEach(result => {
            if (result.statementType === 'DATABASE' || result.statementType === 'USE_DATABASE' || result.statementType === 'ALTER_DATABASE') {
              const dispatch: DispatchResult = {
                statementType: result.statementType,
                config: this.grammarConfig.statements[result.statementType],
                statement: result.statement,
                confidence: 1.0
              };
              this.dispatcher.processContextChange(dispatch, result.data);
            }
          });
        }
      }

      this.parseStats.parsingTime = performance.now() - startTime;
      return results;

    } catch (error) {
      console.error('Parser registry error:', error);
      throw error;
    }
  }


  /**
   * Get parsing statistics
   */
  public getStats(): ParseStats {
    return { ...this.parseStats };
  }

  /**
   * Reset parsing statistics
   */
  public resetStats(): void {
    this.parseStats = this.initializeStats();
  }

  /**
   * Get current database context
   */
  public getCurrentDatabase(): string | null {
    return this.dispatcher.getCurrentDatabase();
  }

  /**
   * Set current database context
   */
  public setCurrentDatabase(database: string | null): void {
    this.dispatcher.setCurrentDatabase(database);
  }

  /**
   * Enable or disable a specific parser
   */
  public setParserEnabled(parserKey: string, enabled: boolean): void {
    const parserInfo = this.parsers.get(parserKey);
    if (parserInfo) {
      parserInfo.enabled = enabled;
    }
  }

  /**
   * Get all registered parsers
   */
  public getRegisteredParsers(): Map<string, ParserInfo> {
    return new Map(this.parsers);
  }

  /**
   * Get dispatcher instance
   */
  public getDispatcher(): StatementDispatcher {
    return this.dispatcher;
  }
}