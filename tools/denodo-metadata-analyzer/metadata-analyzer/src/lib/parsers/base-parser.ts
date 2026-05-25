/**
 * Base Parser Class - TypeScript version with DuckDB integration
 * Provides common functionality for all VQL statement parsers
 * Supports both CREATE and CREATE OR REPLACE patterns
 */

import type { StatementConfig, StatementExtractor } from '../../types/grammar';
import type { DuckDBClient } from '../database/duckdb-client';

export interface MatchData {
  match: RegExpMatchArray;
  patternIndex: number;
  fullMatch: string;
  groups: string[];
}

export interface ExtractedData {
  [key: string]: any;
}

export interface ParseResult {
  data: ExtractedData;
  statement: string;
  statementType: string;
  database?: string;
}

/**
 * Base parser class that all VQL statement parsers extend
 */
export abstract class BaseParser {
  protected config: StatementConfig;
  protected patterns: RegExp[] = [];
  protected extractors: { [key: string]: StatementExtractor };
  protected duckdb?: DuckDBClient;
  protected grammarProcessors?: { [key: string]: (...args: any[]) => any };

  constructor(config: StatementConfig, duckdb?: DuckDBClient, grammarProcessors?: { [key: string]: (...args: any[]) => any }) {
    this.config = config;
    this.extractors = config.extractors || {};
    this.duckdb = duckdb;
    this.grammarProcessors = grammarProcessors;

    this.initializePatterns();
  }

  /**
   * Initialize regex patterns from configuration
   */
  protected initializePatterns(): void {
    if (!this.config.patterns) return;

    this.patterns = this.config.patterns.map(patternTemplate => {
      // Replace global pattern placeholders
      let pattern = patternTemplate;

      // Replace {quotedIdentifier} with the actual pattern
      pattern = pattern.replace(
        /\{quotedIdentifier\}/g,
        '(?:"([^"]+)"|([\\w.-]+))'
      );

      // Replace {createOrReplace} if used
      pattern = pattern.replace(
        /\{createOrReplace\}/g,
        'CREATE\\s+(OR\\s+REPLACE\\s+)?'
      );

      return new RegExp(pattern, 'gi');
    });
  }

  /**
   * Main parsing method - to be implemented by subclasses
   */
  abstract parse(content: string, database?: string): Promise<ParseResult[]>;

