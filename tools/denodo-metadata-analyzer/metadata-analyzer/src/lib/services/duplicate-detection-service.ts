/**
 * Duplicate Detection Service - TypeScript port with DuckDB integration
 * Advanced duplicate connection detection with sophisticated normalization
 * Based on original MetadataAnalyzer.js logic with enhancements
 */

export interface DuplicateConnection {
  type: string;
  uri: string;
  normalizedUri?: string;
  fileName?: string;
  resourceKey?: string;
  routeType?: string;
  resourceType?: string;
  connections: ConnectionReference[];
  count: number;
  category: string;
}

export interface ConnectionReference {
  dataSourceName: string;
  databaseName: string;
  uriReference: string;
  actualUri?: string;
  actualResource?: string;
  normalizedResource?: string;
  routeType?: string;
  resourceType?: string;
  type: string;
  username?: string;
  fileName?: string;
  fullPath?: string;
  details: ConnectionDetails;
}

export interface ConnectionDetails {
  uri: string;
  normalizedUri?: string;
  fileName?: string;
  fullPath?: string;
  routeType?: string;
  resourceType?: string;
  normalizedResource?: string;
  source?: string;
}

export interface DuplicateAnalysisResult {
  duplicates: DuplicateConnection[];
  duplicatesByType?: DuplicatesByType;
}

export interface DuplicatesByType {
  jdbc: DuplicateConnection[];
  json: DuplicateConnection[];
  excel?: DuplicateConnection[];
  df: DuplicateConnection[];
}

export interface ConnectionMap {
  [key: string]: {
    originalUri?: string;
    originalUrl?: string;
    originalPath?: string;
    originalResource?: string;
    routeType?: string;
    resourceType?: string;
    connections: ConnectionReference[];
  };
}

export interface DuplicateStats {
  jdbc: { total: number; duplicates: number };
  json: { total: number; duplicates: number };
  excel: { total: number; duplicates: number };
  df: { total: number; duplicates: number };
}

/**
 * Duplicate Detection Service - advanced duplicate connection detection
 */
export class DuplicateDetectionService {
  private jdbcConnectionMap: ConnectionMap = {};
  private jsonConnectionMap: ConnectionMap = {};
  private excelConnectionMap: ConnectionMap = {};
  private dfConnectionMap: ConnectionMap = {};
  private properties: Record<string, any> = {};

  constructor() {
    this.resetConnectionMaps();
  }

  /**
   * Reset all connection maps
   */
  private resetConnectionMaps(): void {
    this.jdbcConnectionMap = {};
    this.jsonConnectionMap = {};
    this.excelConnectionMap = {};
    this.dfConnectionMap = {};
  }

  /**
   * Analyze duplicates from parsed datasource data (for direct values in VQL)
   */
  analyzeDuplicateDataSources(dataSources: any[]): DuplicateAnalysisResult {
    if (!dataSources || !Array.isArray(dataSources)) {
      return { duplicates: [] };
    }

    // Reset connection maps
    this.resetConnectionMaps();

    const duplicateConnections: DuplicatesByType = {
      jdbc: [],
      json: [],
      df: []
    };

    // Group datasources by connection details
    dataSources.forEach(ds => {
      this.processDataSourceForDuplicates(ds);
    });

    // Find duplicates
    duplicateConnections.jdbc = this.findJdbcDuplicates();
    duplicateConnections.json = this.findJsonDuplicates();
    duplicateConnections.df = this.findDfDuplicates();

    // Convert to flat array for UI
    const duplicates: DuplicateConnection[] = [
      ...duplicateConnections.jdbc.map(d => ({ ...d, category: 'JDBC' })),
      ...duplicateConnections.json.map(d => ({ ...d, category: 'JSON' })),
      ...duplicateConnections.df.map(d => ({ ...d, category: 'DelimitedFile' }))
    ];

    return { duplicates, duplicatesByType: duplicateConnections };
  }

