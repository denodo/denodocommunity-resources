/**
 * Global Elements Parser - TypeScript exact port
 * Parses CREATE [OR REPLACE] JAR, GLOBAL_SECURITY_POLICY, TAG statements
 * Handles global elements that exist outside specific databases
 * Note: USER and ROLE parsing is handled by SecurityParser
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface GlobalElementData {
  type: string;
  name: string;
  category: string;
  analysisId: string;
  timestamp: string;
  database?: string;
  details?: any;
  filePath?: string;
  size?: number;
  description?: string;
  multiTags?: string[];
}

/**
 * Global Elements Parser - handles JAR, GLOBAL_SECURITY_POLICY, TAG statements
 */
export class GlobalElementsParser extends BaseParser {
  private elementTypes = {
    'JAR': 'jar',
    'GLOBAL_SECURITY_POLICY': 'policy',
    'TAG': 'tag',
    'TAGS': 'tags'
  };

  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    // Use JAR config as base since it's most common
    const jarConfig = grammarConfig.statements['JAR'];
    super(jarConfig, duckdb);
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      // Parse only basic global elements (JAR, POLICY, TAG)
      await this.parseJarFiles(content, results);
      await this.parsePolicies(content, results);
      await this.parseTags(content, results);

      this.logGlobalElementsStats(results.map(r => r.data) as any);

