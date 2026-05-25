/**
 * Statement Dispatcher - Routes VQL statements to appropriate parsers
 * Exact TypeScript port of working React JavaScript version
 */

import { getGrammarConfig } from '../grammar';
import type { GrammarConfig, StatementConfig } from '../../types/grammar';

export interface StatementMatcher {
  regex: RegExp;
  originalPattern: string;
}

export interface StatementTypeInfo {
  matchers: StatementMatcher[];
  config: StatementConfig;
  priority: number;
}

export interface DispatchResult {
  statementType: string;
  config: StatementConfig;
  statement: string;
  confidence: number;
}

/**
 * Dispatches VQL statements to appropriate parsers based on grammar configuration
 * EXACT PORT from working React JavaScript version
 */
export class StatementDispatcher {
  private currentDatabase: string | null = null;
  private statementMatchers = new Map<string, StatementTypeInfo>();
  private contextChangeTypes = new Set<string>();
  private grammarConfig: GrammarConfig;

  constructor() {
    this.grammarConfig = getGrammarConfig();
    this.contextChangeTypes = new Set(['DATABASE', 'USE_DATABASE', 'ALTER_DATABASE']);
    this.initializeMatchers();
  }

  /**
   * Initialize fast statement matchers from grammar config
   * EXACT PORT from React version
   */
  private initializeMatchers(): void {
    Object.entries(this.grammarConfig.statements).forEach(([statementType, config]) => {
      if (!config.patterns || !config.patterns.length) return;

      // Create optimized matchers for quick statement classification
      const matchers: StatementMatcher[] = config.patterns.map(pattern => ({
        regex: new RegExp(pattern, 'i'),
        originalPattern: pattern
      }));

      this.statementMatchers.set(statementType, {
        matchers,
        config,
        priority: this.getStatementPriority(statementType)
      });
    });
  }

  /**
   * Get priority for statement type (higher priority = checked first)
   * EXACT COPY from React version
   */
  private getStatementPriority(statementType: string): number {
    const priorities: { [key: string]: number } = {
      'DATABASE': 100,
      'USE_DATABASE': 95,
      'ALTER_DATABASE': 90,  // High priority for database context changes
      'ALTER_VIEW': 88,      // High priority for view cache modifications
      'ALTER_ROLE': 87,      // High priority for role modifications
      'INTERFACE_VIEW': 85,  // Check before VIEW
      'VIEW': 80,
      'TABLE': 75,
      'DATASOURCE_JDBC': 70,
      'DATASOURCE_CUSTOM': 65,
      'DATASOURCE_DF': 60,
      'WRAPPER': 50,
      'RESOURCE_MANAGER_PLAN': 45,  // Resource management
      'RESOURCE_MANAGER_RULE': 44,
      'USER': 40,
      'ROLE': 35,
      'JAR': 32,
      'TAG': 31,
      'MAP': 30,
      'ASSOCIATION': 30,  // Association parsing priority
      // Ensure REST/SOAP WEBSERVICE statements classify before generic WEBSERVICE
      'REST_WEBSERVICE': 55,
      'SOAP_WEBSERVICE': 55,
      'WEBSERVICE': 54
    };

    return priorities[statementType] || 10;
  }

  /**
   * Classify a VQL statement and return parsing information
   * EXACT PORT from working React JavaScript version
   */
  public classifyStatement(statement: string): any {
    if (!statement || !statement.trim()) return null;

    const cleanStatement = this.stripLeadingComments(statement);
    if (!cleanStatement) return null;

    // Get sorted matchers by priority
    const sortedMatchers = Array.from(this.statementMatchers.entries())
      .sort(([, a], [, b]) => b.priority - a.priority);

    // Try to match against each statement type
    for (const [statementType, { matchers, config }] of sortedMatchers) {
      for (const matcher of matchers) {
        const match = matcher.regex.exec(cleanStatement);
        if (match) {
          return {
            type: statementType,
            match,
            config,
            statement: cleanStatement,
            originalStatement: statement,
            currentDatabase: this.currentDatabase
          };
        }
      }
    }

    return null;
  }