  /**
   * Convert datasources with direct values to synthetic properties format
   * This allows us to reuse the existing property-based duplicate detection logic
   */
  convertDataSourcesToProperties(dataSources: any[]): Record<string, any> {
    const syntheticProperties: Record<string, any> = {};

    dataSources.forEach(ds => {
      const { name, database, type } = ds;

      if (type === 'JDBC' && ds.databaseUri) {
        // Create synthetic property key in same format as real properties
        const propertyKey = `databases.${database || 'admin'}.datasources.jdbc.${name}.DATABASEURI`;
        syntheticProperties[propertyKey] = ds.databaseUri;
      }
      else if ((type === 'JSON' || type === 'XML') && ds.routeConnection) {
        // Create synthetic property key for JSON/XML routes
        const propertyKey = `databases.${database || 'admin'}.datasources.${type.toLowerCase()}.${name}.ROUTE.HTTP.URL`;
        syntheticProperties[propertyKey] = ds.routeConnection;
      }
      else if (type === 'DelimitedFile' && ds.routeConnection) {
        // Create synthetic property key for DF routes
        const routeType = ds.routeType || 'LOCAL';
        const propertyKey = `databases.${database || 'admin'}.datasources.df.${name}.ROUTE.${routeType}.PATH`;
        syntheticProperties[propertyKey] = ds.routeConnection;
      }
    });

    return syntheticProperties;
  }

  /**
   * Process individual datasource for duplicate detection
   */
  private processDataSourceForDuplicates(dataSource: any): void {
    const { type, name, database, databaseUri, routeConnection, routeType, username } = dataSource;

    if (type === 'JDBC' && databaseUri) {
      const normalizedUri = this.normalizeJdbcUri(databaseUri);

      if (!this.jdbcConnectionMap[normalizedUri]) {
        this.jdbcConnectionMap[normalizedUri] = {
          originalUri: databaseUri,
          connections: []
        };
      }

      this.jdbcConnectionMap[normalizedUri].connections.push({
        dataSourceName: name,
        databaseName: database,
        uriReference: `datasource:${name}`,
        actualUri: databaseUri,
        type: 'JDBC',
        username: username,
        details: {
          uri: databaseUri,
          normalizedUri: normalizedUri,
          source: 'direct_value'
        }
      });
    } else if ((type === 'JSON' || type === 'XML') && routeConnection) {
      const normalizedUrl = this.normalizeJsonUrl(routeConnection);

      if (!this.jsonConnectionMap[normalizedUrl]) {
        this.jsonConnectionMap[normalizedUrl] = {
          originalUrl: routeConnection,
          connections: []
        };
      }

      this.jsonConnectionMap[normalizedUrl].connections.push({
        dataSourceName: name,
        databaseName: database,
        uriReference: `datasource:${name}`,
        actualUri: routeConnection,
        type: type,
        username: username,
        details: {
          uri: routeConnection,
          normalizedUri: normalizedUrl,
          source: 'direct_value'
        }
      });
    } else if (type === 'DelimitedFile' && routeConnection) {
      const actualRouteType = routeType || 'UNKNOWN';
      const normalizedResource = this.normalizeDfResource(routeConnection, 'PATH');
      const resourceKey = `${actualRouteType}:${normalizedResource}`;

      if (!this.dfConnectionMap[resourceKey]) {
        this.dfConnectionMap[resourceKey] = {
          originalResource: routeConnection,
          routeType: actualRouteType,
          resourceType: 'PATH',
          connections: []
        };
      }

      this.dfConnectionMap[resourceKey].connections.push({
        dataSourceName: name,
        databaseName: database,
        uriReference: `datasource:${name}`,
        actualResource: routeConnection,
        normalizedResource: normalizedResource,
        routeType: actualRouteType,
        resourceType: 'PATH',
        type: 'DF',
        username: username,
        details: {
          uri: routeConnection,
          routeType: actualRouteType,
          resourceType: 'PATH',
          normalizedResource: normalizedResource,
          source: 'direct_value'
        }
      });
    }
  }

