/**
 * Security Parser - TypeScript version with DuckDB integration
 * Parses USER, ROLE, and ALTER_ROLE statements
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface SecurityData {
  name: string;
  type: string;
  database?: string;
  authType?: string;
  userType?: string;
  ldapDatasource?: string;
  ldapUsername?: string;
  description?: string;
  grantedRoles?: string[];
  adminPrivileges?: string[];
  isAdmin?: boolean;
  fullDefinition?: string;
}

/**
 * Security Parser - handles USER, ROLE, ALTER_ROLE statements
 */
export class SecurityParser extends BaseParser {
  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    const userConfig = grammarConfig.statements['USER'];
    super(userConfig, duckdb);
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      // Parse USER statements
      await this.parseStatementType(content, 'USER', database, results);

      // Parse ROLE statements
      await this.parseStatementType(content, 'ROLE', database, results);

      // Parse ALTER_ROLE statements
      await this.parseStatementType(content, 'ALTER_ROLE', database, results);

      // console.log(`📊 SecurityParser found ${results.length} security statements`);

      // Store to DuckDB if available
      if (results.length > 0) {
        const dataToStore = results.map(r => r.data);
        // console.log('🔍 SecurityParser extracted data:', JSON.stringify(dataToStore, null, 2));
        await this.storeToDatabase(dataToStore, 'SECURITY');
      }

    } catch (error) {
      console.error('SecurityParser error:', error);
      throw error;
    }

    return results;
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
        const extractedData = this.processExtractors(matchData, content, database);

        // Process conditional extractors
        const processedData = this.processConditionalExtractors(
          extractedData,
          matchData.fullMatch,
          config
        );

        // Process custom processors
        const finalData = await this.processCustomExtractors(
          processedData,
          matchData.fullMatch,
          config
        );

        // Extract security-specific information
        const securityData = this.extractSecurityInfo(
          finalData,
          matchData.fullMatch,
          content,
          matchData.match.index || 0,
          statementType
        );

        // Validate the data
        if (this.validateExtractedData(securityData)) {
          results.push({
            data: securityData,
            statement: matchData.fullMatch,
            statementType,
            database: securityData.database
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
   * Process conditional extractors
   */
  private processConditionalExtractors(
    baseData: any,
    statement: string,
    config: any
  ): any {
    const processedData = { ...baseData };

    Object.entries(config.extractors || {}).forEach(([fieldName, extractor]) => {
      if ((extractor as any).type === 'conditional') {
        const conditions = (extractor as any).conditions || [];

        for (const condition of conditions) {
          const regex = new RegExp(condition.pattern, 'i');
          if (regex.test(statement)) {
            processedData[fieldName] = condition.value;
            break;
          }
        }
      } else if ((extractor as any).type === 'pattern') {
        const pattern = (extractor as any).pattern;
        const condition = (extractor as any).condition;

        if (!condition || new RegExp(condition, 'i').test(statement)) {
          const regex = new RegExp(pattern, 'i');
          const match = regex.exec(statement);
          if (match && (extractor as any).group) {
            processedData[fieldName] = match[(extractor as any).group];
          }
        }
      }
    });

    return processedData;
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
   * Extract security-specific information
   */
  private extractSecurityInfo(
    baseData: any,
    statement: string,
    fullContent: string,
    matchIndex: number,
    statementType: string
  ): SecurityData {
    const securityData: SecurityData = {
      name: baseData.name,
      type: baseData.type || statementType.toLowerCase(),
      database: baseData.database || this.findDatabaseContext(fullContent, matchIndex) || null
    };

    // Copy all extracted fields
    Object.keys(baseData).forEach(key => {
      if (key !== 'name' && key !== 'type' && key !== 'database') {
        (securityData as any)[key] = baseData[key];
      }
    });

    return securityData;
  }

  /**
   * Find database context
   */
  private findDatabaseContext(content: string, matchIndex: number): string | undefined {
    // Look backwards for the nearest CREATE DATABASE or USE DATABASE statement
    const contentBeforeMatch = content.substring(0, matchIndex);
    const lines = contentBeforeMatch.split('\n').reverse();

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for USE DATABASE
      const useMatch = trimmedLine.match(/(?:USE|CONNECT)\s+DATABASE\s+(?:"([^"]+)"|([\\w.-]+))/i);
      if (useMatch) {
        return useMatch[1] || useMatch[2];
      }

      // Check for CREATE DATABASE
      const createMatch = trimmedLine.match(/CREATE\s+(?:OR\s+REPLACE\s+)?DATABASE\s+(?:"([^"]+)"|([\\w.-]+))/i);
      if (createMatch) {
        return createMatch[1] || createMatch[2];
      }
    }

    return undefined;
  }
}