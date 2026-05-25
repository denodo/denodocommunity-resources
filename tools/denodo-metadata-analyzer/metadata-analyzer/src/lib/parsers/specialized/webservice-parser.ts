/**
 * Web Service Parser - TypeScript exact port
 * Parses CREATE [OR REPLACE] WEBSERVICE, REST WEBSERVICE, and SOAP WEBSERVICE statements
 * Handles both DATASOURCE WS and standalone web service definitions
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface WebServiceData {
  type: string;
  subType: string;
  name: string;
  category: string;
  database?: string;
  analysisId: string;
  timestamp: string;
  description?: string;
  endpoint?: string;
  wsdlLocation?: string;
  operations?: string[];
  authType?: string;
}

/**
 * Web Service Parser - handles WEBSERVICE, REST WEBSERVICE, SOAP WEBSERVICE statements
 */
export class WebServiceParser extends BaseParser {
  private serviceTypes = {
    'REST WEBSERVICE': 'REST',
    'SOAP WEBSERVICE': 'SOAP',
    'WEBSERVICE': 'WEBSERVICE',
    'DATASOURCE WS': 'DATASOURCE_WS'
  };

  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    // Use REST_WEBSERVICE config as base
    const restConfig = grammarConfig.statements['REST_WEBSERVICE'];
    super(restConfig, duckdb);
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      // Parse different types of web services, passing database context
      await this.parseRestWebServices(content, results, database);
      await this.parseSoapWebServices(content, results, database);
      await this.parseDataSourceWebServices(content, results, database);
      await this.parseGenericWebServices(content, results, database);

      // console.log(`📊 WebServiceParser found ${results.length} web services`);
      this.logWebServiceStats(results.map(r => r.data) as any);

