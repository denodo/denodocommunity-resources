/**
 * ServerConfigParser - TypeScript exact port
 * Extracts server configuration settings from VQL content
 */

import { BaseParser, type ParseResult } from '../base-parser';
import type { DuckDBClient } from '../../database/duckdb-client';

export interface ServerConfigData {
  [key: string]: string | number | boolean | undefined;
  analysisId?: string;
  timestamp?: string;
}

/**
 * Server Config Parser - handles server configuration extraction
 */
export default class ServerConfigParser extends BaseParser {
  private configMap = {
    // Cache settings
    'com.denodo.vdb.cache.cacheStatus': 'cacheStatus',
    'com.denodo.vdb.cache.cacheMaintenance': 'cacheMaintenance',
    'com.denodo.vdb.cache.jdbc.serverCacheDataSource': 'serverCacheDataSource',
    'com.denodo.vdb.cache.timeToLiveInSecs': 'timeToLiveInSecs',

    // Security settings
    'com.denodo.vdb.security.KerberosAuthenticator.useKerberos': 'useKerberos',
    'com.denodo.vdb.security.LDAPAuthenticator.useLDAP': 'useLDAP',
    'com.denodo.vdb.security.LDAPAuthenticator.LDAPDatasourceName': 'LDAPDatasourceName',
    'com.denodo.vdb.security.OauthAuthenticator.useOAuth2': 'useOAuth2',
    'com.denodo.vdb.security.SAMLAuthenticator.useSAML': 'useSAML',
    'com.denodo.vdb.vault.enabled': 'vaultEnabled',
    'com.denodo.vdb.vault.plugin': 'vaultPlugin',

    // Query optimization
    'com.denodo.vdb.interpreter.execution.SelectAction.costoptimization': 'costoptimization',
    'com.denodo.vdb.interpreter.execution.SelectAction.dataMovement': 'dataMovement',
    'com.denodo.vdb.interpreter.execution.SelectAction.simplify': 'simplify',
    'com.denodo.vdb.interpreter.execution.SelectAction.summaryRewrite': 'summaryRewrite',

    // System settings
    'com.denodo.vdb.catalog.database.identifiersCharset': 'identifiersCharset',
    'com.denodo.vdb.catalog.database.maxActiveConnections': 'maxActiveConnections',
    'com.denodo.vdb.catalog.database.maxIdleConnections': 'maxIdleConnections',
    'com.denodo.vdb.catalog.database.minPoolSize': 'minPoolSize',
    'com.denodo.vdb.catalog.database.maxPoolSize': 'maxPoolSize',

    // Memory and performance
    'com.denodo.vdb.interpreter.execution.SelectAction.maxMemorySwapSize': 'maxMemorySwapSize',
    'com.denodo.vdb.interpreter.execution.SelectAction.maxMemorySize': 'maxMemorySize',
    'com.denodo.vdb.interpreter.execution.SelectAction.swapSize': 'swapSize',

    // Logging
    'com.denodo.vdb.log.requests': 'logRequests',
    'com.denodo.vdb.log.summary': 'logSummary',
    'com.denodo.vdb.log.queryplan': 'logQueryplan',

    // Connection settings
    'com.denodo.vdb.catalog.database.connectionTimeout': 'connectionTimeout',
    'com.denodo.vdb.catalog.database.validationQuery': 'validationQuery',
    'com.denodo.vdb.catalog.database.testOnBorrow': 'testOnBorrow',
    'com.denodo.vdb.catalog.database.testOnReturn': 'testOnReturn',
    'com.denodo.vdb.catalog.database.testWhileIdle': 'testWhileIdle',

    // Network settings
    'com.denodo.vdb.util.tablemanagement.sql.urn.ping.numretries': 'pingNumRetries',
    'com.denodo.vdb.util.tablemanagement.sql.urn.ping.timeout': 'pingTimeout',

    // I18n settings
    'com.denodo.vdb.util.lang.i18n': 'i18nLanguage',
    'com.denodo.vdb.util.lang.country': 'country',
    'com.denodo.vdb.util.lang.timezone': 'timezone'
  };

  private webContainerConfigMap = {
    'com.denodo.tomcat.http.port': 'tomcatPort',
    'java.env.DENODO_OPTS_START': 'tomcatJvmOptions'
  };

  constructor(duckdb?: DuckDBClient) {
    // ServerConfigParser doesn't use grammar config - it has its own parsing logic
    super({} as any, duckdb);
  }