  /**
   * Analyze duplicate connections from properties data
   */
  analyzeDuplicateConnections(properties: Record<string, any>): DuplicateAnalysisResult {
    if (!properties) {
      return { duplicates: [] };
    }

    // Store properties reference for username lookup
    this.properties = properties;

    // Store properties reference for username lookup
    this.properties = properties;

    // Reset connection maps
    this.resetConnectionMaps();

    const duplicateConnections: DuplicatesByType = {
      jdbc: [],
      json: [],
      excel: [],
      df: []
    };

    // Extract property groups
    const databaseUriProps = this.extractJdbcProperties(properties);
    const jsonUrlProps = this.extractJsonProperties(properties);
    const excelFileProps = this.extractExcelProperties(properties);
    const dfRouteProps = this.extractDfProperties(properties);

    // Analyze each type of connection
    this.analyzeJdbcDuplicates(databaseUriProps);
    this.analyzeJsonDuplicates(jsonUrlProps);
    this.analyzeExcelDuplicates(excelFileProps);
    this.analyzeDfDuplicates(dfRouteProps);

    // Find duplicates
    duplicateConnections.jdbc = this.findJdbcDuplicates();
    duplicateConnections.json = this.findJsonDuplicates();
    duplicateConnections.excel = this.findExcelDuplicates();
    duplicateConnections.df = this.findDfDuplicates();

    // Convert to flat array for UI
    const duplicates: DuplicateConnection[] = [
      ...duplicateConnections.jdbc.map(d => ({ ...d, category: 'JDBC' })),
      ...duplicateConnections.json.map(d => ({ ...d, category: 'JSON' })),
      ...duplicateConnections.excel!.map(d => ({ ...d, category: 'Excel' })),
      ...duplicateConnections.df.map(d => ({ ...d, category: 'DelimitedFile' }))
    ];

    return { duplicates, duplicatesByType: duplicateConnections };
  }

  /**
   * Extract JDBC DATABASEURI properties
   */
  private extractJdbcProperties(properties: Record<string, any>): Array<[string, string]> {
    const jdbcProps = Object.entries(properties).filter(([key, value]) => {
      const hasDatabaseUri = key.includes('DATABASEURI');
      const startsWithJdbc = value && value.toString().startsWith('jdbc:');

      return hasDatabaseUri && startsWithJdbc;
    });

    return jdbcProps as Array<[string, string]>;
  }

  /**
   * Extract JSON URL properties
   */
  private extractJsonProperties(properties: Record<string, any>): Array<[string, string]> {
    return Object.entries(properties).filter(([key, value]) =>
      key.includes('datasources.json') && key.includes('ROUTE.HTTP.URL') && value.startsWith('http')
    ) as Array<[string, string]>;
  }

  /**
   * Extract Excel file path properties
   */
  private extractExcelProperties(properties: Record<string, any>): Array<[string, string]> {
    return Object.entries(properties).filter(([key, value]) =>
      (key.includes('File\\\\ location.ROUTE.LOCAL.PATH') || key.includes('File location.ROUTE.LOCAL.PATH'))
      && value.toLowerCase().includes('.xlsx')
    ) as Array<[string, string]>;
  }

  /**
   * Extract DelimitedFile route properties
   */
  private extractDfProperties(properties: Record<string, any>): Array<[string, string]> {
    return Object.entries(properties).filter(([key, value]) =>
      key.includes('datasources.df.') && key.includes('.ROUTE.') &&
      (key.includes('.URL') || key.includes('.PATH')) &&
      !key.includes('.LOGIN') && !key.includes('.PASSWORD') && !key.includes('.ENCRYPTED') &&
      value.trim().length > 0
    ) as Array<[string, string]>;
  }

  /**
   * Analyze JDBC duplicates with advanced URI normalization
   */
  private analyzeJdbcDuplicates(databaseUriProps: Array<[string, string]>): void {
    databaseUriProps.forEach(([key, uri]) => {
      // Advanced JDBC URI normalization
      const normalizedUri = this.normalizeJdbcUri(uri);

      if (!this.jdbcConnectionMap[normalizedUri]) {
        this.jdbcConnectionMap[normalizedUri] = {
          originalUri: uri,
          connections: []
        };
      }

      // Extract connection details from the key
      const keyParts = key.split('.');
      const dataSourceName = keyParts[keyParts.length - 2];
      const databaseName = keyParts[1];

      // Try to find corresponding username property
      const usernameKey = key.replace('DATABASEURI', 'USERNAME');
      const username = this.findPropertyValue(usernameKey);

      this.jdbcConnectionMap[normalizedUri].connections.push({
        dataSourceName: dataSourceName,
        databaseName: databaseName,
        uriReference: key,
        actualUri: uri,
        type: 'JDBC',
        username: username,
        details: {
          uri: uri,
          normalizedUri: normalizedUri
        }
      });
    });
  }