      // Store to DuckDB if available
      if (results.length > 0) {
        await this.storeToDatabase(results.map(r => r.data), 'GLOBAL_ELEMENT');
      }

    } catch (error) {
      console.error('GlobalElementsParser error:', error);
      throw error;
    }

    return results;
  }

  /**
   * Parse JAR statements - exact port from original
   */
  private async parseJarFiles(content: string, results: ParseResult[]): Promise<void> {
    const jarPattern = /CREATE\s+(OR\s+REPLACE\s+)?JAR\s+(?:"([^"]+)"|(\w+))\s+(.+?)(?=\s*;)/gi;
    const matches = [...content.matchAll(jarPattern)];

    matches.forEach(match => {
      try {
        const [fullMatch, orReplace, quotedName, simpleName, details] = match;

        const jarData: GlobalElementData = {
          type: 'jar',
          name: quotedName || simpleName,
          category: 'global',
          analysisId: this.generateAnalysisId(),
          timestamp: new Date().toISOString()
        };

        // Extract JAR file details
        this.extractJarDetails(jarData, details);

        if (this.validateGlobalElement(jarData)) {
          results.push({
            data: jarData,
            statement: fullMatch,
            statementType: 'JAR',
            database: jarData.database
          });
        }
      } catch (error) {
        console.error('Error parsing JAR:', error);
        // Continue with other matches
      }
    });
  }

  /**
   * Parse policy statements - exact port from original
   */
  private async parsePolicies(content: string, results: ParseResult[]): Promise<void> {
    const policyPattern = /CREATE\s+(OR\s+REPLACE\s+)?GLOBAL_SECURITY_POLICY\s+(?:"([^"]+)"|(\w+))\s+(.+?)(?=\s*;)/gi;
    const matches = [...content.matchAll(policyPattern)];

    matches.forEach(match => {
      try {
        const [fullMatch, orReplace, quotedName, simpleName, details] = match;

        const policyData: GlobalElementData = {
          type: 'policy',
          name: quotedName || simpleName,
          category: 'global',
          analysisId: this.generateAnalysisId(),
          timestamp: new Date().toISOString()
        };

        // Extract policy details
        this.extractPolicyDetails(policyData, details);

        if (this.validateGlobalElement(policyData)) {
          results.push({
            data: policyData,
            statement: fullMatch,
            statementType: 'GLOBAL_SECURITY_POLICY',
            database: policyData.database
          });
        }
      } catch (error) {
        console.error('Error parsing policy:', error);
        // Continue with other matches
      }
    });
  }

  /**
   * Parse tag statements - exact port from original
   */
  private async parseTags(content: string, results: ParseResult[]): Promise<void> {
    // Multi-tag syntax: CREATE OR REPLACE TAGS (tag1, tag2, tag3 DESCRIPTION = 'desc', tag4);
    const multiTagPattern = /CREATE\s+(OR\s+REPLACE\s+)?TAGS\s*\(([^)]+)\)/gi;
    const multiTagMatches = [...content.matchAll(multiTagPattern)];

    multiTagMatches.forEach(match => {
      try {
        const [fullMatch, orReplace, tagList] = match;

        const tagData: GlobalElementData = {
          type: 'tags',
          name: 'multi_tag',
          category: 'global',
          analysisId: this.generateAnalysisId(),
          timestamp: new Date().toISOString(),
          multiTags: this.parseTagList(tagList)
        };

        if (this.validateGlobalElement(tagData)) {
          results.push({
            data: tagData,
            statement: fullMatch,
            statementType: 'TAG',
            database: tagData.database
          });
        }
      } catch (error) {
        console.error('Error parsing multi-tag:', error);
        // Continue with other matches
      }
    });

    // Individual tag syntax: CREATE OR REPLACE TAG tagname
    const singleTagPattern = /CREATE\s+(OR\s+REPLACE\s+)?TAG\s+(?:"([^"]+)"|(\w+))/gi;
    const singleTagMatches = [...content.matchAll(singleTagPattern)];

    singleTagMatches.forEach(match => {
      try {
        const [fullMatch, orReplace, quotedName, simpleName] = match;

        const tagData: GlobalElementData = {
          type: 'tag',
          name: quotedName || simpleName,
          category: 'global',
          analysisId: this.generateAnalysisId(),
          timestamp: new Date().toISOString()
        };

        if (this.validateGlobalElement(tagData)) {
          results.push({
            data: tagData,
            statement: fullMatch,
            statementType: 'TAG',
            database: tagData.database
          });
        }
      } catch (error) {
        console.error('Error parsing single tag:', error);
        // Continue with other matches
      }
    });
  }

  /**
   * Extract JAR details - exact port from original
   */
  private extractJarDetails(jarData: GlobalElementData, details: string): void {
    // Extract file path
    const pathMatch = details.match(/'([^']+)'/);
    if (pathMatch) {
      jarData.filePath = pathMatch[1];
    }

    // Extract additional JAR information
    jarData.details = details.trim();
  }

  /**
   * Extract policy details - exact port from original
   */
  private extractPolicyDetails(policyData: GlobalElementData, details: string): void {
    // Extract policy configuration
    policyData.details = details.trim();

    // Extract description if present
    const descMatch = details.match(/DESCRIPTION\s*=\s*'([^']*)'/i);
    if (descMatch) {
      policyData.description = descMatch[1];
    }
  }

  /**
   * Parse tag list for multi-tag syntax
   */
  private parseTagList(tagList: string): string[] {
    // Simple parsing - split by comma and clean up
    return tagList.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.replace(/DESCRIPTION\s*=\s*'[^']*'/i, '').trim())
      .filter(tag => tag.length > 0);
  }

  /**
   * Validate global element data - exact port from original
   */
  private validateGlobalElement(data: GlobalElementData): boolean {
    if (!data.name) {
      // console.warn('Global element missing required name field');
      return false;
    }

    if (!data.type) {
      // console.warn('Global element missing required type field');
      return false;
    }

    return true;
  }

  /**
   * Generate analysis ID - exact port from original
   */
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log global elements statistics - exact port from original
   */
  private logGlobalElementsStats(elements: GlobalElementData[]): void {
    const stats = {
      total: elements.length,
      byType: {} as { [type: string]: number }
    };

    elements.forEach(element => {
      stats.byType[element.type] = (stats.byType[element.type] || 0) + 1;
    });

    // console.log(`📊 GlobalElementsParser found ${stats.total} global elements:`, stats.byType);
  }
}