  async parse(content: string, database?: string, propertiesData?: Record<string, any>): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    try {
      console.log('[ServerConfigParser] Starting server config extraction...');
      const config = this.extractServerConfig(content, propertiesData || {});

      console.log(`[ServerConfigParser] Extracted ${Object.keys(config).length} configuration settings`);

      if (Object.keys(config).length > 0) {
        // Add metadata
        config.analysisId = this.generateAnalysisId();
        config.timestamp = new Date().toISOString();

        results.push({
          data: config,
          statement: 'SERVER_CONFIG',
          statementType: 'SERVER_CONFIG',
          database: database
        });

        // Store to DuckDB if available - server config is stored as JSON
        if (this.duckdb) {
          console.log('[ServerConfigParser] Storing to DuckDB:', {
            analysisId: config.analysisId,
            settingsCount: Object.keys(config).length,
            sampleSettings: Object.keys(config).slice(0, 5)
          });

          await this.duckdb.execute(
            `INSERT INTO server_configuration (analysis_id, configuration, timestamp)
             VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [config.analysisId, JSON.stringify(config)]
          );
          console.log(`✅ [ServerConfigParser] Successfully stored configuration with ${Object.keys(config).length} settings`);
        } else {
          console.warn('[ServerConfigParser] No DuckDB client available, skipping storage');
        }
      } else {
        console.warn('[ServerConfigParser] No server configuration settings found in VQL');
      }

    } catch (error) {
      console.error('ServerConfigParser error:', error);
      throw error;
    }

    return results;
  }

  /**
   * Extract server configuration from VQL content - exact port from original
   */
  private extractServerConfig(content: string, propertiesData: Record<string, any> = {}): ServerConfigData {
    const config: ServerConfigData = {};

    // Extract SET configuration statements
    const setPattern = /SET\s+'([^']+)'\s*=\s*'([^']*)'/gi;
    const setMatches = [...content.matchAll(setPattern)];

    setMatches.forEach(match => {
      const [, property, value] = match;
      const mappedKey = this.configMap[property as keyof typeof this.configMap];

      if (mappedKey) {
        // Convert value to appropriate type
        config[mappedKey] = this.convertConfigValue(value);
      } else {
        // Keep unmapped properties with sanitized keys
        const sanitizedKey = property.replace(/[^a-zA-Z0-9_]/g, '_');
        config[sanitizedKey] = this.convertConfigValue(value);
      }
    });

    // Extract ALTER DATABASE configuration
    const alterPattern = /ALTER\s+DATABASE\s+[^;]*SET\s+'([^']+)'\s*=\s*'([^']*)'/gi;
    const alterMatches = [...content.matchAll(alterPattern)];

    alterMatches.forEach(match => {
      const [, property, value] = match;
      const mappedKey = this.configMap[property as keyof typeof this.configMap];

      if (mappedKey) {
        config[mappedKey] = this.convertConfigValue(value);
      } else {
        const sanitizedKey = property.replace(/[^a-zA-Z0-9_]/g, '_');
        config[sanitizedKey] = this.convertConfigValue(value);
      }
    });

    // Extract WEBCONTAINER SET statements
    const webContainerPattern = /WEBCONTAINER\s+SET\s+'([^']+)'\s*=\s*'([^']*)'/gi;
    const webContainerMatches = [...content.matchAll(webContainerPattern)];

    console.log(`🔍 [ServerConfigParser] Found ${webContainerMatches.length} WEBCONTAINER SET statements`);

    webContainerMatches.forEach(match => {
      const [, property, value] = match;
      console.log(`🔍 [ServerConfigParser] Processing: ${property} = ${value}`);
      const mappedKey = this.webContainerConfigMap[property as keyof typeof this.webContainerConfigMap];

      if (mappedKey) {
        // Store the value AS-IS (with property reference) - will be resolved by page.tsx
        // This matches how regular SET statements are handled
        console.log(`✅ [ServerConfigParser] WEBCONTAINER ${property} -> ${mappedKey}: ${value}`);
        config[mappedKey] = value;
      } else {
        console.log(`❌ [ServerConfigParser] WEBCONTAINER ${property} NOT MAPPED`);
      }
    });

    // Extract configuration from comments (common in Denodo exports)
    const commentPattern = /#\s*([^=\s]+)\s*=\s*([^\r\n]+)/gi;
    const commentMatches = [...content.matchAll(commentPattern)];

    commentMatches.forEach(match => {
      const [, property, value] = match;
      const cleanProperty = property.trim();
      const cleanValue = value.trim();

      const mappedKey = this.configMap[cleanProperty as keyof typeof this.configMap];
      if (mappedKey) {
        config[mappedKey] = this.convertConfigValue(cleanValue);
      }
    });

    console.log('📦 [ServerConfigParser] Final config keys:', Object.keys(config));
    console.log('📦 [ServerConfigParser] tomcatPort:', config.tomcatPort);
    console.log('📦 [ServerConfigParser] tomcatJvmOptions:', config.tomcatJvmOptions);
    console.log('📦 [ServerConfigParser] identifiersCharset:', config.identifiersCharset);

    return config;
  }

  /**
   * Resolve property references like ${config.PROPERTY.xyz} using properties data
   */
  private resolvePropertyReference(value: string, propertiesData: Record<string, any> = {}): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    // Check if it's a property reference
    const propertyRefRegex = /\$\{config\.(?:PROPERTY|WEBCONTAINER\.PROPERTY)\.([^}]+)\}/;
    const match = value.match(propertyRefRegex);

    if (match) {
      const propertyName = match[1];
      let fullPropertyKey: string;

      // Check if it's a WEBCONTAINER property reference
      if (value.includes('${config.WEBCONTAINER.PROPERTY.')) {
        fullPropertyKey = `config.WEBCONTAINER.PROPERTY.${propertyName}`;
      } else {
        fullPropertyKey = `config.PROPERTY.${propertyName}`;
      }

      const resolvedValue = propertiesData[fullPropertyKey];

      if (resolvedValue !== undefined) {
        return resolvedValue;
      } else {
        return ''; // Return empty string for missing properties
      }
    }

    // If it's not a property reference, return as-is
    return value;
  }

  /**
   * Convert configuration value to appropriate type - exact port from original
   */
  private convertConfigValue(value: string): string | number | boolean {
    const trimmedValue = value.trim();

    // Boolean conversion
    if (trimmedValue.toLowerCase() === 'true') return true;
    if (trimmedValue.toLowerCase() === 'false') return false;

    // Number conversion
    if (/^\d+$/.test(trimmedValue)) {
      return parseInt(trimmedValue, 10);
    }

    if (/^\d+\.\d+$/.test(trimmedValue)) {
      return parseFloat(trimmedValue);
    }

    // Return as string
    return trimmedValue;
  }

  /**
   * Generate analysis ID - exact port from original
   */
  private generateAnalysisId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get configuration statistics
   */
  public getConfigStats(config: ServerConfigData): {
    totalSettings: number;
    categories: { [category: string]: number };
    securityEnabled: boolean;
    cacheEnabled: boolean;
  } {
    const stats = {
      totalSettings: Object.keys(config).filter(k => k !== 'analysisId' && k !== 'timestamp').length,
      categories: {} as { [category: string]: number },
      securityEnabled: false,
      cacheEnabled: false
    };

    // Categorize settings
    Object.keys(config).forEach(key => {
      if (key === 'analysisId' || key === 'timestamp') return;

      if (key.includes('cache') || key.includes('Cache')) {
        stats.categories['Cache'] = (stats.categories['Cache'] || 0) + 1;
        if (config[key] === true || config[key] === 'true') {
          stats.cacheEnabled = true;
        }
      } else if (key.includes('security') || key.includes('Security') || key.includes('LDAP') || key.includes('OAuth') || key.includes('SAML') || key.includes('Kerberos')) {
        stats.categories['Security'] = (stats.categories['Security'] || 0) + 1;
        if (config[key] === true || config[key] === 'true') {
          stats.securityEnabled = true;
        }
      } else if (key.includes('optimization') || key.includes('Memory') || key.includes('Pool')) {
        stats.categories['Performance'] = (stats.categories['Performance'] || 0) + 1;
      } else if (key.includes('log') || key.includes('Log')) {
        stats.categories['Logging'] = (stats.categories['Logging'] || 0) + 1;
      } else if (key.includes('connection') || key.includes('Connection') || key.includes('timeout')) {
        stats.categories['Connection'] = (stats.categories['Connection'] || 0) + 1;
      } else {
        stats.categories['Other'] = (stats.categories['Other'] || 0) + 1;
      }
    });

    return stats;
  }
}