  /**
   * Advanced JDBC URI normalization
   */
  private normalizeJdbcUri(uri: string): string {
    let normalized = uri.toLowerCase()
      // Remove encryption flags
      .replace(/[;&]encrypt=true/g, '')
      .replace(/[;&]encrypt=false/g, '')
      .replace(/[;&]trustservercertificate=true/g, '')
      .replace(/[;&]trustservercertificate=false/g, '')
      // Remove SSL-related parameters
      .replace(/[;&]sslmode=[^;&]*/g, '')
      .replace(/[;&]ssl=[^;&]*/g, '')
      .replace(/[;&]usetls=[^;&]*/g, '')
      // Remove timeout parameters
      .replace(/[;&]sockettimeout=[^;&]*/g, '')
      .replace(/[;&]logintimeout=[^;&]*/g, '')
      .replace(/[;&]connectiontimeout=[^;&]*/g, '')
      // Remove application name parameters
      .replace(/[;&]applicationname=[^;&]*/g, '')
      .replace(/[;&]appname=[^;&]*/g, '')
      // Remove whitespace
      .replace(/\s+/g, '');

    // Handle multiple consecutive separators
    normalized = normalized.replace(/[;&]+/g, ';').replace(/^;|;$/g, '');

    return normalized;
  }

  /**
   * Analyze JSON duplicates with advanced URL normalization
   */
  private analyzeJsonDuplicates(jsonUrlProps: Array<[string, string]>): void {
    jsonUrlProps.forEach(([key, url]) => {
      // Advanced JSON URL normalization
      const baseUrl = this.normalizeJsonUrl(url);

      if (!this.jsonConnectionMap[baseUrl]) {
        this.jsonConnectionMap[baseUrl] = {
          originalUrl: url,
          connections: []
        };
      }

      // Extract connection details from the key
      const keyParts = key.split('.');
      const dataSourceName = keyParts[keyParts.length - 4]; // Fourth from last (before ROUTE.HTTP.URL)
      const databaseName = keyParts[1];

      // Try to find corresponding username property (JSON datasources may not have usernames)
      const basePath = keyParts.slice(0, -3).join('.'); // Remove ROUTE.HTTP.URL
      const usernameKey = `${basePath}.USERNAME`;
      const username = this.findPropertyValue(usernameKey);

      this.jsonConnectionMap[baseUrl].connections.push({
        dataSourceName: dataSourceName,
        databaseName: databaseName,
        uriReference: key,
        actualUri: url,
        type: 'JSON',
        username: username,
        details: {
          uri: url,
          normalizedUri: baseUrl
        }
      });
    });
  }

