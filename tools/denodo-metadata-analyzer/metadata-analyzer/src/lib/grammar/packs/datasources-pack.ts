// DataSources Grammar Pack - Ported from existing grammar-config.js
// Contains: All 10 DATASOURCE types (JDBC, CUSTOM, DF, JSON, XML, WS, MONGODB, SALESFORCE, LDAP, ODBC)

import type { GrammarPack } from '../../../types/grammar';

const PATTERNS = {
  quotedIdentifier: '(?:"([^"]+)"|([\\w.-]+))',
  prefixes: {
    jdbcDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+JDBC\\s+',
    customDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+CUSTOM\\s+',
    dfDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+DF\\s+',
    jsonDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+JSON\\s+',
    xmlDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+XML\\s+',
    wsDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+WS\\s+',
    mongodbDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+MONGODB\\s+',
    salesforceDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+SALESFORCE\\s+',
    ldapDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+LDAP\\s+',
    odbcDatasource: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+ODBC\\s+'
  }
};

export const DataSourcesPack: GrammarPack = {
  name: 'datasources',
  version: '1.0.0',
  description: 'All DataSource statements - JDBC, CUSTOM, DF, JSON, XML, WS, MONGODB, SALESFORCE, LDAP, ODBC',

  statements: {
    DATASOURCE_JDBC: {
      patterns: [PATTERNS.prefixes.jdbcDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.jdbcDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "JDBC" },
        url: {
          type: "keyValue",
          keys: ["URL", "DATABASEURI", "SERVERURI"],
          pattern: "\\b(?:URL|DATABASEURI|SERVERURI)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        },
        driver: {
          type: "keyValue",
          keys: ["DRIVERCLASS", "DRIVER", "DRIVERCLASSNAME"],
          pattern: "\\b(?:DRIVERCLASS|DRIVER|DRIVERCLASSNAME)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        },
        databaseName: {
          type: "customProcessor",
          processor: "extractJdbcDatabaseName"
        },
        databaseVersion: {
          type: "customProcessor",
          processor: "extractJdbcDatabaseVersion"
        },
        username: {
          type: "keyValue",
          keys: ["USERNAME"],
          pattern: "\\bUSERNAME\\s*=\\s*'([^']*)'",
          group: 1
        },
        classpath: {
          type: "customProcessor",
          processor: "extractJdbcClasspath"
        },
        vendor: {
          type: "customProcessor",
          processor: "detectVendorFromStatement"
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          url: "$url",
          driver: "$driver",
          databaseName: "$databaseName",
          databaseVersion: "$databaseVersion",
          username: "$username",
          classpath: "$classpath",
          vendor: "$vendor"
        }
      }
    },

    DATASOURCE_CUSTOM: {
      patterns: [
        // Enhanced pattern that handles multiline statements and various whitespace/newline combinations
        'CREATE\\s+(?:OR\\s+REPLACE\\s+)?DATASOURCE\\s+CUSTOM\\s+(?:"([^"]+)"|\'([^\']+)\'|([\\w\\d_.-]+))',
        // Fallback pattern for statements with extensive whitespace or newlines
        'CREATE[\\s\\n]+(?:OR[\\s\\n]+REPLACE[\\s\\n]+)?DATASOURCE[\\s\\n]+CUSTOM[\\s\\n]+(?:"([^"]+)"|\'([^\']+)\'|([\\w\\d_.-]+))'
      ],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.customDatasource,
          group: 1,
          fallbackGroup: [2, 3],
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "Custom" },
        className: {
          type: "customProcessor",
          processor: "extractCustomClassName"
        },
        folder: {
          type: "keyValue",
          keys: ["FOLDER"]
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          className: "$className",
          folder: "$folder"
        }
      }
    },

    DATASOURCE_DF: {
      patterns: [PATTERNS.prefixes.dfDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.dfDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "DelimitedFile" },
        routeType: {
          type: "customProcessor",
          processor: "extractDFRouteType"
        },
        routeConnection: {
          type: "customProcessor",
          processor: "extractDFRouteConnection"
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          routeType: "$routeType",
          routeConnection: "$routeConnection"
        }
      }
    },

    DATASOURCE_JSON: {
      patterns: [PATTERNS.prefixes.jsonDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.jsonDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "JSON" },
        url: {
          type: "keyValue",
          keys: ["URL", "ENDPOINT"],
          pattern: "\\b(?:URL|ENDPOINT)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        },
        routeType: {
          type: "keyValue",
          keys: ["ROUTE"],
          pattern: "\\bROUTE\\s+(\\w+)\\s+'([^']+)'",
          group: 1
        },
        routeConnection: {
          type: "keyValue",
          keys: ["ROUTE"],
          pattern: "\\bROUTE\\s+(\\w+)\\s+'([^']+)'",
          group: 2
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          url: "$url",
          routeType: "$routeType",
          routeConnection: "$routeConnection"
        }
      }
    },

    DATASOURCE_XML: {
      patterns: [PATTERNS.prefixes.xmlDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.xmlDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "XML" },
        url: {
          type: "keyValue",
          keys: ["URL", "ENDPOINT"],
          pattern: "\\b(?:URL|ENDPOINT)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        },
        routeType: {
          type: "keyValue",
          keys: ["ROUTE"],
          pattern: "\\bROUTE\\s+(\\w+)\\s+'([^']+)'",
          group: 1
        },
        routeConnection: {
          type: "keyValue",
          keys: ["ROUTE"],
          pattern: "\\bROUTE\\s+(\\w+)\\s+'([^']+)'",
          group: 2
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          url: "$url",
          routeType: "$routeType",
          routeConnection: "$routeConnection"
        }
      }
    },

    DATASOURCE_WS: {
      patterns: [PATTERNS.prefixes.wsDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.wsDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "SOAP" },
        webServiceType: { value: "SOAP" },
        url: {
          type: "keyValue",
          keys: ["URL", "ENDPOINT", "WSDLURL"],
          pattern: "\\b(?:URL|ENDPOINT|WSDLURL)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        },
        wsdlLocation: {
          type: "keyValue",
          keys: ["WSDLLOCATION"],
          pattern: "\\bWSDLLOCATION\\s*=\\s*'([^']*)'",
          group: 1
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          webServiceType: "$webServiceType",
          database: "$currentDatabase",
          url: "$url",
          wsdlLocation: "$wsdlLocation"
        }
      }
    },

    DATASOURCE_MONGODB: {
      patterns: [PATTERNS.prefixes.mongodbDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.mongodbDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "MongoDB" },
        url: {
          type: "keyValue",
          keys: ["URL", "URI"],
          pattern: "\\b(?:URL|URI)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        },
        databaseName: {
          type: "keyValue",
          keys: ["DATABASENAME"],
          pattern: "\\bDATABASENAME\\s*=\\s*'([^']*)'",
          group: 1
        },
        routeType: {
          type: "keyValue",
          keys: ["ROUTE"],
          pattern: "\\bROUTE\\s+(\\w+)\\s+'([^']+)'",
          group: 1
        },
        routeConnection: {
          type: "keyValue",
          keys: ["ROUTE"],
          pattern: "\\bROUTE\\s+(\\w+)\\s+'([^']+)'",
          group: 2
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          url: "$url",
          databaseName: "$databaseName",
          routeType: "$routeType",
          routeConnection: "$routeConnection"
        }
      }
    },

    DATASOURCE_SALESFORCE: {
      patterns: [PATTERNS.prefixes.salesforceDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.salesforceDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "Salesforce" },
        url: {
          type: "keyValue",
          keys: ["URL", "ENDPOINT"],
          pattern: "\\b(?:URL|ENDPOINT)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          url: "$url"
        }
      }
    },

    DATASOURCE_LDAP: {
      patterns: [PATTERNS.prefixes.ldapDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.ldapDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "LDAP" },
        url: {
          type: "keyValue",
          keys: ["URL", "SERVER"],
          pattern: "\\b(?:URL|SERVER)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        },
        serverName: {
          type: "keyValue",
          keys: ["SERVERNAME"],
          pattern: "\\bSERVERNAME\\s*=\\s*'([^']*)'",
          group: 1
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          url: "$url",
          serverName: "$serverName"
        }
      }
    },

    DATASOURCE_ODBC: {
      patterns: [PATTERNS.prefixes.odbcDatasource + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.odbcDatasource,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "ODBC" },
        dsn: {
          type: "keyValue",
          keys: ["DSN", "DATASOURCENAME"],
          pattern: "\\b(?:DSN|DATASOURCENAME)\\s*(?:=\\s*)?'([^']*)'",
          group: 1
        },
        databaseName: {
          type: "keyValue",
          keys: ["DATABASENAME"],
          pattern: "\\bDATABASENAME\\s*=\\s*'([^']*)'",
          group: 1
        },
        databaseVersion: {
          type: "keyValue",
          keys: ["DATABASEVERSION"],
          pattern: "\\bDATABASEVERSION\\s*=\\s*'([^']*)'",
          group: 1
        }
      },
      normalize: {
        table: "datasources",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          dsn: "$dsn",
          databaseName: "$databaseName",
          databaseVersion: "$databaseVersion"
        }
      }
    }
  },

  processors: {
    sanitizeIdentifier: (value: any) => {
      if (!value || typeof value !== 'string') return value;
      return value.replace(/\bOR\s+REPLACE\b/gi, '').replace(/^"([\s\S]*?)"$/, '$1').trim();
    },

    detectVendorFromStatement: (statement: any) => {
      if (!statement || typeof statement !== 'string') return 'unknown';

      // Extract URL, driver, and databaseName from the statement
      const urlMatch = statement.match(/\b(?:URL|DATABASEURI|SERVERURI)\s*(?:=\s*)?'([^']*)'/i);
      const driverMatch = statement.match(/\b(?:DRIVERCLASS|DRIVER|DRIVERCLASSNAME)\s*(?:=\s*)?'([^']*)'/i);
      const databaseNameMatch = statement.match(/\bDATABASENAME\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s,;#)\r\n]+))/i);

      const url = urlMatch ? urlMatch[1] : null;
      const driver = driverMatch ? driverMatch[1] : null;
      const databaseName = databaseNameMatch ? (databaseNameMatch[1] || databaseNameMatch[2] || databaseNameMatch[3]) : null;

      // First try vendor detection from URL/driver
      const detectVendor = (url: any, driver: any) => {
        const u = (url || '').toLowerCase();
        const d = (driver || '').toLowerCase();
        const pairs: [string, string[]][] = [
          ['oracle', ['jdbc:oracle:', 'oracle.jdbc', 'thin:@']],
          ['sql server', ['jdbc:sqlserver:', 'microsoft.sqlserver', 'sqlserverdriver']],
          ['postgresql', ['jdbc:postgresql:', 'org.postgresql']],
          ['mysql', ['jdbc:mysql:', 'com.mysql', 'mysql']],
          ['teradata', ['jdbc:teradata:', 'teradata.jdbc']],
          ['sap hana', ['jdbc:sap:', 'com.sap']],
          ['snowflake', ['jdbc:snowflake:', 'snowflake.client']],
          ['databricks', ['jdbc:spark:', 'databricks']],
          ['redshift', ['jdbc:redshift:', 'redshift.jdbc']]
        ];

        for (const [vendor, patterns] of pairs) {
          if (patterns.some(pattern => u.includes(pattern) || d.includes(pattern))) {
            return vendor;
          }
        }
        return 'unknown';
      };

      const detectedVendor = detectVendor(url, driver);

      // If vendor detection failed but we have a databaseName, use that instead of "unknown"
      if (detectedVendor === 'unknown' && databaseName) {
        return databaseName;
      }

      return detectedVendor;
    },

    detectVendor: (url: string, driver: string) => {
      const u = (url || '').toLowerCase();
      const d = (driver || '').toLowerCase();
      const pairs: [string, string[]][] = [
        ['oracle', ['jdbc:oracle:', 'oracle.jdbc', 'thin:@']],
        ['sql server', ['jdbc:sqlserver:', 'microsoft.sqlserver', 'sqlserverdriver']],
        ['postgresql', ['jdbc:postgresql:', 'org.postgresql']],
        ['mysql', ['jdbc:mysql:', 'com.mysql', 'mysql.cj']],
        ['mariadb', ['jdbc:mariadb:', 'org.mariadb']],
        ['db2', ['jdbc:db2:', 'ibm.db2']],
        ['snowflake', ['jdbc:snowflake:', 'snowflake']],
        ['redshift', ['jdbc:redshift:', 'redshift']],
        ['sap hana', ['jdbc:sap:', 'sap.db.jdbc', 'hana']],
        ['teradata', ['jdbc:teradata:', 'teradata']],
        ['vertica', ['jdbc:vertica:', 'vertica']],
        ['sybase', ['jdbc:sybase:', 'sybase']],
        ['bigquery', ['simba.googlebigquery', 'jdbc:bigquery:', 'bigquery']],
        ['athena', ['jdbc:awsathena', 'jdbc:athena:', 'athena']],
        ['trino/presto', ['jdbc:trino:', 'jdbc:presto:', 'trino', 'presto']],
        ['sqlite', ['jdbc:sqlite:', 'sqlite']],
        ['denodo', ['jdbc:denodo:']],
        ['derby', ['jdbc:derby:']]
      ];

      for (const [vendor, needles] of pairs) {
        if (needles.some(n => u.includes(n) || d.includes(n))) return vendor;
      }

      if (u.startsWith('jdbc:')) {
        const parts = u.split(':');
        if (parts.length >= 2) return parts[1]; // fallback to scheme
      }

      return 'unknown';
    },

    extractJdbcDatabaseName: (statement: string) => {
      if (!statement || typeof statement !== 'string') return undefined;

      // Use exact regex from legacy JDBC extractor
      const regex = /DATABASENAME\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s,;#)\r\n]+))/i;
      const match = regex.exec(statement);
      const result = match ? (match[1] || match[2] || match[3] || '').trim() : undefined;

      return result;
    },

    extractJdbcDatabaseVersion: (statement: string) => {
      if (!statement || typeof statement !== 'string') return undefined;

      const regex = /DATABASEVERSION\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s,;#)\r\n]+))/i;
      const match = regex.exec(statement);
      return match ? (match[1] || match[2] || match[3] || '').trim() : undefined;
    },

    extractJdbcClasspath: (statement: string) => {
      if (!statement || typeof statement !== 'string') return undefined;

      const regex = /CLASSPATH\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s,;#)\r\n]+))/i;
      const match = regex.exec(statement);
      return match ? (match[1] || match[2] || match[3] || '').trim() : undefined;
    },

    extractCustomClassName: (statement: string) => {
      if (!statement || typeof statement !== 'string') return undefined;

      const regex = /CLASSNAME\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s,;#)\r\n]+))/i;
      const match = regex.exec(statement);
      return match ? (match[1] || match[2] || match[3] || '').trim() : undefined;
    },

    extractDFRouteType: (statement: string) => {
      if (!statement || typeof statement !== 'string') return undefined;

      const regex = /ROUTE\s+(\w+)\s+'([^']+)'/i;
      const match = regex.exec(statement);
      return match ? match[1] : undefined;
    },

    extractDFRouteConnection: (statement: string) => {
      if (!statement || typeof statement !== 'string') return undefined;

      const regex = /ROUTE\s+(\w+)\s+'([^']+)'/i;
      const match = regex.exec(statement);
      return match ? match[2] : undefined;
    }
  }
};