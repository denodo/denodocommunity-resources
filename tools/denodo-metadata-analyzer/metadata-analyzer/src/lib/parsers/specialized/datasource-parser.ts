/**
 * DataSource Parser - TypeScript version with DuckDB integration
 * Parses CREATE [OR REPLACE] DATASOURCE statements
 * Supports all Denodo data source types
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';
import { getGrammarConfig } from '../../grammar';

export interface DataSourceData {
  name: string;
  type: string;
  database?: string;
  url?: string;
  driver?: string;
  databaseName?: string;
  databaseVersion?: string;
  username?: string;
  classpath?: string;
  vendor?: string;
  dsn?: string;
  serverName?: string;
  routeType?: string;
  routeConnection?: string;
  webServiceType?: string;
  wsdlLocation?: string;
  endpoint?: string;
  className?: string;
  folder?: string;
}

/**
 * DataSource Parser - handles all DATASOURCE types
 */
export class DataSourceParser extends BaseParser {
  private typeMapping = {
    'JDBC': 'JDBC',
    'JSON': 'JSON',
    'XML': 'XML',
    'DF': 'DelimitedFile',
    'MONGODB': 'MongoDB',
    'LDAP': 'LDAP',
    'SALESFORCE': 'Salesforce',
    'ODBC': 'ODBC',
    'CUSTOM': 'Custom',
    'WS': 'WebService',
    'SOAP': 'WebService'
  };

  constructor(duckdb?: DuckDBClient) {
    const grammarConfig = getGrammarConfig();
    // Use DATASOURCE_JDBC as the base config (most complete)
    const jdbcConfig = grammarConfig.statements['DATASOURCE_JDBC'];
    // Pass grammar processors to base parser so custom processors like extractJdbcDatabaseName work
    super(jdbcConfig, duckdb, grammarConfig.processors);
  }

  async parse(content: string, database?: string): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      // Parse all datasource types
      const datasourceTypes = [
        'DATASOURCE_JDBC',
        'DATASOURCE_CUSTOM',
        'DATASOURCE_DF',
        'DATASOURCE_JSON',
        'DATASOURCE_XML',
        'DATASOURCE_WS',
        'DATASOURCE_MONGODB',
        'DATASOURCE_SALESFORCE',
        'DATASOURCE_LDAP',
        'DATASOURCE_ODBC'
      ];

      for (const dsType of datasourceTypes) {
        await this.parseDataSourceType(content, dsType, database, results);
      }

      // console.log(`📊 DataSourceParser found ${results.length} data sources`);