  /**
   * Advanced JSON URL normalization
   */
  private normalizeJsonUrl(url: string): string {
    try {
      const u = new URL(url);
      const scheme = (u.protocol || '').toLowerCase();
      const host = (u.hostname || '').toLowerCase();
      const isDefaultPort = (u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443');
      const port = isDefaultPort ? '' : u.port;

      let path = decodeURIComponent(u.pathname || '/');
      path = path.replace(/\/+$/, '');
      path = path.replace(/\/{2,}/g, '/');
      path = path
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '{id}')
        .replace(/\b\d{10,}\b/g, '{id}')
        .replace(/\b\d+\b/g, '{id}');

      const base = `${scheme}//${host}${port ? `:${port}` : ''}${path || '/'}`;

      const params = Array.from(u.searchParams.keys());
      const dynamicKeys = new Set([
        'token','access_token','oauth_token','api_key','apikey','client_id','client_secret','signature','nonce','expires',
        'ts','timestamp','_t','_','cache','cachebust','nocache','callback','format','returnformat'
      ].map(k => k.toLowerCase()));
      const ignoreForStable = new Set(['page','limit','offset','per_page','sort','order','fields','select','filter','where','q','expand','include'].map(k => k.toLowerCase()));

      const keptKeys = params
        .map(k => k.toLowerCase())
        .filter(k => !dynamicKeys.has(k))
        .filter(k => !ignoreForStable.has(k));
      keptKeys.sort();

      const signature = keptKeys.length > 0 ? `${base}?${keptKeys.join('&')}` : base;
      return signature;
    } catch {
      let normalized = url.toLowerCase()
        .replace(/[?&]token=[^&]*/gi, '')
        .replace(/[?&]api_key=[^&]*/gi, '')
        .replace(/[?&]apikey=[^&]*/gi, '')
        .replace(/[?&]access_token=[^&]*/gi, '')
        .replace(/[?&]timestamp=[^&]*/gi, '')
        .replace(/[?&]ts=[^&]*/gi, '')
        .replace(/[?&]_t=[^&]*/gi, '')
        .replace(/[?&]nocache=[^&]*/gi, '')
        .replace(/[?&]format=json/gi, '')
        .replace(/[?&]returnformat=json/gi, '')
        .replace(/[?&]callback=[^&]*/gi, '')
        .replace(/[?&]_=[^&]*/gi, '')
        .replace(/\s+/g, '');
      normalized = normalized.split('#')[0].split('?')[0].replace(/\/+$/, '');
      return normalized;
    }
  }

  /**
   * Analyze Excel duplicates by filename
   */
  private analyzeExcelDuplicates(excelFileProps: Array<[string, string]>): void {
    excelFileProps.forEach(([key, filePath]) => {
      // Extract filename for comparison
      const fileName = this.normalizeExcelFileName(filePath);

      if (!this.excelConnectionMap[fileName]) {
        this.excelConnectionMap[fileName] = {
          originalPath: filePath,
          connections: []
        };
      }

      // Extract connection details from the key
      const keyParts = key.split('.');
      let wrapperName = 'Unknown';
      let databaseName = keyParts[1] || 'Unknown';

      // Find the wrapper name (look for part before File location)
      for (let i = 0; i < keyParts.length - 1; i++) {
        if (keyParts[i] === 'custom' && i + 1 < keyParts.length) {
          const nextPart = keyParts[i + 1];
          if (!nextPart.includes('File') && !nextPart.includes('ROUTE')) {
            wrapperName = nextPart;
            break;
          }
        }
      }

      this.excelConnectionMap[fileName].connections.push({
        dataSourceName: wrapperName,
        databaseName: databaseName,
        uriReference: key,
        actualUri: filePath,
        fileName: fileName,
        fullPath: filePath,
        type: 'EXCEL',
        username: undefined, // Excel wrappers don't typically have usernames
        details: {
          uri: filePath,
          fileName: fileName,
          fullPath: filePath
        }
      });
    });
  }

  /**
   * Normalize Excel filename
   */
  private normalizeExcelFileName(filePath: string): string {
    // Extract just the filename for comparison (ignore path differences)
    return filePath.split('/').pop()!.split('\\').pop()!.toLowerCase();
  }

  /**
   * Analyze DelimitedFile duplicates
   */
  private analyzeDfDuplicates(dfRouteProps: Array<[string, string]>): void {
    dfRouteProps.forEach(([key, resourcePath]) => {
      // Extract route type and resource type from the property key
      const routeMatch = key.match(/\\.ROUTE\\.(\\w+)\\.(\\w+)$/);
      if (!routeMatch) return;

      const routeType = routeMatch[1]; // LOCAL, FTP, S3, HTTP, etc.
      const resourceType = routeMatch[2]; // PATH, URL, etc.

      // Normalize resource for comparison
      const normalizedResource = this.normalizeDfResource(resourcePath, resourceType);
      const resourceKey = `${routeType}:${normalizedResource}`;

      if (!this.dfConnectionMap[resourceKey]) {
        this.dfConnectionMap[resourceKey] = {
          originalResource: resourcePath,
          routeType: routeType,
          resourceType: resourceType,
          connections: []
        };
      }

      // Extract connection details from the key
      const keyParts = key.split('.');
      let dataSourceName = 'Unknown';
      let databaseName = keyParts[1] || 'Unknown';

      // Find the datasource name (usually after datasources.df.)
      for (let i = 0; i < keyParts.length; i++) {
        if (keyParts[i] === 'df' && i + 1 < keyParts.length) {
          dataSourceName = keyParts[i + 1];
          break;
        }
      }

      this.dfConnectionMap[resourceKey].connections.push({
        dataSourceName: dataSourceName,
        databaseName: databaseName,
        uriReference: key,
        actualResource: resourcePath,
        normalizedResource: normalizedResource,
        routeType: routeType,
        resourceType: resourceType,
        type: 'DF',
        username: undefined, // DelimitedFile datasources don't typically have usernames
        details: {
          uri: resourcePath,
          routeType: routeType,
          resourceType: resourceType,
          normalizedResource: normalizedResource
        }
      });
    });
  }

