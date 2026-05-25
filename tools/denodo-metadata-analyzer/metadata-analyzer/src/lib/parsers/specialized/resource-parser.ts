/**
 * Resource Parser - TypeScript version with DuckDB integration
 * Parses JAR, ASSOCIATION, VIEWSTATSUMMARY, RESOURCE_MANAGER_PLAN/RULE, MAP, TAG statements
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface ResourceData {
  name: string;
  type: string;
  database?: string;
  kind?: string;
  folder?: string;
  endpoints?: any;
  mapping?: any;
  viewName?: string;
  enabled?: boolean;
  statementType?: string;
  description?: string;
  condition?: string;
  action?: string;
  parameters?: any;
  plan?: string;
  priority?: number;
  fullDefinition?: string;
  mapType?: string;
  country?: string;
  timezone?: string;
  multiTags?: string;
}

/**
 * Resource Parser - handles resource and utility statements
 */
export class ResourceParser extends BaseParser {
  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    const jarConfig = grammarConfig.statements['JAR'];
    super(jarConfig, duckdb);
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      // Parse all resource statement types (ASSOCIATION handled by AssociationParser)
      const resourceTypes = [
        'JAR',
        'VIEWSTATSUMMARY',
        'RESOURCE_MANAGER_PLAN',
        'RESOURCE_MANAGER_RULE',
        'MAP',
        'TAG'
      ];

      for (const resourceType of resourceTypes) {
        const beforeCount = results.length;
        await this.parseStatementType(content, resourceType, database, results);
        const added = results.length - beforeCount;
        if (added > 0) {
          // console.log(`✅ [ResourceParser] ${resourceType}: found ${added} statements`);
        }
      }

      // console.log(`📊 ResourceParser found ${results.length} resource statements total`);

      // Normalize data for all results (needed for Worker compatibility)
      // This ensures result.data has the correct field mappings for database insertion
      if (results.length > 0) {
        const grammarConfig = getGrammarConfig();

        // Normalize each result's data according to its normalize config
        results.forEach(result => {
          const config = grammarConfig.statements[result.statementType];
          if (config && config.normalize) {
            const { map } = config.normalize;

            // Transform data using the normalize map
            const normalized: { [key: string]: any } = {};
            Object.entries(map).forEach(([dbField, sourceField]) => {
              if (typeof sourceField === 'string' && sourceField.startsWith('$')) {
                const field = sourceField.substring(1);
                normalized[dbField] = result.data[field];
              } else {
                normalized[dbField] = sourceField;
              }
            });

            // Replace result.data with normalized version
            result.data = normalized;
          }
        });
      }

      // Store to DuckDB if available (data is already normalized above)
      if (results.length > 0 && this.duckdb) {
        const grammarConfig = getGrammarConfig();

        // Group results by statement type
        const grouped = results.reduce((acc, result) => {
          if (!acc[result.statementType]) {
            acc[result.statementType] = [];
          }
          acc[result.statementType].push(result.data);
          return acc;
        }, {} as Record<string, any[]>);

        // Store each type using its own table
        for (const [statementType, items] of Object.entries(grouped)) {
          const config = grammarConfig.statements[statementType];
          if (config && config.normalize) {
            const { table } = config.normalize;
            await this.duckdb.batchInsert(table, items);
            // console.log(`✅ [ResourceParser] Stored ${items.length} ${statementType} to ${table}`);
          }
        }
      }

    } catch (error) {
      console.error('ResourceParser error:', error);
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
        // Extract complete multiline statement (important for VIEWSTATSUMMARY and other complex statements)
        const completeStatement = this.extractStatementContent(content, matchData.match.index || 0);

        // Extract basic data using the configuration
        const extractedData = this.processExtractors(matchData, content, database);

        // Process custom processors with the complete statement
        const processedData = await this.processCustomExtractors(
          extractedData,
          completeStatement,
          config
        );

        // Debug VIEWSTATSUMMARY extraction
        if (statementType === 'VIEWSTATSUMMARY' && matches.length <= 5) {
          // console.log(`[ResourceParser] VIEWSTATSUMMARY: name=${processedData.viewName}, enabled=${processedData.enabled}`);
        }

        // Extract resource-specific information
        const resourceData = this.extractResourceInfo(
          processedData,
          completeStatement,
          content,
          matchData.match.index || 0,
          statementType
        );

        // Validate the data
        if (this.validateExtractedData(resourceData)) {
          results.push({
            data: resourceData,
            statement: matchData.fullMatch,
            statementType,
            database: resourceData.database
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
            processedData[fieldName] = processor(statement);
          } catch (error) {
            // console.warn(`Processor ${processorName} failed for field ${fieldName}:`, error);
          }
        }
      } else if ((extractor as any).type === 'regex') {
        const pattern = (extractor as any).pattern;
        const group = (extractor as any).group || 1;

        if (pattern) {
          const regex = new RegExp(pattern, 'i');
          const match = regex.exec(statement);
          if (match && match[group]) {
            let value = match[group];

            // Apply processor if specified
            if ((extractor as any).processor) {
              const processorName = (extractor as any).processor;
              const processor = grammarConfig.processors[processorName];
              if (processor && typeof processor === 'function') {
                value = processor(value);
              }
            }

            processedData[fieldName] = value;
          }
        }
      }
    });

    return processedData;
  }

  /**
   * Extract resource-specific information
   */
  private extractResourceInfo(
    baseData: any,
    statement: string,
    fullContent: string,
    matchIndex: number,
    statementType: string
  ): ResourceData {
    const database = baseData.database || this.findDatabaseContext(fullContent, matchIndex);

    const resourceData: ResourceData = {
      name: baseData.name || baseData.viewName,
      type: baseData.type || statementType.toLowerCase(),
      database
    };

    // Copy all extracted fields
    Object.keys(baseData).forEach(key => {
      if (key !== 'name' && key !== 'type' && key !== 'database') {
        (resourceData as any)[key] = baseData[key];
      }
    });

    // Set currentDatabase for normalize map compatibility (used by VIEWSTATSUMMARY and others)
    (resourceData as any).currentDatabase = database;

    return resourceData;
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