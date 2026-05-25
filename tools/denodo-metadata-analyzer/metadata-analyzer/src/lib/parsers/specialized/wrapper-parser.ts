/**
 * Wrapper Parser - TypeScript version with DuckDB integration
 * Parses CREATE [OR REPLACE] WRAPPER and REST WEBSERVICE statements
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface WrapperData {
  name: string;
  wrapperType: string;
  database?: string;
  dataSourceName?: string;
  parametersContent?: string;
  streamTuplesConfig?: any;
  parameters?: { [key: string]: any };
  isExcelWrapper?: boolean;
  typeOfFile?: string;
  type?: string;
  webServiceType?: string;
  url?: string;
  endpoint?: string;
}

/**
 * Wrapper Parser - handles WRAPPER and REST_WEBSERVICE statements
 */
export class WrapperParser extends BaseParser {
  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    const wrapperConfig = grammarConfig.statements['WRAPPER'];
    super(wrapperConfig, duckdb);
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      // Parse WRAPPER statements
      await this.parseStatementType(content, 'WRAPPER', database, results);

      // Parse REST_WEBSERVICE statements
      await this.parseStatementType(content, 'REST_WEBSERVICE', database, results);

      // console.log(`📊 WrapperParser found ${results.length} wrapper statements`);

      // Store to DuckDB if available
      if (results.length > 0) {
        await this.storeToDatabase(results.map(r => r.data), 'WRAPPER');
      }

    } catch (error) {
      console.error('WrapperParser error:', error);
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
        // Extract the FULL statement including PARAMETERS block
        const fullStatement = this.extractStatementContent(content, matchData.match.index || 0);

        // IMPORTANT: Replace matchData.fullMatch with the full statement
        // so that pattern extractors can find DATASOURCENAME, PARAMETERS, etc.
        const fullMatchData = {
          ...matchData,
          fullMatch: fullStatement
        };

        // Extract basic data using the configuration with FULL statement
        const extractedData = this.processExtractors(fullMatchData, content, database);

        // Process custom processors with FULL statement
        const processedData = await this.processCustomExtractors(
          extractedData,
          fullStatement,
          config
        );

        // Extract wrapper-specific information
        const wrapperData = this.extractWrapperInfo(
          processedData,
          fullStatement,
          content,
          matchData.match.index || 0,
          statementType
        );

        // Validate the data
        if (this.validateExtractedData(wrapperData)) {
          results.push({
            data: wrapperData,
            statement: matchData.fullMatch,
            statementType,
            database: wrapperData.database
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
            const context = {
              statement,
              parametersContent: processedData.parametersContent,
              parameters: processedData.parameters
            };
            processedData[fieldName] = processor(statement, context);
          } catch (error) {
            // console.warn(`Processor ${processorName} failed for field ${fieldName}:`, error);
          }
        }
      }
    });

    return processedData;
  }

  /**
   * Extract wrapper-specific information
   */
  private extractWrapperInfo(
    baseData: any,
    statement: string,
    fullContent: string,
    matchIndex: number,
    statementType: string
  ): WrapperData {
    const wrapperData: WrapperData = {
      name: baseData.name,
      wrapperType: baseData.wrapperType || (statementType === 'REST_WEBSERVICE' ? 'REST' : 'CUSTOM'),
      database: baseData.database || this.findDatabaseContext(fullContent, matchIndex)
    };

    // Copy all extracted fields
    Object.keys(baseData).forEach(key => {
      if (key !== 'name' && key !== 'wrapperType' && key !== 'database') {
        (wrapperData as any)[key] = baseData[key];
      }
    });

    return wrapperData;
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