  /**
   * Process a classified statement and extract data
   * EXACT PORT from working React JavaScript version
   */
  public processStatement(classification: any): any {
    if (!classification) return null;

    try {
      const { type, match, config, statement, currentDatabase } = classification;

      // Extract fields using grammar configuration
      const extractedData = this.extractFields(match, statement, config.extractors);

      // Add context information
      extractedData.statementType = type;
      extractedData.currentDatabase = currentDatabase;
      extractedData.timestamp = new Date().toISOString();

      // Handle database context changes
      if (this.contextChangeTypes.has(type)) {
        this.updateDatabaseContext(extractedData);
      }

      return extractedData;

    } catch (error) {
      console.error(`Error processing ${classification.type} statement:`, error);
      return null;
    }
  }

  /**
   * Extract fields from statement match using extractor configuration
   * EXACT PORT from working React JavaScript version
   */
  private extractFields(match: RegExpExecArray, statement: string, extractors: any): any {
    const data: any = {};

    if (!extractors) return data;

    Object.entries(extractors).forEach(([fieldName, extractorConfig]: [string, any]) => {
      let value = null;

      try {
        // Static value
        if (extractorConfig.value !== undefined) {
          value = extractorConfig.value;
        }
        // Extract from regex group
        else if (extractorConfig.group !== undefined) {
          value = match[extractorConfig.group] || null;

          // Try fallback groups if primary is empty
          if (!value && extractorConfig.fallbackGroup !== undefined) {
            if (Array.isArray(extractorConfig.fallbackGroup)) {
              // Try each fallback group in order
              for (const group of extractorConfig.fallbackGroup) {
                value = match[group];
                if (value) break;
              }
            } else {
              value = match[extractorConfig.fallbackGroup] || null;
            }
          }
        }
        // Extract using custom pattern
        else if (extractorConfig.pattern) {
          const regex = new RegExp(extractorConfig.pattern, 'gi');
          const patternMatch = regex.exec(statement);

          if (patternMatch && extractorConfig.group) {
            value = patternMatch[extractorConfig.group] || null;
          }
        }
        // Key-value extraction
        else if (extractorConfig.type === 'keyValue' && extractorConfig.keys) {
          if (extractorConfig.pattern) {
            // Use specific pattern from config
            const patternRegex = new RegExp(extractorConfig.pattern, 'i');
            const patternMatch = patternRegex.exec(statement);
            if (patternMatch) {
              value = patternMatch[extractorConfig.group] ||
                     (extractorConfig.fallbackGroup ? patternMatch[extractorConfig.fallbackGroup] : null) ||
                     (extractorConfig.fallbackGroup2 ? patternMatch[extractorConfig.fallbackGroup2] : null);
            }
          } else {
            // Fall back to generic key-value extraction
            value = this.extractKeyValue(statement, extractorConfig.keys);
          }
        }
        // Pattern-based extraction
        else if (extractorConfig.type === 'pattern' && extractorConfig.pattern) {
          const patternRegex = new RegExp(extractorConfig.pattern, 'i');
          const patternMatch = patternRegex.exec(statement);
          if (patternMatch) {
            value = patternMatch[extractorConfig.group] ||
                   (extractorConfig.fallbackGroup ? patternMatch[extractorConfig.fallbackGroup] : null) ||
                   (extractorConfig.fallbackGroup2 ? patternMatch[extractorConfig.fallbackGroup2] : null);
          }
        }
        // Identifier after pattern
        else if (extractorConfig.type === 'identifierAfter' && extractorConfig.pattern) {
          value = this.parseIdentifierAfter(extractorConfig.pattern, statement);
        }
        // Conditional extraction - check patterns in order and return first match
        else if (extractorConfig.type === 'conditional' && extractorConfig.conditions) {
          for (const condition of extractorConfig.conditions) {
            if (condition.pattern) {
              const conditionRegex = new RegExp(condition.pattern, 'i');
              if (conditionRegex.test(statement)) {
                value = condition.value;
                break;
              }
            }
          }
        }
        // Custom processor type
        else if (extractorConfig.type === 'customProcessor' && extractorConfig.processor) {
          const processor = this.grammarConfig.processors[extractorConfig.processor];
          if (processor) {
            // Pass both statement and already-extracted data for processors that need it
            value = processor(statement, data);
          }
        }

        // Apply processor if specified (but not for customProcessor type since it's already processed)
        if (value && extractorConfig.processor && extractorConfig.type !== 'customProcessor') {
          const processor = this.grammarConfig.processors[extractorConfig.processor];
          if (processor) {
            value = processor(value);
          }
        }

        // Set default if no value found
        if (value === null && extractorConfig.default !== undefined) {
          value = extractorConfig.default;
        }

        // Only add non-null values unless required
        if (value !== null || extractorConfig.required) {
          data[fieldName] = value;
        }

      } catch (error) {
        console.warn(`Error extracting field ${fieldName}:`, error);
        if (extractorConfig.required) {
          data[fieldName] = extractorConfig.default || null;
        }
      }
    });

    return data;
  }

