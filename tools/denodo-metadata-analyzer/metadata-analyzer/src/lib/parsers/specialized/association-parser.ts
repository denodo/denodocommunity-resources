/**
 * Association Parser - TypeScript exact port
 * Parses CREATE [OR REPLACE] ASSOCIATION statements
 * Extracts association information including endpoints and mappings
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface AssociationData {
  name: string;
  database?: string;
  kind: string;
  folder?: string;
  endpoints?: Array<{
    table?: string;
    columns?: string[];
  }>;
  mapping?: {
    parsedMappings?: Array<{
      leftColumn?: string;
      rightColumn?: string;
    }>;
  };
}

/**
 * Association Parser - handles ASSOCIATION statements
 */
export class AssociationParser extends BaseParser {
  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    const associationConfig = grammarConfig.statements['ASSOCIATION'];
    super(associationConfig, duckdb);
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      const matches = this.extractMatches(content);
      // console.log(`🔗 [AssociationParser] Found ${matches.length} ASSOCIATION statements`);

      for (const matchData of matches) {
        try {
          // Extract the COMPLETE multiline statement using extractStatementContent
          // This is critical - the pattern only matches the first line, but we need the full statement with ENDPOINT clauses
          const startIndex = matchData.match.index || 0;
          const fullStatement = this.extractStatementContent(content, startIndex);

          // Replace the incomplete fullMatch with the complete statement
          matchData.fullMatch = fullStatement;

          const extractedData = this.processExtractors(matchData, content, database);

          // Add database context
          if (database) {
            extractedData.database = database;
          }

          // Extract endpoints and mapping from the COMPLETE statement
          extractedData.endpoints = this.extractEndpoints(fullStatement);
          extractedData.mapping = this.extractMapping(fullStatement);

          // Debug first few associations
          // if (results.length < 3) {
          //   console.log(`[AssociationParser] Association #${results.length + 1}:`, {
          //     name: extractedData.name,
          //     endpoints: extractedData.endpoints,
          //     endpointsCount: extractedData.endpoints?.length,
          //     statement: fullStatement.substring(0, 200)
          //   });
          // }

          // Validate the data
          if (this.validateAssociationData(extractedData)) {
            results.push({
              data: extractedData,
              statement: fullStatement,
              statementType: 'ASSOCIATION',
              database: extractedData.database
            });
          }

        } catch (error) {
          console.error('Error parsing association:', error);
          // Continue with other matches
        }
      }

      // console.log(`✅ [AssociationParser] Validated ${results.length} associations out of ${matches.length} total`);

      // Store to DuckDB if available
      if (results.length > 0) {
        await this.storeToDatabase(results.map(r => r.data), 'ASSOCIATION');
      }

    } catch (error) {
      console.error('AssociationParser error:', error);
      throw error;
    }

    return results;
  }

  /**
   * Extract association endpoints from statement
   */
  private extractEndpoints(statement: string): any[] {
    if (!statement || typeof statement !== 'string') return [];

    const endpoints = [];
    const endpointRegex = /ENDPOINT\s+(?:"([^"]+)"|(\w+))\s+(\w+)\s+(PRINCIPAL\s+)?\(([^)]+)\)/gi;
    let match;

    while ((match = endpointRegex.exec(statement)) !== null) {
      const alias = match[1] || match[2];
      const table = match[3];
      const isPrincipal = !!match[4];
      const cardinality = match[5].trim();

      endpoints.push({
        alias: alias,
        table: table,
        cardinality: cardinality,
        isPrincipal: isPrincipal
      });
    }

    return endpoints;
  }

  /**
   * Extract association mapping from statement
   */
  private extractMapping(statement: string): any {
    if (!statement || typeof statement !== 'string') return null;

    const mappingMatch = statement.match(/ADD\s+MAPPING\s+([^;]+)/i);
    if (mappingMatch) {
      const mappingStr = mappingMatch[1].trim();

      // Parse the mapping string into structured JSON
      // Format: "col1=col2" or "col1=col2 AND col3=col4"
      const mappings = mappingStr.split(/\s+AND\s+/i).map(pair => {
        const [left, right] = pair.split('=').map(s => s.trim());
        return {
          leftColumn: left,
          rightColumn: right
        };
      });

      return {
        rawMapping: mappingStr,
        parsedMappings: mappings
      };
    }

    return null;
  }

  /**
   * Validate association data - exact port from original
   */
  private validateAssociationData(data: any): boolean {
    // Check required fields
    if (!data.name) {
      // console.warn('Association missing required name field');
      return false;
    }

    // Validate endpoints (silently fail - this is expected for some associations)
    if (!data.endpoints || !Array.isArray(data.endpoints) || data.endpoints.length === 0) {
      return false;
    }

    return this.validateExtractedData(data);
  }

  /**
   * Get association statistics summary - exact port from original
   */
  public getAssociationStats(associations: AssociationData[]) {
    const endpointTables = new Set<string>();
    const mappingColumns = new Set<string>();

    associations.forEach(assoc => {
      if (assoc.endpoints) {
        assoc.endpoints.forEach(endpoint => {
          if (endpoint.table) {
            endpointTables.add(endpoint.table);
          }
        });
      }

      if (assoc.mapping && assoc.mapping.parsedMappings) {
        assoc.mapping.parsedMappings.forEach(mapping => {
          if (mapping.leftColumn) mappingColumns.add(mapping.leftColumn);
          if (mapping.rightColumn) mappingColumns.add(mapping.rightColumn);
        });
      }
    });

    return {
      totalAssociations: associations.length,
      uniqueEndpointTables: endpointTables.size,
      uniqueMappingColumns: mappingColumns.size,
      withMappings: associations.filter(a => a.mapping && a.mapping.parsedMappings).length,
      averageEndpointsPerAssociation: associations.length > 0
        ? associations.reduce((sum, a) => sum + (a.endpoints ? a.endpoints.length : 0), 0) / associations.length
        : 0
    };
  }
}