  /**
   * Extract matches using configured patterns - OPTIMIZED with exec loop
   */
  protected extractMatches(content: string): MatchData[] {
    const matches: MatchData[] = [];

    this.patterns.forEach((pattern, patternIndex) => {
      // PERFORMANCE: Use exec() loop instead of matchAll() for better performance
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(content)) !== null) {
        matches.push({
          match,
          patternIndex,
          fullMatch: match[0],
          groups: match.slice(1)
        });
      }
    });

    return matches;
  }

  /**
   * Extract field value using extractor configuration
   */
  protected extractField(matchData: MatchData, fieldName: string, extractorConfig: StatementExtractor): any {
    if (!extractorConfig) return null;

    // If it's a static value
    if (extractorConfig.value !== undefined) {
      return extractorConfig.value;
    }

    // Extract from regex group
    if (extractorConfig.group !== undefined) {
      let value = matchData.groups[extractorConfig.group - 1];

      // Try fallback group if primary is empty
      if (!value && extractorConfig.fallbackGroup !== undefined) {
        if (Array.isArray(extractorConfig.fallbackGroup)) {
          // Try multiple fallback groups
          for (const fallbackGroup of extractorConfig.fallbackGroup) {
            value = matchData.groups[fallbackGroup - 1];
            if (value) break;
          }
        } else {
          value = matchData.groups[extractorConfig.fallbackGroup - 1];
        }
      }

      return value || null;
    }

    // Extract using custom pattern
    if (extractorConfig.pattern) {
      const regex = new RegExp(extractorConfig.pattern, 'gi');
      const patternMatch = regex.exec(matchData.fullMatch);

      if (patternMatch && extractorConfig.group) {
        let value = patternMatch[extractorConfig.group];

        // Try fallback group
        if (!value && extractorConfig.fallbackGroup) {
          const fallbackGroup = Array.isArray(extractorConfig.fallbackGroup)
            ? extractorConfig.fallbackGroup[0]
            : extractorConfig.fallbackGroup;
          value = patternMatch[fallbackGroup];
        }

        return value || null;
      }
    }

    // Handle customProcessor type - returns full match for processing
    if ((extractorConfig as any).type === 'customProcessor') {
      return matchData.fullMatch;
    }

    return null;
  }

  /**
   * Process extracted data using custom processors
   */
  protected processField(value: any, processorName?: string, context?: any): any {
    if (!value || !processorName) return value;

    // Built-in processors
    switch (processorName) {
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;

      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;

      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;

      case 'parseBoolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);

      case 'parseNumber':
        return Number(value) || 0;

      case 'sanitizeIdentifier':
        if (!value || typeof value !== 'string') return value;
        return value.replace(/\bOR\s+REPLACE\b/gi, '').replace(/^"([\s\S]*?)"$/, '$1').trim();

      default:
        // Try grammar pack processors
        if (this.grammarProcessors && this.grammarProcessors[processorName]) {
          return this.grammarProcessors[processorName](value);
        }
        // If not found, return value as-is
        return value;
    }
  }

  /**
   * Extract complete statement content (multi-line support)
   */
  protected extractStatementContent(content: string, startIndex: number): string {
    let statementContent = '';
    let braceCount = 0;
    let inQuotes = false;
    let quoteChar = '';
    let foundSemicolon = false;

    for (let i = startIndex; i < content.length && !foundSemicolon; i++) {
      const char = content[i];

      // Handle quotes
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      }

      // Only count braces and semicolons outside quotes
      if (!inQuotes) {
        if (char === '(') braceCount++;
        else if (char === ')') braceCount--;
        else if (char === ';' && braceCount === 0) {
          foundSemicolon = true;
        }
      }

      statementContent += char;
    }

    return statementContent;
  }

  /**
   * Process all extractors for a match and return extracted data
   */
  protected processExtractors(matchData: MatchData, statement: string, database?: string): ExtractedData {
    const data: ExtractedData = {};

    Object.entries(this.extractors).forEach(([fieldName, extractorConfig]) => {
      let value = this.extractField(matchData, fieldName, extractorConfig);

      // Apply processor if specified
      if (value && extractorConfig.processor) {
        value = this.processField(value, extractorConfig.processor, { statement, database });
      }

      // Set the extracted value
      data[fieldName] = value;
    });

    // Add current database if available
    if (database) {
      data.currentDatabase = database;
      } else {
      console.log(`⚠️ No currentDatabase provided for statement type: ${this.config.normalize?.table}`);
    }

    return data;
  }

  /**
   * Store parsed data to DuckDB if client is available and config has normalize
   */
  protected async storeToDatabase(data: ExtractedData[], statementType: string): Promise<void> {
    if (!this.duckdb || !this.config.normalize || !data.length) return;

    const { table, map } = this.config.normalize;

    // Transform data using the normalize map
    const normalizedData = data.map(item => {
      const normalized: { [key: string]: any } = {};

      Object.entries(map).forEach(([dbField, sourceField]) => {
        if (sourceField.startsWith('$')) {
          const field = sourceField.substring(1);
          normalized[dbField] = item[field];
        } else {
          normalized[dbField] = sourceField;
        }
      });

      return normalized;
    });

    // DEBUG: Log first wrapper being stored
    if (table === 'wrappers' && normalizedData.length > 0) {
      console.log('🔍 Storing first wrapper to DuckDB:', {
        name: normalizedData[0].name,
        wrapperType: normalizedData[0].wrapperType,
        dataSourceName: normalizedData[0].dataSourceName,
        hasParameters: !!normalizedData[0].parameters,
        parametersType: typeof normalizedData[0].parameters
      });
    }

    // Store to DuckDB
    try {
      await this.duckdb.batchInsert(table, normalizedData);
    } catch (error) {
      console.error(`Failed to store ${statementType} data to ${table}:`, error);
      throw error;
    }
  }

  /**
   * Validate that required fields are present
   */
  protected validateExtractedData(data: ExtractedData): boolean {
    for (const [fieldName, extractor] of Object.entries(this.extractors)) {
      if (extractor.required && !data[fieldName]) {
        console.warn(`Required field '${fieldName}' is missing or empty`);
        return false;
      }
    }
    return true;
  }
}