  /**
   * Extract key-value pairs from statement
   * EXACT PORT from working React JavaScript version
   */
  private extractKeyValue(statement: string, keys: string[]): string | null {
    for (const key of keys) {
      const pattern = new RegExp(`\\b${key}\\s*(?:=\\s*)?'([^']*)'`, 'i');
      const match = pattern.exec(statement);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Parse identifier after a pattern (supports quoted and unquoted identifiers)
   * EXACT PORT from working React JavaScript version
   */
  private parseIdentifierAfter(prefixPattern: string, statement: string): string | null {
    const regex = new RegExp(prefixPattern, 'i');
    const match = regex.exec(statement);
    if (!match) return null;

    let i = match.index + match[0].length;

    // Handle quoted identifier
    if (statement.charAt(i) === '"') {
      let j = i + 1;
      const name = [];
      while (j < statement.length) {
        const c = statement.charAt(j);
        if (c === '"') {
          if (statement.charAt(j + 1) === '"') {
            name.push('"');
            j += 2;
            continue;
          }
          j++;
          break;
        }
        name.push(c);
        j++;
      }
      return name.join('');
    }

    // Handle unquoted identifier: read to next whitespace
    let j = i;
    while (j < statement.length && !/\s/.test(statement.charAt(j))) {
      j++;
    }
    return statement.slice(i, j);
  }

  /**
   * Update current database context based on statement
   * EXACT PORT from working React JavaScript version
   */
  private updateDatabaseContext(extractedData: any): void {
    if (extractedData.name) {
      const newDatabase = extractedData.name;
      if (newDatabase !== this.currentDatabase) {
        this.currentDatabase = newDatabase;
      }
    }
  }

  /**
   * Strip leading comments from statement
   * EXACT PORT from working React JavaScript version
   */
  private stripLeadingComments(statement: string): string {
    let i = 0;
    const n = statement.length;

    while (i < n) {
      const ch = statement.charAt(i);

      // Skip whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Skip line comment -- or #
      if (statement.startsWith('--', i) || ch === '#') {
        const j = statement.indexOf('\n', i);
        if (j === -1) return '';
        i = j + 1;
        continue;
      }

      // Skip block comment /* */
      if (statement.startsWith('/*', i)) {
        const j = statement.indexOf('*/', i + 2);
        if (j === -1) return '';
        i = j + 2;
        continue;
      }

      // Found non-comment content
      break;
    }

    return statement.slice(i);
  }

  /**
   * Reset database context
   */
  public resetContext(): void {
    this.currentDatabase = null;
  }

  /**
   * Get current database context
   */
  public getCurrentDatabase(): string | null {
    return this.currentDatabase;
  }

  /**
   * Set current database context
   */
  public setCurrentDatabase(database: string | null): void {
    this.currentDatabase = database;
  }

  /**
   * Dispatch method to match parser registry expectations
   * Combines classifyStatement and basic validation
   */
  public dispatch(statement: string): DispatchResult | null {
    const classification = this.classifyStatement(statement);
    if (!classification) return null;

    return {
      statementType: classification.type,
      config: classification.config,
      statement: classification.statement,
      confidence: 1.0
    };
  }

  /**
   * Process context change for parser registry
   */
  public processContextChange(dispatch: DispatchResult, data: any): void {
    if (this.contextChangeTypes.has(dispatch.statementType)) {
      this.updateDatabaseContext(data);
    }
  }

  /**
   * Get supported statement types
   */
  public getSupportedStatementTypes(): string[] {
    return Array.from(this.statementMatchers.keys());
  }

  /**
   * Get statistics about statement processing
   */
  public getStats(): any {
    return {
      supportedStatementTypes: this.statementMatchers.size,
      currentDatabase: this.currentDatabase,
      contextChangeTypes: Array.from(this.contextChangeTypes)
    };
  }
}