      // Store to DuckDB if available
      if (results.length > 0) {
        await this.storeToDatabase(results.map(r => r.data), 'DATASOURCE');
      }

    } catch (error) {
      console.error('DataSourceParser error:', error);
      throw error;
    }

    return results;
  }

  /**
   * Parse specific datasource type
   */
  private async parseDataSourceType(
    content: string,
    dsType: string,
    database: string | undefined,
    results: ParseResult[]
  ): Promise<void> {
    const grammarConfig = getGrammarConfig();
    const config = grammarConfig.statements[dsType];

    if (!config || !config.patterns) return;

    // Temporarily update patterns for this datasource type
    const originalPatterns = this.patterns;
    this.patterns = config.patterns.map(pattern => new RegExp(pattern, 'gim'));
    const originalExtractors = this.extractors;
    this.extractors = config.extractors || {};

    const matches = this.extractMatches(content);

    for (const matchData of matches) {
      try {
        // CRITICAL: Extract the complete multiline statement (not just the first line)
        const startIndex = matchData.match.index || 0;
        const completeStatement = this.extractStatementContent(content, startIndex);

        // Update matchData with complete statement
        matchData.fullMatch = completeStatement;

        // Extract basic data using the configuration
        const extractedData = this.processExtractors(matchData, content, database);

        // Process custom processors with COMPLETE statement (includes DATABASENAME, etc.)
        const processedData = await this.processCustomExtractors(
          extractedData,
          completeStatement,  // Pass complete statement to custom processors
          config
        );

        // Extract datasource-specific information
        const dataSourceData = this.extractDataSourceInfo(
          processedData,
          matchData.fullMatch,
          content,
          matchData.match.index || 0,
          dsType
        );

        // Validate the data
        if (this.validateExtractedData(dataSourceData)) {
          results.push({
            data: dataSourceData,
            statement: matchData.fullMatch,
            statementType: dsType,
            database: dataSourceData.database
          });
        }

      } catch (error) {
        console.error(`Error parsing ${dsType}:`, error);
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
      }
    });

    return processedData;
  }

  /**
   * Extract datasource-specific information
   */
  private extractDataSourceInfo(
    baseData: any,
    statement: string,
    fullContent: string,
    matchIndex: number,
    dsType: string
  ): DataSourceData {
    // Find database context - try baseData first, then findDatabaseContext
    let databaseContext = baseData.database;
    if (!databaseContext || databaseContext.trim() === '') {
      databaseContext = this.findDatabaseContext(fullContent, matchIndex);
      if (!databaseContext && matchIndex < 500) {
        // Debug first few datasources
        // console.log(`[DataSourceParser] No database context found for datasource at index ${matchIndex}, name: ${baseData.name}`);
      }
    }

    const dataSourceData: DataSourceData = {
      name: baseData.name,
      type: this.typeMapping[baseData.type as keyof typeof this.typeMapping] || baseData.type,
      database: databaseContext
    };

    // Copy all extracted fields
    Object.keys(baseData).forEach(key => {
      if (key !== 'name' && key !== 'type' && key !== 'database') {
        (dataSourceData as any)[key] = baseData[key];
      }
    });

    // Apply post-processing based on datasource type
    this.applyTypeSpecificProcessing(dataSourceData, statement, dsType);

    return dataSourceData;
  }

  /**
   * Apply type-specific processing
   */
  private applyTypeSpecificProcessing(
    dataSourceData: DataSourceData,
    statement: string,
    dsType: string
  ): void {
    switch (dsType) {
      case 'DATASOURCE_JDBC':
        this.processJdbcDataSource(dataSourceData, statement);
        break;
      case 'DATASOURCE_MONGODB':
        this.processMongoDataSource(dataSourceData, statement);
        break;
      case 'DATASOURCE_WS':
        this.processWebServiceDataSource(dataSourceData, statement);
        break;
      // Add more specific processing as needed
    }
  }

  /**
   * Process JDBC-specific data
   */
  private processJdbcDataSource(dataSourceData: DataSourceData, statement: string): void {
    // Extract vendor information if not already set
    if (!dataSourceData.vendor && dataSourceData.url && dataSourceData.driver) {
      dataSourceData.vendor = this.detectVendor(dataSourceData.url, dataSourceData.driver);
    }

    // Extract database name if not already set
    if (!dataSourceData.databaseName) {
      const dbNameMatch = statement.match(/DATABASENAME\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s,;#)\r\n]+))/i);
      if (dbNameMatch) {
        dataSourceData.databaseName = (dbNameMatch[1] || dbNameMatch[2] || dbNameMatch[3] || '').trim();
      }
    }
  }

  /**
   * Process MongoDB-specific data
   */
  private processMongoDataSource(dataSourceData: DataSourceData, statement: string): void {
    // MongoDB-specific processing
    if (dataSourceData.url && !dataSourceData.url.startsWith('mongodb://')) {
      // Normalize MongoDB URLs
      if (!dataSourceData.url.includes('://')) {
        dataSourceData.url = `mongodb://${dataSourceData.url}`;
      }
    }
  }

  /**
   * Process WebService-specific data
   */
  private processWebServiceDataSource(dataSourceData: DataSourceData, statement: string): void {
    // Set web service type
    dataSourceData.webServiceType = 'SOAP';

    // Extract WSDL location
    const wsdlMatch = statement.match(/WSDLLOCATION\s*=\s*'([^']*)'/i);
    if (wsdlMatch) {
      dataSourceData.wsdlLocation = wsdlMatch[1];
    }
  }

  /**
   * Detect database vendor from URL and driver
   */
  private detectVendor(url?: string, driver?: string): string {
    if (!url && !driver) return 'unknown';

    const u = (url || '').toLowerCase();
    const d = (driver || '').toLowerCase();

    const vendors = [
      { name: 'oracle', patterns: ['jdbc:oracle:', 'oracle.jdbc', 'thin:@'] },
      { name: 'sql server', patterns: ['jdbc:sqlserver:', 'microsoft.sqlserver', 'sqlserverdriver'] },
      { name: 'postgresql', patterns: ['jdbc:postgresql:', 'org.postgresql'] },
      { name: 'mysql', patterns: ['jdbc:mysql:', 'com.mysql', 'mysql.cj'] },
      { name: 'mariadb', patterns: ['jdbc:mariadb:', 'org.mariadb'] },
      { name: 'db2', patterns: ['jdbc:db2:', 'ibm.db2'] },
      { name: 'snowflake', patterns: ['jdbc:snowflake:', 'snowflake'] },
      { name: 'redshift', patterns: ['jdbc:redshift:', 'redshift'] },
      { name: 'sap hana', patterns: ['jdbc:sap:', 'sap.db.jdbc', 'hana'] },
      { name: 'teradata', patterns: ['jdbc:teradata:', 'teradata'] },
      { name: 'vertica', patterns: ['jdbc:vertica:', 'vertica'] },
      { name: 'bigquery', patterns: ['simba.googlebigquery', 'jdbc:bigquery:', 'bigquery'] },
      { name: 'athena', patterns: ['jdbc:awsathena', 'jdbc:athena:', 'athena'] }
    ];

    for (const vendor of vendors) {
      if (vendor.patterns.some(pattern => u.includes(pattern) || d.includes(pattern))) {
        return vendor.name;
      }
    }

    // Fallback to JDBC scheme
    if (u.startsWith('jdbc:')) {
      const parts = u.split(':');
      if (parts.length >= 2) return parts[1];
    }

    return 'unknown';
  }

  /**
   * Find database context for a datasource
   */
  private findDatabaseContext(content: string, matchIndex: number): string | undefined {
    // Look backwards for the nearest CREATE DATABASE or USE DATABASE or CONNECT DATABASE statement
    const contentBeforeMatch = content.substring(0, matchIndex);
    const lines = contentBeforeMatch.split('\n').reverse();

    // Debug: log for first datasource
    const isFirstCheck = matchIndex < 1000;
    if (isFirstCheck) {
      // console.log(`[DataSourceParser] findDatabaseContext called, matchIndex=${matchIndex}, searching ${lines.length} lines`);
    }

    let checkedLines = 0;
    for (const line of lines) {
      checkedLines++;
      const trimmedLine = line.trim();

      // Check for USE DATABASE or CONNECT DATABASE
      const useMatch = trimmedLine.match(/(?:USE|CONNECT)\s+DATABASE\s+(?:"([^"]+)"|'([^']+)'|([\w.-]+))/i);
      if (useMatch) {
        const dbName = useMatch[1] || useMatch[2] || useMatch[3];
        return dbName;
      }

      // Check for CREATE DATABASE
      const createMatch = trimmedLine.match(/CREATE\s+(?:OR\s+REPLACE\s+)?DATABASE\s+(?:"([^"]+)"|'([^']+)'|([\w.-]+))/i);
      if (createMatch) {
        const dbName = createMatch[1] || createMatch[2] || createMatch[3];
        return dbName;
      }

      // Safety check - don't search more than 1000 lines back
      if (checkedLines > 1000) break;
    }

    return undefined;
  }

  /**
   * Resolve property references or return direct values
   */
  private resolveValueOrProperty(value: any, propertiesData: { [key: string]: any } = {}): any {
    if (!value || typeof value !== 'string') {
      return value;
    }

    // Remove surrounding quotes first to check for property references
    const unquotedValue = value.replace(/^['\"]([^'\"]*)['\"]$/, '$1');

    // Check if it's a property reference like ${databases.admin.datasources.jdbc.vdpcachedatasource.DATABASEURI}
    const propertyRefRegex = /^\$\{([^}]+)\}$/;
    const match = unquotedValue.match(propertyRefRegex);

    if (match) {
      const propertyKey = match[1];
      const resolvedValue = propertiesData[propertyKey];

      if (resolvedValue !== undefined) {
        return resolvedValue;
      } else {
        // Return the raw property reference for now instead of null
        return unquotedValue;
      }
    }

    // If it's not a property reference, return the unquoted value
    return unquotedValue;
  }
}