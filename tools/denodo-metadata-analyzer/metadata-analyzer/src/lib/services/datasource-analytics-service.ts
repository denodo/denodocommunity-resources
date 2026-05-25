/**
 * Data Source Analytics Service - TypeScript port with DuckDB integration
 * Provides comprehensive data source technology breakdown
 * Exact port of original MetadataAnalyzer.js getDataSourceAnalytics function
 */

export interface DataSourceAnalytics {
  [type: string]: {
    count: number;
    technologies?: { [tech: string]: TechnologyData };
    connections?: ConnectionData[];
  };
}

export interface TechnologyData {
  count: number;
  versions?: string[];
  connections?: ConnectionData[];
  details?: DetailData[];
  wrappers?: WrapperReference[];
  fullClassName?: string;
}

export interface ConnectionData {
  name: string;
  database: string;
  databaseName?: string;
  databaseVersion?: string;
  databaseUri?: string;
  username?: string;
  classpath?: string;
  fetchSize?: string;
  validationQuery?: string;
  dsn?: string;
  endpoint?: string;
  user?: string;
  uri?: string;
  host?: string;
  routeConnection?: string;
  routeType?: string;
  fullClassName?: string;
  serviceType?: string;
  wsdl?: string;
}

export interface DetailData {
  name: string;
  database: string;
  routeConnection?: string;
  routeType?: string;
  wsdl?: string;
  endpoint?: string;
  serviceType?: string;
}

export interface WrapperReference {
  name: string;
  database: string;
  dataSourceName: string;
}

export interface SummaryStats {
  totalTypes: number;
  totalDataSources: number;
  topTechnologies: TopTechnology[];
}

export interface TopTechnology {
  type: string;
  technology: string;
  count: number;
}

export interface TechnologyTab {
  id: string;
  label: string;
  count: number;
  technologies: { [tech: string]: TechnologyData };
  hasSubTabs: boolean;
}

export interface SubTechnologyTab {
  id: string;
  label: string;
  count: number;
  data: TechnologyData;
}

export interface ColumnConfig {
  key: string;
  label: string;
  sortable: boolean;
}

export interface WrapperAnalytics {
  [type: string]: {
    count: number;
    wrappers: any[];
    streamTuplesStats: {
      enabled: number;
      disabled: number;
      unconfigured: number;
    };
  };
}

export interface ExcelWrapperStats {
  totalExcelWrappers: number;
  streamTuplesEnabled: number;
  streamTuplesDisabled: number;
  streamTuplesUnconfigured: number;
  disabledWrappers: any[];
  enabledWrappers: any[];
}

export interface DatabaseWithSources {
  name: string;
  dataSources: any[];
  wrappers?: any[];
}

/**
 * Data Source Analytics Service - provides comprehensive data source technology breakdown
 */
export class DataSourceAnalyticsService {

  /**
   * Deduplicate data sources to prevent counting duplicates
   */
  static deduplicateDataSources(databases: DatabaseWithSources[]): DatabaseWithSources[] {
    const uniqueDataSources = new Map<string, boolean>();

    databases.forEach(db => {
      if (db.dataSources) {
        db.dataSources = db.dataSources.filter(ds => {
          const key = `${ds.database}:${ds.type}:${ds.name}`;
          if (uniqueDataSources.has(key)) {
            return false;
          }
          uniqueDataSources.set(key, true);
          return true;
        });
      }
    });

    return databases;
  }

  /**
   * Deduplicate databases to prevent counting duplicates
   */
  static deduplicateDatabases(databases: any[]): any[] {
    const uniqueDatabases = new Map<string, boolean>();

    return databases.filter(db => {
      // Use case-insensitive database name for deduplication to prevent admin/ADMIN duplicates
      const normalizedName = (db.name || '').toLowerCase();
      const key = `${normalizedName}:${db.denodoVersion || 'unknown'}`;
      if (uniqueDatabases.has(key)) {
        return false;
      }
      uniqueDatabases.set(key, true);
      return true;
    });
  }