      // Store to DuckDB if available
      if (results.length > 0) {
        await this.storeToDatabase(results.map(r => r.data), 'WEBSERVICE');
      }

    } catch (error) {
      console.error('WebServiceParser error:', error);
      throw error;
    }

    return results;
  }

  /**
   * Parse REST Web Service statements - exact port from original
   */
  private async parseRestWebServices(content: string, results: ParseResult[], database?: string): Promise<void> {
    const restPattern = /CREATE\s+(OR\s+REPLACE\s+)?REST\s+WEBSERVICE\s+(?:"([^"]+)"|(\w+))([\s\S]*?)(?=CREATE\s+|$)/gi;
    const matches = [...content.matchAll(restPattern)];

    matches.forEach(match => {
      try {
        const [fullMatch, orReplace, quotedName, simpleName, details] = match;

        const webServiceData: WebServiceData = {
          type: 'webservice',
          subType: 'REST',
          name: this.sanitizeIdentifier(quotedName || simpleName),
          category: 'global',
          database: database || undefined,
          analysisId: this.generateAnalysisId(),
          timestamp: new Date().toISOString()
        };

        // Extract REST-specific details
        this.extractRestServiceDetails(webServiceData, details, fullMatch);

        if (this.validateWebServiceData(webServiceData)) {
          results.push({
            data: webServiceData,
            statement: fullMatch,
            statementType: 'REST_WEBSERVICE',
            database: webServiceData.database
          });
        }
      } catch (error) {
        console.error('Error parsing REST web service:', error);
        // Continue with other matches
      }
    });
  }

  /**
   * Parse SOAP Web Service statements - exact port from original
   */
  private async parseSoapWebServices(content: string, results: ParseResult[], database?: string): Promise<void> {
    const soapPattern = /CREATE\s+(OR\s+REPLACE\s+)?SOAP\s+WEBSERVICE\s+(?:"([^"]+)"|(\w+))([\s\S]*?)(?=CREATE\s+|$)/gi;
    const matches = [...content.matchAll(soapPattern)];

    matches.forEach(match => {
      try {
        const [fullMatch, orReplace, quotedName, simpleName, details] = match;

        const webServiceData: WebServiceData = {
          type: 'webservice',
          subType: 'SOAP',
          name: this.sanitizeIdentifier(quotedName || simpleName),
          category: 'global',
          database: database || undefined,
          analysisId: this.generateAnalysisId(),
          timestamp: new Date().toISOString()
        };

        // Extract SOAP-specific details
        this.extractSoapServiceDetails(webServiceData, details, fullMatch);

        if (this.validateWebServiceData(webServiceData)) {
          results.push({
            data: webServiceData,
            statement: fullMatch,
            statementType: 'SOAP_WEBSERVICE',
            database: webServiceData.database
          });
        }
      } catch (error) {
        console.error('Error parsing SOAP web service:', error);
        // Continue with other matches
      }
    });
  }

  /**
   * Parse DataSource WS statements - exact port from original
   */
  private async parseDataSourceWebServices(content: string, results: ParseResult[], database?: string): Promise<void> {
    const wsPattern = /CREATE\s+(OR\s+REPLACE\s+)?DATASOURCE\s+WS\s+(?:"([^"]+)"|(\w+))([\s\S]*?)(?=CREATE\s+|$)/gi;
    const matches = [...content.matchAll(wsPattern)];

    matches.forEach(match => {
      try {
        const [fullMatch, orReplace, quotedName, simpleName, details] = match;

        const webServiceData: WebServiceData = {
          type: 'datasource',
          subType: 'WS',
          name: this.sanitizeIdentifier(quotedName || simpleName),
          category: 'datasource',
          database: database || undefined,
          analysisId: this.generateAnalysisId(),
          timestamp: new Date().toISOString()
        };

        // Extract WS datasource details
        this.extractWsDataSourceDetails(webServiceData, details, fullMatch);

        if (this.validateWebServiceData(webServiceData)) {
          results.push({
            data: webServiceData,
            statement: fullMatch,
            statementType: 'DATASOURCE_WS',
            database: webServiceData.database
          });
        }
      } catch (error) {
        console.error('Error parsing WS datasource:', error);
        // Continue with other matches
      }
    });
  }

  /**
   * Parse generic WebService statements - exact port from original
   */
  private async parseGenericWebServices(content: string, results: ParseResult[], database?: string): Promise<void> {
    const genericPattern = /CREATE\s+(OR\s+REPLACE\s+)?WEBSERVICE\s+(?!"REST|SOAP")(?:"([^"]+)"|(\w+))([\s\S]*?)(?=CREATE\s+|$)/gi;
    const matches = [...content.matchAll(genericPattern)];

    matches.forEach(match => {
      try {
        const [fullMatch, orReplace, quotedName, simpleName, details] = match;

        const webServiceData: WebServiceData = {
          type: 'webservice',
          subType: 'GENERIC',
          name: this.sanitizeIdentifier(quotedName || simpleName),
          category: 'global',
          database: database || undefined,
          analysisId: this.generateAnalysisId(),
          timestamp: new Date().toISOString()
        };

        // Extract generic service details
        this.extractGenericServiceDetails(webServiceData, details, fullMatch);

        if (this.validateWebServiceData(webServiceData)) {
          results.push({
            data: webServiceData,
            statement: fullMatch,
            statementType: 'WEBSERVICE',
            database: webServiceData.database
          });
        }
      } catch (error) {
        console.error('Error parsing generic web service:', error);
        // Continue with other matches
      }
    });
  }

  /**
   * Extract REST service details - exact port from original
   */
  private extractRestServiceDetails(webServiceData: WebServiceData, details: string, fullMatch: string): void {
    // Extract endpoint URL
    const endpointMatch = details.match(/ENDPOINT\s*=\s*'([^']+)'/i);
    if (endpointMatch) {
      webServiceData.endpoint = endpointMatch[1];
    }

    // Extract description
    const descMatch = details.match(/DESCRIPTION\s*=\s*'([^']*)'/i);
    if (descMatch) {
      webServiceData.description = descMatch[1];
    }
  }

  /**
   * Extract SOAP service details - exact port from original
   */
  private extractSoapServiceDetails(webServiceData: WebServiceData, details: string, fullMatch: string): void {
    // Extract WSDL location
    const wsdlMatch = details.match(/WSDLLOCATION\s*=\s*'([^']+)'/i);
    if (wsdlMatch) {
      webServiceData.wsdlLocation = wsdlMatch[1];
    }

    // Extract endpoint URL
    const endpointMatch = details.match(/ENDPOINT\s*=\s*'([^']+)'/i);
    if (endpointMatch) {
      webServiceData.endpoint = endpointMatch[1];
    }

    // Extract description
    const descMatch = details.match(/DESCRIPTION\s*=\s*'([^']*)'/i);
    if (descMatch) {
      webServiceData.description = descMatch[1];
    }
  }

  /**
   * Extract WS datasource details - exact port from original
   */
  private extractWsDataSourceDetails(webServiceData: WebServiceData, details: string, fullMatch: string): void {
    // Extract URL
    const urlMatch = details.match(/URL\s*=\s*'([^']+)'/i);
    if (urlMatch) {
      webServiceData.endpoint = urlMatch[1];
    }

    // Extract WSDL location
    const wsdlMatch = details.match(/WSDLLOCATION\s*=\s*'([^']+)'/i);
    if (wsdlMatch) {
      webServiceData.wsdlLocation = wsdlMatch[1];
    }
  }

  /**
   * Extract generic service details - exact port from original
   */
  private extractGenericServiceDetails(webServiceData: WebServiceData, details: string, fullMatch: string): void {
    // Extract any URL-like patterns
    const urlMatch = details.match(/(?:URL|ENDPOINT)\s*=\s*'([^']+)'/i);
    if (urlMatch) {
      webServiceData.endpoint = urlMatch[1];
    }

    // Extract description
    const descMatch = details.match(/DESCRIPTION\s*=\s*'([^']*)'/i);
    if (descMatch) {
      webServiceData.description = descMatch[1];
    }
  }

  /**
   * Validate web service data - exact port from original
   */
  private validateWebServiceData(data: WebServiceData): boolean {
    if (!data.name) {
      // console.warn('Web service missing required name field');
      return false;
    }

    if (!data.subType) {
      // console.warn('Web service missing required subType field');
      return false;
    }

    return true;
  }

  /**
   * Sanitize identifier - exact port from original
   */
  private sanitizeIdentifier(value: string): string {
    if (!value) return value;
    return value.replace(/\bOR\s+REPLACE\b/gi, '').replace(/^"([\s\S]*?)"$/, '$1').trim();
  }

  /**
   * Generate analysis ID - exact port from original
   */
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log web service statistics - exact port from original
   */
  private logWebServiceStats(webServices: WebServiceData[]): void {
    const stats = {
      total: webServices.length,
      bySubType: {} as { [subType: string]: number }
    };

    webServices.forEach(ws => {
      stats.bySubType[ws.subType] = (stats.bySubType[ws.subType] || 0) + 1;
    });

    // console.log('Web Service Statistics:', stats);
  }
}