  /**
   * Normalize DelimitedFile resource
   */
  private normalizeDfResource(resourcePath: string, resourceType: string): string {
    let normalized = resourcePath;

    if (resourceType === 'URL') {
      // For URLs, remove query parameters and normalize
      normalized = resourcePath.split('?')[0]
        .replace(/\\\\\//g, '/')
        .replace(/\\\\:/g, ':')
        .toLowerCase();
    } else if (resourceType === 'PATH') {
      // For paths, use full path for specificity
      normalized = resourcePath.toLowerCase();
    }

    return normalized;
  }

  /**
   * Find JDBC duplicates
   */
  private findJdbcDuplicates(): DuplicateConnection[] {
    return Object.entries(this.jdbcConnectionMap)
      .filter(([, data]) => data.connections.length > 1)
      .map(([normalizedUri, data]) => ({
        type: 'jdbc',
        uri: data.originalUri!,
        normalizedUri: normalizedUri,
        connections: data.connections,
        count: data.connections.length,
        category: 'JDBC'
      }));
  }

  /**
   * Find JSON duplicates
   */
  private findJsonDuplicates(): DuplicateConnection[] {
    return Object.entries(this.jsonConnectionMap)
      .filter(([, data]) => data.connections.length > 1)
      .map(([baseUrl, data]) => ({
        type: 'json',
        uri: data.originalUrl!,
        normalizedUri: baseUrl,
        connections: data.connections,
        count: data.connections.length,
        category: 'JSON'
      }));
  }

  /**
   * Find Excel duplicates
   */
  private findExcelDuplicates(): DuplicateConnection[] {
    return Object.entries(this.excelConnectionMap)
      .filter(([, data]) => data.connections.length > 1)
      .map(([fileName, data]) => ({
        type: 'excel',
        uri: data.originalPath!,
        fileName: fileName,
        connections: data.connections,
        count: data.connections.length,
        category: 'Excel'
      }));
  }

  /**
   * Find DelimitedFile duplicates
   */
  private findDfDuplicates(): DuplicateConnection[] {
    return Object.entries(this.dfConnectionMap)
      .filter(([, data]) => data.connections.length > 1)
      .map(([resourceKey, data]) => ({
        type: 'delimitedFile',
        uri: data.originalResource!,
        resourceKey: resourceKey,
        routeType: data.routeType,
        resourceType: data.resourceType,
        connections: data.connections,
        count: data.connections.length,
        category: 'DelimitedFile'
      }));
  }

  /**
   * Get duplicate analysis statistics
   */
  getStatistics(): DuplicateStats {
    return {
      jdbc: {
        total: Object.keys(this.jdbcConnectionMap).length,
        duplicates: this.findJdbcDuplicates().length
      },
      json: {
        total: Object.keys(this.jsonConnectionMap).length,
        duplicates: this.findJsonDuplicates().length
      },
      excel: {
        total: Object.keys(this.excelConnectionMap).length,
        duplicates: this.findExcelDuplicates().length
      },
      df: {
        total: Object.keys(this.dfConnectionMap).length,
        duplicates: this.findDfDuplicates().length
      }
    };
  }

  /**
   * Find property value by key
   */
  private findPropertyValue(key: string): string | undefined {
    return this.properties ? this.properties[key] : undefined;
  }
}