  static getDataSourceAnalytics(databases: DatabaseWithSources[], properties: Record<string, any> = {}): DataSourceAnalytics {
    // First deduplicate data sources to prevent counting duplicates
    const deduplicatedDatabases = this.deduplicateDataSources(databases);

    const analytics: DataSourceAnalytics = {};

    deduplicatedDatabases.forEach(db => {
      db.dataSources.forEach(ds => {
        // Helper function to resolve property references like ${...}
        const resolvePropertyValue = (fieldValue: any): string => {
          if (!fieldValue || fieldValue === 'undefined' || fieldValue === undefined) {
            return '-';
          }

          // Check if it's a property reference like ${databases.common.folder.1..connectivity_layer.folder.1_data_sources.datasources.jdbc.ds_vm_cwt.DATABASEURI}
          if (typeof fieldValue === 'string' && fieldValue.startsWith('${') && fieldValue.endsWith('}')) {
            // Extract the property key from ${...}
            const propertyKey = fieldValue.slice(2, -1);

            // Look up the property key in the properties object
            const resolvedValue = properties[propertyKey];

            if (resolvedValue !== undefined && resolvedValue !== null && resolvedValue !== '') {
              return resolvedValue;
            } else {
              // Property not found, show the original reference for debugging
              return fieldValue;
            }
          }

          return fieldValue || '-';
        };

        // Enhanced helper function to extract JDBC values directly from properties with case-insensitive matching
        const extractJdbcValuesFromProperties = (dataSourceName: string, databaseName: string) => {
          if (!properties) return { databaseUri: '-', username: '-', driverClassName: '-', classpath: '-' };

          let databaseUri = '-', username = '-', driverClassName = '-', classpath = '-';

          // Clean and normalize the datasource name for matching
          const cleanDataSourceName = dataSourceName.replace(/['"]/g, '').toLowerCase().normalize('NFKC');

          // Search through all properties to find matching keys
          Object.keys(properties).forEach(key => {
            if ((key.includes('DATABASEURI') || key.includes('USERNAME') || key.includes('DRIVERCLASSNAME') || key.includes('CLASSPATH')) &&
                key.includes('datasources.jdbc.') &&
                key.includes(`databases.${databaseName}`)) {

              // Extract datasource name from the key
              const keyParts = key.split('.');
              const jdbcIndex = keyParts.findIndex(part => part === 'jdbc');
              if (jdbcIndex >= 0 && jdbcIndex + 1 < keyParts.length) {
                const keyDataSourceName = keyParts[jdbcIndex + 1];
                const normalizedKeyName = keyDataSourceName.toLowerCase().normalize('NFKC');

                // Try multiple matching strategies
                const matches = (
                  // Exact match
                  normalizedKeyName === cleanDataSourceName ||
                  // Case variations
                  normalizedKeyName === cleanDataSourceName.toLowerCase() ||
                  normalizedKeyName === cleanDataSourceName.toUpperCase().toLowerCase() ||
                  // Remove underscores and try
                  normalizedKeyName.replace(/_/g, '') === cleanDataSourceName.replace(/_/g, '') ||
                  // Try without special characters
                  normalizedKeyName.replace(/[_-]/g, '') === cleanDataSourceName.replace(/[_-]/g, '')
                );

                if (matches) {
                  const value = properties[key];
                  if (key.includes('DATABASEURI') && value && value.toString().startsWith('jdbc:')) {
                    databaseUri = value;
                  } else if (key.includes('USERNAME') && value) {
                    username = value;
                  } else if (key.includes('DRIVERCLASSNAME') && value) {
                    driverClassName = value;
                  } else if (key.includes('CLASSPATH') && value) {
                    classpath = value;
                  }
                }
              }
            }
          });

          // If we still haven't found anything, try a broader search without database name restriction
          if (databaseUri === '-' && username === '-' && classpath === '-') {
            // Search for any JDBC property that might match this datasource
            Object.keys(properties).forEach(key => {
              if ((key.includes('DATABASEURI') || key.includes('USERNAME') || key.includes('DRIVERCLASSNAME') || key.includes('CLASSPATH')) &&
                  key.includes('datasources.jdbc.')) {
                const keyParts = key.split('.');
                const jdbcIndex = keyParts.findIndex(part => part === 'jdbc');
                if (jdbcIndex >= 0 && jdbcIndex + 1 < keyParts.length) {
                  const keyDataSourceName = keyParts[jdbcIndex + 1];
                  const normalizedKeyName = keyDataSourceName.toLowerCase().normalize('NFKC');

                  // Very flexible matching
                  if (normalizedKeyName === cleanDataSourceName) {
                    const value = properties[key];
                    if (key.includes('DATABASEURI') && value && value.toString().startsWith('jdbc:')) {
                      databaseUri = value;
                    } else if (key.includes('USERNAME') && value) {
                      username = value;
                    } else if (key.includes('DRIVERCLASSNAME') && value) {
                      driverClassName = value;
                    } else if (key.includes('CLASSPATH') && value) {
                      classpath = value;
                    }
                  }
                }
              }
            });
          }

          return { databaseUri, username, driverClassName, classpath };
        };

        // Helper function to extract LDAP values from properties
        const extractLdapValuesFromProperties = (dataSourceName: string, databaseName: string) => {
          if (!properties) return { uri: '-', username: '-' };

          let uri = '-', username = '-';

          // Clean and normalize the datasource name for matching
          const cleanDataSourceName = dataSourceName.replace(/['"]/g, '').toLowerCase().normalize('NFKC');

          // Search through all properties to find matching keys
          Object.keys(properties).forEach(key => {
            if ((key.includes('URI') || key.includes('USERNAME')) &&
                key.includes('datasources.ldap.') &&
                key.includes(`databases.${databaseName}`)) {

              // Extract datasource name from the key
              const keyParts = key.split('.');
              const ldapIndex = keyParts.findIndex(part => part === 'ldap');
              if (ldapIndex >= 0 && ldapIndex + 1 < keyParts.length) {
                const keyDataSourceName = keyParts[ldapIndex + 1];
                const normalizedKeyName = keyDataSourceName.toLowerCase().normalize('NFKC');

                // Try multiple matching strategies
                const matches = (
                  normalizedKeyName === cleanDataSourceName ||
                  normalizedKeyName.replace(/_/g, '') === cleanDataSourceName.replace(/_/g, '') ||
                  normalizedKeyName.replace(/[_-]/g, '') === cleanDataSourceName.replace(/[_-]/g, '')
                );

                if (matches) {
                  const value = properties[key];
                  if (key.includes('URI') && !key.includes('USERURI') && value) {
                    uri = value;
                  } else if (key.includes('USERNAME') && value) {
                    username = value;
                  }
                }
              }
            }
          });

          return { uri, username };
        };

        // Helper function to extract ODBC values from properties
        const extractOdbcValuesFromProperties = (dataSourceName: string, databaseName: string) => {
          if (!properties) return { databaseUri: '-', username: '-' };

          let databaseUri = '-', username = '-';

          // Clean and normalize the datasource name for matching
          const cleanDataSourceName = dataSourceName.replace(/['"]/g, '').toLowerCase().normalize('NFKC');

          // Search through all properties to find matching keys
          Object.keys(properties).forEach(key => {
            if ((key.includes('DATABASEURI') || key.includes('USERNAME')) &&
                key.includes('datasources.odbc.') &&
                key.includes(`databases.${databaseName}`)) {

              // Extract datasource name from the key
              const keyParts = key.split('.');
              const odbcIndex = keyParts.findIndex(part => part === 'odbc');
              if (odbcIndex >= 0 && odbcIndex + 1 < keyParts.length) {
                const keyDataSourceName = keyParts[odbcIndex + 1];
                const normalizedKeyName = keyDataSourceName.toLowerCase().normalize('NFKC');

                // Try multiple matching strategies
                const matches = (
                  normalizedKeyName === cleanDataSourceName ||
                  normalizedKeyName.replace(/_/g, '') === cleanDataSourceName.replace(/_/g, '') ||
                  normalizedKeyName.replace(/[_-]/g, '') === cleanDataSourceName.replace(/[_-]/g, '')
                );

                if (matches) {
                  const value = properties[key];
                  if (key.includes('DATABASEURI') && value) {
                    databaseUri = value;
                  } else if (key.includes('USERNAME') && value) {
                    username = value;
                  }
                }
              }
            }
          });

          return { databaseUri, username };
        };

        // Helper function to extract JSON values from properties
        const extractJsonValuesFromProperties = (dataSourceName: string, databaseName: string) => {
          if (!properties) return { url: '-', user: '-' };

          let url = '-', user = '-';

          // Clean and normalize the datasource name for matching
          const cleanDataSourceName = dataSourceName.replace(/['"]/g, '').toLowerCase().normalize('NFKC');

          // Search through all properties to find matching keys
          Object.keys(properties).forEach(key => {
            if ((key.includes('ROUTE.HTTP.URL') || key.includes('ROUTE.HTTP.USER')) &&
                key.includes('datasources.json.') &&
                key.includes(`databases.${databaseName}`)) {

              // Extract datasource name from the key
              const keyParts = key.split('.');
              const jsonIndex = keyParts.findIndex(part => part === 'json');
              if (jsonIndex >= 0 && jsonIndex + 1 < keyParts.length) {
                const keyDataSourceName = keyParts[jsonIndex + 1];
                const normalizedKeyName = keyDataSourceName.toLowerCase().normalize('NFKC');

                // Try multiple matching strategies
                const matches = (
                  normalizedKeyName === cleanDataSourceName ||
                  normalizedKeyName.replace(/_/g, '') === cleanDataSourceName.replace(/_/g, '') ||
                  normalizedKeyName.replace(/[_-]/g, '') === cleanDataSourceName.replace(/[_-]/g, '')
                );

                if (matches) {
                  const value = properties[key];
                  if (key.includes('ROUTE.HTTP.URL') && value) {
                    url = value;
                  } else if (key.includes('ROUTE.HTTP.USER') && value) {
                    user = value;
                  }
                }
              }
            }
          });

          return { url, user };
        };

        // Initialize analytics for datasource type - different types have different structures
        if (!analytics[ds.type]) {
          // Types with sub-technologies (JDBC, ODBC, DelimitedFile, Custom) use technologies object
          if (ds.type === 'JDBC' || ds.type === 'ODBC' || ds.type === 'DelimitedFile' || ds.type === 'Custom' || ds.type === 'CUSTOM') {
            analytics[ds.type] = { count: 0, technologies: {} };
          } else {
            // Single-type technologies (JSON, XML, MongoDB, etc.) use direct connections array
            // Note: REST and SOAP are handled by Web Services, not here
            analytics[ds.type] = { count: 0, connections: [] };
          }
        }
        analytics[ds.type].count++;

        // IMPORTANT: Handle Web Services (REST, SOAP) FIRST before single-type conditions
        if (ds.type === 'REST' || ds.type === 'SOAP') {
          if (!analytics['Web Services']) {
            analytics['Web Services'] = {
              count: 0,
              technologies: {}
            };
          }
          analytics['Web Services'].count++;

          // Don't increment the REST/SOAP type count since we're grouping under Web Services
          analytics[ds.type].count--;

          const serviceType = ds.type;
          if (!analytics['Web Services'].technologies![serviceType]) {
            analytics['Web Services'].technologies![serviceType] = {
              count: 0,
              details: []
            };
          }
          analytics['Web Services'].technologies![serviceType].count++;
          analytics['Web Services'].technologies![serviceType].details!.push({
            name: ds.name,
            database: ds.database,
            wsdl: ds.wsdlLocation || '-',
            endpoint: ds.endpoint || ds.url || '-',
            serviceType: serviceType
          });

          // Add a dedicated top-level technology bucket for SOAP WS (DATASOURCE WS only)
          // In our pipeline, only DATASOURCE WS populates datasources with type='SOAP'
          if (serviceType === 'SOAP') {
            if (!analytics['SOAP WS']) {
              analytics['SOAP WS'] = {
                count: 0,
                connections: []
              };
            }
            analytics['SOAP WS'].count++;
            analytics['SOAP WS'].connections!.push({
              name: ds.name,
              database: ds.database,
              wsdl: ds.wsdlLocation || '-',
              endpoint: ds.endpoint || ds.url || '-',
              serviceType: 'SOAP'
            });
          }
        }

        // For JDBC, group by database vendor using enhanced property extraction
        else if (ds.type === 'JDBC') {
          // Extract actual JDBC values directly from properties (like DuplicateDetectionService does)
          const jdbcValues = extractJdbcValuesFromProperties(ds.name, ds.database);

          // Determine technology sub-tab from databaseName field (vendor)
          let techKey = 'Generic JDBC';
          if (ds.databaseName) {
            // Map database names to readable vendor names
            const vendorMap: Record<string, string> = {
              'hdb': 'SAP HANA',
              'generic': 'Generic JDBC',
              'sqlserver': 'SQL Server',
              'oracle': 'Oracle',
              'postgresql': 'PostgreSQL',
              'mysql': 'MySQL',
              'db2': 'IBM DB2',
              'sqlite': 'SQLite',
              'sybase': 'Sybase',
              'informix': 'Informix'
            };

            techKey = vendorMap[ds.databaseName.toLowerCase()] || ds.databaseName.toUpperCase();
          }

          if (!analytics[ds.type].technologies![techKey]) {
            analytics[ds.type].technologies![techKey] = {
              count: 0,
              connections: []
            };
          }
          analytics[ds.type].technologies![techKey].count++;

          // Use full URI without truncation and prioritize direct parsed values over properties
          const fullDatabaseUri = jdbcValues.databaseUri !== '-' ? jdbcValues.databaseUri : (ds.databaseUri || '-');
          const finalClasspath = ds.classpath || (jdbcValues.classpath !== '-' ? jdbcValues.classpath : '-');

          analytics[ds.type].technologies![techKey].connections!.push({
            name: ds.name,
            database: ds.database,
            databaseName: ds.databaseName || techKey,
            databaseVersion: ds.databaseVersion || '-',
            // Show full database URI without truncation
            databaseUri: fullDatabaseUri,
            username: jdbcValues.username,
            classpath: finalClasspath,
            fetchSize: resolvePropertyValue(ds.fetchSize),
            validationQuery: resolvePropertyValue(ds.validationQuery)
          });
        }

        // For ODBC, track database technologies and versions
        else if (ds.type === 'ODBC') {
          // Extract actual ODBC values directly from properties
          const odbcValues = extractOdbcValuesFromProperties(ds.name, ds.database);

          const techKey = ds.databaseName || ds.dsn || 'ODBC';

          if (!analytics[ds.type].technologies![techKey]) {
            analytics[ds.type].technologies![techKey] = {
              count: 0,
              versions: [],
              connections: []
            };
          }
          analytics[ds.type].technologies![techKey].count++;
          if (ds.databaseVersion) {
            const versions = analytics[ds.type].technologies![techKey].versions!;
            if (!versions.includes(ds.databaseVersion)) {
              versions.push(ds.databaseVersion);
            }
          }
          analytics[ds.type].technologies![techKey].connections!.push({
            name: ds.name,
            database: ds.database,
            databaseName: ds.databaseName || '-',
            databaseVersion: ds.databaseVersion || '-',
            databaseUri: odbcValues.databaseUri,
            username: odbcValues.username,
            dsn: ds.dsn || '-'
          });
        }

        // For DelimitedFile, track route types with better labels
        else if (ds.type === 'DelimitedFile') {
          let routeKey = 'Local Files';

          if (ds.routeType) {
            const routeType = ds.routeType.toUpperCase();
            switch (routeType) {
              case 'LOCAL':
                routeKey = 'Local Files';
                break;
              case 'FTP':
              case 'FTPS':
                routeKey = 'FTP/FTPS';
                break;
              case 'SFTP':
                routeKey = 'SFTP';
                break;
              case 'HTTP':
              case 'HTTPS':
                routeKey = 'HTTP/HTTPS';
                break;
              case 'S3':
                routeKey = 'Amazon S3';
                break;
              default:
                routeKey = routeType;
            }
          }

          if (!analytics[ds.type].technologies![routeKey]) {
            analytics[ds.type].technologies![routeKey] = {
              count: 0,
              details: []
            };
          }
          analytics[ds.type].technologies![routeKey].count++;
          analytics[ds.type].technologies![routeKey].details!.push({
            name: ds.name,
            database: ds.database,
            routeConnection: ds.routeConnection || '-',
            routeType: ds.routeType || '-'
          });
        }

        // For Custom, track class names with smart grouping
        else if (ds.type === 'Custom' || ds.type === 'CUSTOM') {
          let classKey = 'Generic Custom';

          if (ds.className) {
            const className = ds.className.split('.').pop() || ds.className;

            if (className.toLowerCase().includes('excel')) {
              classKey = 'Excel Wrappers';
            } else if (className.toLowerCase().includes('csv') || className.toLowerCase().includes('delimited')) {
              classKey = 'CSV/Delimited Wrappers';
            } else if (className.toLowerCase().includes('json')) {
              classKey = 'JSON Wrappers';
            } else if (className.toLowerCase().includes('xml')) {
              classKey = 'XML Wrappers';
            } else if (className.toLowerCase().includes('web') || className.toLowerCase().includes('http')) {
              classKey = 'Web Service Wrappers';
            } else {
              classKey = className;
            }
          }

          if (!analytics[ds.type].technologies![classKey]) {
            analytics[ds.type].technologies![classKey] = {
              count: 0,
              fullClassName: ds.className,
              details: [],
              wrappers: []
            };
          }
          analytics[ds.type].technologies![classKey].count++;
          analytics[ds.type].technologies![classKey].details!.push({
            name: ds.name,
            database: ds.database,
            fullClassName: ds.className || '-'
          } as any);

          // Find associated wrappers
          if (db.wrappers) {
            const associatedWrappers = db.wrappers.filter((wrapper: any) =>
              wrapper.dataSourceName === ds.name
            );
            analytics[ds.type].technologies![classKey].wrappers!.push(...associatedWrappers.map((wrapper: any) => ({
              name: wrapper.name,
              database: wrapper.database,
              dataSourceName: wrapper.dataSourceName
            })));
          }
        }

        // Single-type technologies (NO SUB-TABS) - use direct connections
        // Note: REST and SOAP are handled above by Web Services
        else if (ds.type === 'JSON') {
          // Extract actual JSON values directly from properties
          const jsonValues = extractJsonValuesFromProperties(ds.name, ds.database);

          analytics[ds.type].connections!.push({
            name: ds.name,
            database: ds.database,
            endpoint: jsonValues.url !== '-' ? jsonValues.url : (ds.routeConnection || '-'),
            user: jsonValues.user
          });
        }

        else if (ds.type === 'XML') {
          analytics[ds.type].connections!.push({
            name: ds.name,
            database: ds.database,
            endpoint: ds.routeConnection || '-'
          });
        }

        else if (ds.type === 'MONGODB' || ds.type === 'MongoDB') {
          analytics[ds.type].connections!.push({
            name: ds.name,
            database: ds.database,
            host: ds.routeConnection || ds.databaseName || '-'
          });
        }

        else if (ds.type === 'SALESFORCE' || ds.type === 'Salesforce') {
          analytics[ds.type].connections!.push({
            name: ds.name,
            database: ds.database
          });
        }

        else if (ds.type === 'LDAP') {
          // Extract actual LDAP values directly from properties
          const ldapValues = extractLdapValuesFromProperties(ds.name, ds.database);

          analytics[ds.type].connections!.push({
            name: ds.name,
            database: ds.database,
            uri: ldapValues.uri,
            username: ldapValues.username
          });
        }
      });
    });

    // Clean up analytics - remove types with 0 count (like REST/SOAP that got grouped under Web Services)
    Object.keys(analytics).forEach(type => {
      if (analytics[type].count === 0) {
        delete analytics[type];
      }
    });

    return analytics;
  }

  /**
   * Extract JSON endpoint for grouping
   */
  static extractJsonEndpoint(url: string): string {
    if (!url) return 'Unknown';

    try {
      const urlObj = new URL(url);
      return urlObj.hostname || 'Unknown';
    } catch {
      // If URL parsing fails, extract domain manually
      const match = url.match(/https?:\/\/([^/]+)/);
      return match ? match[1] : 'Unknown';
    }
  }

  /**
   * Extract MongoDB host for grouping
   */
  static extractMongoHost(connectionString: string): string {
    if (!connectionString) return 'Unknown';

    // Extract host from MongoDB connection string
    const match = connectionString.match(/mongodb:\/\/[^@]*@?([^/]+)/);
    return match ? match[1] : 'Unknown';
  }

  /**
   * Extract service endpoint from WSDL URL for grouping
   */
  static extractServiceEndpoint(wsdlUrl: string): string {
    if (!wsdlUrl) return 'Unknown';

    try {
      const urlObj = new URL(wsdlUrl);
      return urlObj.hostname || 'Unknown';
    } catch {
      // If URL parsing fails, extract domain manually
      const match = wsdlUrl.match(/https?:\/\/([^/]+)/);
      return match ? match[1] : 'Web Service';
    }
  }

  /**
   * Get summary statistics
   */
  static getSummaryStats(analytics: DataSourceAnalytics): SummaryStats {
    const summary: SummaryStats = {
      totalTypes: Object.keys(analytics).length,
      totalDataSources: 0,
      topTechnologies: []
    };

    // Calculate totals
    Object.values(analytics).forEach(typeData => {
      summary.totalDataSources += typeData.count;
    });

    // Get top technologies across all types
    const allTechs: TopTechnology[] = [];
    Object.entries(analytics).forEach(([type, typeData]) => {
      // Only process types that have sub-technologies (technologies property)
      if (typeData.technologies) {
        Object.entries(typeData.technologies).forEach(([tech, techData]) => {
          allTechs.push({
            type,
            technology: tech,
            count: techData.count
          });
        });
      } else {
        // For single-type technologies, add the main type as a technology
        allTechs.push({
          type,
          technology: type,
          count: typeData.count
        });
      }
    });

    summary.topTechnologies = allTechs
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return summary;
  }

  /**
   * Get technology tabs sorted by connection count (highest first)
   * Returns array of tabs with technology info for tabbed interface
   */
  static getTechnologyTabs(analytics: DataSourceAnalytics): TechnologyTab[] {
    const tabs = Object.entries(analytics)
      // Exclude umbrella 'Web Services' tab; we surface only 'SOAP WS'
      .filter(([type, typeData]) => type !== 'Web Services' && typeData.count > 0)
      .map(([type, typeData]) => ({
        id: type.toLowerCase().replace(/\s+/g, '-'),
        label: type,
        count: typeData.count,
        technologies: typeData.technologies || {},
        hasSubTabs: Object.keys(typeData.technologies || {}).length > 0
      }));

    // Sort by count (descending) - highest connection count appears first
    return tabs.sort((a, b) => b.count - a.count);
  }

  /**
   * Get sub-technology tabs for a specific technology type
   * Returns array of sub-tabs sorted by connection count
   */
  static getSubTechnologyTabs(analytics: DataSourceAnalytics, technologyType: string): SubTechnologyTab[] {
    const technologyData = analytics[technologyType];
    if (!technologyData || !technologyData.technologies) {
      return [];
    }

    const subTabs = Object.entries(technologyData.technologies).map(([tech, techData]) => ({
      id: tech.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      label: tech,
      count: techData.count,
      data: techData
    }));

    // Sort by count (descending)
    return subTabs.sort((a, b) => b.count - a.count);
  }

  /**
   * Get table data for a specific technology and sub-technology
   * Returns formatted data ready for table display
   */
  static getTableData(analytics: DataSourceAnalytics, technologyType: string, subTechnology?: string): any[] {
    const technologyData = analytics[technologyType];
    if (!technologyData) return [];

    // For technologies without sub-tabs (JSON, XML, MongoDB, etc.), return direct connections
    if (technologyData.connections) {
      return technologyData.connections;
    }

    // For technologies with sub-tabs, handle accordingly
    if (!subTechnology) {
      // Return all connections for this technology
      let allConnections: any[] = [];

      if (technologyData.technologies) {
        Object.values(technologyData.technologies).forEach(tech => {
          if (tech.connections) {
            allConnections = allConnections.concat(tech.connections);
          } else if (tech.details) {
            allConnections = allConnections.concat(tech.details);
          }
        });
      }

      return allConnections;
    }

    // Return connections for specific sub-technology
    const subTechData = technologyData.technologies![subTechnology];
    if (!subTechData) return [];

    return subTechData.connections || subTechData.details || [];
  }

  /**
   * Get table columns configuration for different technology types
   * Returns column definitions for smart table
   */
  static getTableColumns(technologyType: string): ColumnConfig[] {
    const columnConfigs: Record<string, ColumnConfig[]> = {
      'JDBC': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database', sortable: true },
        { key: 'databaseName', label: 'DB Type', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'classpath', label: 'Class Path', sortable: true }
      ],
      // JDBC vendor-specific configurations (same columns as JDBC)
      'SAP HANA': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database', sortable: true },
        { key: 'databaseName', label: 'DB Type', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'classpath', label: 'Class Path', sortable: true }
      ],
      'Generic JDBC': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database', sortable: true },
        { key: 'databaseName', label: 'DB Type', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'classpath', label: 'Class Path', sortable: true }
      ],
      'SQL Server': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database', sortable: true },
        { key: 'databaseName', label: 'DB Type', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'classpath', label: 'Class Path', sortable: true }
      ],
      'Oracle': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database', sortable: true },
        { key: 'databaseName', label: 'DB Type', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'classpath', label: 'Class Path', sortable: true }
      ],
      'PostgreSQL': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database', sortable: true },
        { key: 'databaseName', label: 'DB Type', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'classpath', label: 'Class Path', sortable: true }
      ],
      'MySQL': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database', sortable: true },
        { key: 'databaseName', label: 'DB Type', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'classpath', label: 'Class Path', sortable: true }
      ],
      'IBM DB2': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database', sortable: true },
        { key: 'databaseName', label: 'DB Type', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'classpath', label: 'Class Path', sortable: true }
      ],
      'ODBC': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'databaseVersion', label: 'Version', sortable: true },
        { key: 'databaseUri', label: 'DB URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true },
        { key: 'dsn', label: 'DSN', sortable: true }
      ],
      'Custom': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'fullClassName', label: 'Class Name', sortable: false }
      ],
      'CUSTOM': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'fullClassName', label: 'Class Name', sortable: false }
      ],
      'DelimitedFile': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'routeType', label: 'Route Type', sortable: true },
        { key: 'routeConnection', label: 'Route Connection', sortable: false }
      ],
      'JSON': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'endpoint', label: 'Endpoint URL', sortable: false },
        { key: 'user', label: 'HTTP User', sortable: true }
      ],
      'XML': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'endpoint', label: 'Endpoint', sortable: false }
      ],
      'LDAP': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'uri', label: 'LDAP URI', sortable: false },
        { key: 'username', label: 'Username', sortable: true }
      ],
      'Web Services': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'serviceType', label: 'Service Type', sortable: true },
        { key: 'endpoint', label: 'Endpoint', sortable: false },
        { key: 'wsdl', label: 'WSDL', sortable: false }
      ],
      'MONGODB': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'host', label: 'Host', sortable: true }
      ],
      'SALESFORCE': [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true }
      ]
    };

    // Special columns for dedicated SOAP WS tab
    if (technologyType === 'SOAP WS') {
      return [
        { key: 'name', label: 'DataSource Name', sortable: true },
        { key: 'database', label: 'Database Name', sortable: true },
        { key: 'endpoint', label: 'Endpoint', sortable: false },
        { key: 'wsdl', label: 'WSDL', sortable: false }
      ];
    }

    return columnConfigs[technologyType] || [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'database', label: 'Database', sortable: true }
    ];
  }

  /**
   * Get type-specific expandable sections like original
   */
  static getExpandableTypes(): string[] {
    // Remove 'Web Services' umbrella from expandable list
    return ['JDBC', 'ODBC', 'Custom', 'CUSTOM', 'DelimitedFile', 'JSON', 'XML', 'MONGODB', 'SALESFORCE', 'LDAP'];
  }

  /**
   * Get wrapper analytics including Excel wrapper analysis
   */
  static getWrapperAnalytics(databases: DatabaseWithSources[]): WrapperAnalytics {
    const analytics: WrapperAnalytics = {};
    let allWrappers: any[] = [];

    // Collect all wrappers from all databases
    databases.forEach(db => {
      if (db.wrappers && db.wrappers.length > 0) {
        allWrappers = allWrappers.concat(db.wrappers.map((w: any) => ({
          ...w,
          database: db.name
        })));
      }
    });

    // Analyze wrappers by type
    allWrappers.forEach(wrapper => {
      const type = wrapper.wrapperType || 'Unknown';

      if (!analytics[type]) {
        analytics[type] = {
          count: 0,
          wrappers: [],
          streamTuplesStats: {
            enabled: 0,
            disabled: 0,
            unconfigured: 0
          }
        };
      }

      analytics[type].count++;
      analytics[type].wrappers.push(wrapper);

      // Track stream tuples configuration
      if (wrapper.streamTuplesConfig) {
        if (wrapper.streamTuplesConfig.enabled) {
          analytics[type].streamTuplesStats.enabled++;
        } else if (wrapper.streamTuplesConfig.disabled) {
          analytics[type].streamTuplesStats.disabled++;
        } else {
          analytics[type].streamTuplesStats.unconfigured++;
        }
      } else {
        analytics[type].streamTuplesStats.unconfigured++;
      }
    });

    return analytics;
  }

  /**
   * Get Excel wrapper specific analytics based on datasource classname
   */
  static getExcelWrapperAnalytics(databases: DatabaseWithSources[]): ExcelWrapperStats {
    let allExcelWrappers: any[] = [];

    // Look directly for wrappers with Excel file type parameter
    databases.forEach(db => {
      if (db.wrappers && db.wrappers.length > 0) {
        db.wrappers.forEach((wrapper: any) => {
          const typeOfFile = wrapper.parameters?.['Type of file'];
          const isExcelWrapper = typeOfFile && (
            typeOfFile.includes('Excel') ||
            typeOfFile.includes('*.xlsx') ||
            typeOfFile.includes('*.xls')
          );
          if (isExcelWrapper) {
            allExcelWrappers.push({
              ...wrapper,
              database: db.name,
              isExcelWrapper: true
            });
          }
        });
      }
    });

    const stats: ExcelWrapperStats = {
      totalExcelWrappers: allExcelWrappers.length,
      streamTuplesEnabled: 0,
      streamTuplesDisabled: 0,
      streamTuplesUnconfigured: 0,
      disabledWrappers: [],
      enabledWrappers: []
    };

    allExcelWrappers.forEach(wrapper => {
      // Check both streamTuplesConfig and parameters for the stream tuples value
      let streamTuplesEnabled = false;

      if (wrapper.streamTuplesConfig && wrapper.streamTuplesConfig.configured) {
        streamTuplesEnabled = wrapper.streamTuplesConfig.streamTuples === true;
      } else if (wrapper.parameters && wrapper.parameters['Stream tuples'] !== undefined) {
        // Handle string 'true'/'false' from parameters
        const streamTuplesParam = wrapper.parameters['Stream tuples'];
        streamTuplesEnabled = streamTuplesParam === true || streamTuplesParam === 'true';
      }

      if (streamTuplesEnabled) {
        stats.streamTuplesEnabled++;
        stats.enabledWrappers.push(wrapper);
      } else {
        stats.streamTuplesDisabled++;
        stats.disabledWrappers.push(wrapper);
      }
    });

    return stats;
  }

  /**
   * Get Excel wrapper stream tuples stats from DuckDB wrappers and datasources
   * This matches the logic from React's ExcelWrapperQueryService
   */
  static async getExcelWrapperStreamTuplesStats(wrappers: any[], datasources: any[]): Promise<ExcelWrapperStats> {
    console.log('🔍 getExcelWrapperStreamTuplesStats called');
    console.log('  Total wrappers:', wrappers.length);
    console.log('  Total datasources:', datasources.length);

    // Step 1: Find Excel datasources by className
    const excelDataSources = new Set<string>();
    datasources.forEach(ds => {
      const isExcelDataSource = (ds.type === 'CUSTOM' || ds.type === 'Custom') && (
        ds.className === 'com.denodo.vdb.contrib.wrapper.xls.ExcelWrapper' ||
        ds.className === 'com.denodo.wrapper.xls.ExcelWrapper' ||
        ds.className === 'ExcelWrapper' ||
        (ds.className && ds.className.toLowerCase().includes('excel'))
      );

      if (isExcelDataSource) {
        excelDataSources.add(ds.name);
      }
    });

    console.log('  Excel datasources found:', excelDataSources.size, Array.from(excelDataSources).slice(0, 3));

    // Debug: Check first wrapper structure
    if (wrappers.length > 0) {
      console.log('  First wrapper sample:', {
        name: wrappers[0].name,
        wrapperType: wrappers[0].wrapperType,
        dataSourceName: wrappers[0].dataSourceName,
        allKeys: Object.keys(wrappers[0])
      });
    }

    // Step 2: Find Excel wrappers using React's approach
    // PRIMARY: Wrappers referencing Excel datasources
    const excelWrappersByDatasource = wrappers.filter(wrapper => {
      return (wrapper.wrapperType === 'CUSTOM' || wrapper.wrapperType === 'Custom') &&
             wrapper.dataSourceName &&
             excelDataSources.has(wrapper.dataSourceName);
    });

    console.log('  Excel wrappers by datasource:', excelWrappersByDatasource.length);

    // SECONDARY: Wrappers with Excel indicators in parameters (React line 133-164)
    const excelWrappersByParameters = wrappers.filter((wrapper, idx) => {
      // Skip if already found by datasource
      if (excelWrappersByDatasource.some(ew => ew.name === wrapper.name)) {
        return false;
      }

      // Debug first wrapper
      if (idx === 0) {
        console.log('  🔍 Checking first wrapper for Excel indicators:', {
          name: wrapper.name,
          hasParameters: !!wrapper.parameters,
          parametersType: typeof wrapper.parameters,
          parametersPreview: typeof wrapper.parameters === 'string'
            ? wrapper.parameters.substring(0, 200)
            : wrapper.parameters
        });
      }

      // Parse parameters if JSON string
      let parameters = wrapper.parameters;
      if (typeof parameters === 'string') {
        try {
          parameters = JSON.parse(parameters);
          if (idx === 0) console.log('  ✅ Parsed parameters:', Object.keys(parameters || {}).slice(0, 10));
        } catch (e) {
          if (idx === 0) console.log('  ❌ Failed to parse parameters:', e);
          return false;
        }
      }

      if (!parameters || typeof parameters !== 'object') {
        if (idx === 0) console.log('  ⚠️ No valid parameters object');
        return false;
      }

      // Debug parameter keys
      if (idx === 0) {
        const allKeys = Object.keys(parameters);
        console.log('  📝 All parameter keys:', allKeys);
        const typeFileKeys = allKeys.filter(k => k.toLowerCase().includes('type') || k.toLowerCase().includes('file'));
        console.log('  📝 Type/File related keys:', typeFileKeys);
      }

      // Check for 'Type of file' containing 'excel' or 'xls'
      const hasExcelTypeOfFile = Object.keys(parameters).some(key => {
        if (key.toLowerCase().includes('type') && key.toLowerCase().includes('file')) {
          const value = parameters[key]?.toString()?.toLowerCase() || '';
          if (idx === 0) console.log(`  🔍 Checking key "${key}": value="${value.substring(0, 50)}"`);
          return value.includes('excel') || value.includes('xls');
        }
        return false;
      });

      if (hasExcelTypeOfFile) {
        if (idx === 0) console.log('  ✅ Found Excel by Type of file!');
        return true;
      }

      // Check for Excel file extensions in 'File location'
      const hasExcelFile = Object.keys(parameters).some(key => {
        if (key.toLowerCase().includes('file') && key.toLowerCase().includes('location')) {
          const value = parameters[key]?.toString()?.toLowerCase() || '';
          return value.includes('.xls') || value.includes('.xlsx');
        }
        return false;
      });

      if (idx === 0 && !hasExcelFile) {
        console.log('  ❌ No Excel indicators found in this wrapper');
      }

      return hasExcelFile;
    });

    console.log('  Excel wrappers by parameters:', excelWrappersByParameters.length);

    // Combine and deduplicate
    const excelWrappers = [...excelWrappersByDatasource, ...excelWrappersByParameters];

    console.log('  Excel wrappers found:', excelWrappers.length);
    if (excelWrappers.length > 0) {
      console.log('  First Excel wrapper:', {
        name: excelWrappers[0].name,
        dataSourceName: excelWrappers[0].dataSourceName,
        hasStreamTuplesConfig: !!excelWrappers[0].streamTuplesConfig,
        streamTuplesConfigType: typeof excelWrappers[0].streamTuplesConfig,
        hasParameters: !!excelWrappers[0].parameters,
        parametersType: typeof excelWrappers[0].parameters
      });
    }

    // Step 3: Analyze stream tuples configuration
    const stats: ExcelWrapperStats = {
      totalExcelWrappers: excelWrappers.length,
      streamTuplesEnabled: 0,
      streamTuplesDisabled: 0,
      streamTuplesUnconfigured: 0,
      disabledWrappers: [],
      enabledWrappers: []
    };

    excelWrappers.forEach((wrapper, idx) => {
      let streamEnabled = false;
      let streamDisabled = false;
      let streamUnconfigured = false;
      let streamTuplesValue: any = undefined;

      if (idx === 0) {
        console.log('  📊 Analyzing first wrapper:', wrapper.name);
      }

      // Parse streamTuplesConfig if it's a JSON string (from DuckDB)
      let streamTuplesConfig: any = wrapper.streamTuplesConfig;
      if (typeof streamTuplesConfig === 'string') {
        try {
          streamTuplesConfig = JSON.parse(streamTuplesConfig);
          if (idx === 0) console.log('    ✅ Parsed streamTuplesConfig:', streamTuplesConfig);
        } catch (e) {
          if (idx === 0) console.log('    ❌ Failed to parse streamTuplesConfig');
          streamTuplesConfig = null;
        }
      } else {
        if (idx === 0) console.log('    streamTuplesConfig type:', typeof streamTuplesConfig, streamTuplesConfig);
      }

      // Parse parameters if it's a JSON string (from DuckDB)
      let parameters: any = wrapper.parameters;
      if (typeof parameters === 'string') {
        try {
          parameters = JSON.parse(parameters);
          if (idx === 0) console.log('    ✅ Parsed parameters, keys:', Object.keys(parameters || {}));
        } catch (e) {
          if (idx === 0) console.log('    ❌ Failed to parse parameters');
          parameters = null;
        }
      } else {
        if (idx === 0) console.log('    parameters type:', typeof parameters, parameters ? Object.keys(parameters).slice(0, 5) : null);
      }

      // Replicate React logic from ExcelWrapperQueryService.js lines 261-330
      if (streamTuplesConfig) {
        streamTuplesValue = streamTuplesConfig.value;
        streamEnabled = streamTuplesConfig.enabled === true;
        streamDisabled = streamTuplesConfig.disabled === true;
        if (idx === 0) console.log('    🌊 Using streamTuplesConfig:', { enabled: streamEnabled, disabled: streamDisabled, value: streamTuplesValue });
      }
      else if (wrapper.streamTuples !== undefined) {
        streamTuplesValue = wrapper.streamTuples;
        if (wrapper.streamTuples === true || wrapper.streamTuples === 'true') {
          streamEnabled = true;
        } else if (wrapper.streamTuples === false || wrapper.streamTuples === 'false') {
          streamDisabled = true;
        }
        if (idx === 0) console.log('    🌊 Using direct streamTuples:', streamTuplesValue);
      }
      else if (parameters) {
        const paramKeys = Object.keys(parameters);
        const streamTuplesKey = paramKeys.find(key =>
          key.toLowerCase() === 'stream tuples' ||
          key.toLowerCase() === 'streamtuples' ||
          key === 'Stream tuples'
        );

        if (streamTuplesKey) {
          streamTuplesValue = parameters[streamTuplesKey];
          if (streamTuplesValue === true || streamTuplesValue === 'true') {
            streamEnabled = true;
          } else if (streamTuplesValue === false || streamTuplesValue === 'false') {
            streamDisabled = true;
          }
          if (idx === 0) console.log('    🌊 Using parameters[Stream tuples]:', streamTuplesValue);
        } else {
          streamUnconfigured = true;
          if (idx === 0) console.log('    ⚠️ No Stream tuples parameter found, marking unconfigured');
        }
      } else {
        streamUnconfigured = true;
        if (idx === 0) console.log('    ⚠️ No parameters, marking unconfigured');
      }

      // React logic lines 311-330
      if (streamEnabled) {
        stats.streamTuplesEnabled++;
        stats.enabledWrappers.push({
          ...wrapper,
          streamTuplesValue,
          streamTuplesStatus: 'enabled'
        });
      } else if (streamDisabled) {
        stats.streamTuplesDisabled++;
        stats.disabledWrappers.push({
          ...wrapper,
          streamTuplesValue,
          streamTuplesStatus: 'disabled'
        });
      } else {
        // Default to enabled if unconfigured
        stats.streamTuplesEnabled++;
        stats.streamTuplesUnconfigured++;
        stats.enabledWrappers.push({
          ...wrapper,
          streamTuplesValue,
          streamTuplesStatus: 'unconfigured'
        });
      }
    });

    return stats;
  }
}
