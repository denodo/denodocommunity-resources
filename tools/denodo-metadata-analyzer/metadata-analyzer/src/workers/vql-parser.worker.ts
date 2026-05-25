/**
 * VQL Parser Web Worker - EXACT REACT PORT
 * Uses VQLLexer + StatementDispatcher like React (FAST single-pass)
 * Normalizes data for DuckDB instead of IndexedDB
 */

import { VQLLexer } from '../lib/lexer/vql-lexer';
import { StatementDispatcher } from '../lib/parsers/statement-dispatcher';

// Type definitions for worker messages
interface ParseMessage {
  type: 'parse';
  content: string;
  analysisId: string;
}

interface ProgressMessage {
  type: 'progress';
  stage: string;
  progress: number;
}

interface ResultMessage {
  type: 'result';
  success: boolean;
  results?: any;
  error?: string;
}

// Store analysisId globally in worker scope
let currentAnalysisId: string = '';

// Listen for messages from main thread
self.onmessage = async (e: MessageEvent<ParseMessage>) => {
  const { type, content, analysisId } = e.data;

  if (type !== 'parse') {
    return;
  }

  try {
    // Store analysisId for use in normalization functions
    currentAnalysisId = analysisId;

    const sendProgress = (stage: string, progress: number) => {
      console.log('[Worker SEND]', progress + '%', stage);
      self.postMessage({ type: 'progress', stage, progress } as ProgressMessage);
    };

    sendProgress('Initializing...', 5);

    // EXACT REACT APPROACH: VQLLexer + StatementDispatcher
    const lexer = new VQLLexer();
    const dispatcher = new StatementDispatcher();

    // View registry for ALTER VIEW cache handling
    const viewRegistry = new Map();

    // Results organized by type (like React)
    type WorkerResults = {
      databases: any[];
      datasources: any[];
      views: any[];
      wrappers: any[];
      associations: any[];
      webservices: any[];
      global_elements: any[];
      cache_data: any[];
      view_stats: any[];
      role_modifications: any[];
      resource_plans: any[];
      resource_rules: any[];
      server_configuration: any[];
    };

    const results: WorkerResults & { database_cache?: any[] } = {
      databases: [],
      datasources: [],
      views: [],
      wrappers: [],
      associations: [],
      webservices: [],
      global_elements: [],
      cache_data: [],
      view_stats: [],
      role_modifications: [],
      resource_plans: [],
      resource_rules: [],
      server_configuration: []
    };

    sendProgress('Parsing VQL...', 10);

    // OPTIMIZED: 2MB chunk streaming with memory management
    const chunkSize = 2 * 1024 * 1024;
    const totalChunks = Math.ceil(content.length / chunkSize);
    let processedChunks = 0;
    let processedStatements = 0;

    console.log(`[Worker] Processing ${(content.length / 1024 / 1024).toFixed(2)}MB in ${totalChunks} chunks`);

    for (let offset = 0; offset < content.length; offset += chunkSize) {
      const chunk = content.slice(offset, offset + chunkSize);
      const statements = lexer.feed(chunk);

      // EXACT REACT: Process each statement immediately
      for (const statement of statements) {
        try {
          // EXACT REACT: Classify and process
          const classification = dispatcher.classifyStatement(statement);

          // DEBUG: Log ALTER ROLE classification (only first few)
          if (statement.includes('ALTER') && statement.includes('ROLE') && processedStatements < 5) {
            console.log('[Worker] ALTER ROLE statement found:', {
              preview: statement.substring(0, 100),
              classified: classification ? classification.statementType : 'NOT CLASSIFIED',
              hasGrantRole: statement.includes('GRANT ROLE')
            });
          }

          if (classification) {
            const processedData = dispatcher.processStatement(classification);

            if (processedData) {
              // EXACT REACT: Categorize into result collections
              categorizeResult(processedData, results, viewRegistry, dispatcher, statement);
              processedStatements++;
            }
          }
        } catch (error: any) {
          // Only log first 10 errors to reduce console spam
          if (processedStatements < 10) {
            console.warn(`Error processing statement ${processedStatements + 1}:`, error.message);
          }
        }
      }

      processedChunks++;
      // Send progress updates EVERY 10 chunks to reduce overhead
      if (processedChunks % 10 === 0 || processedChunks === totalChunks) {
        const progress = 10 + (processedChunks / totalChunks) * 70;
        sendProgress(`Parsing VQL (${processedChunks}/${totalChunks}) - ${processedStatements} statements`, progress);
      }

      // CRITICAL: Yield to garbage collector every 20 chunks to prevent memory buildup
      if (processedChunks % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    console.log(`[Worker] Parsing complete: ${processedStatements} statements processed`);

    // Process final statements
    const finalStatements = lexer.finalize();
    for (const statement of finalStatements) {
      try {
        const classification = dispatcher.classifyStatement(statement);
        if (classification) {
          const processedData = dispatcher.processStatement(classification);
          if (processedData) {
            categorizeResult(processedData, results, viewRegistry, dispatcher, statement);
            processedStatements++;
          }
        }
      } catch (error: any) {
        console.warn(`Error processing final statement:`, error.message);
      }
    }

    sendProgress('Extracting server configuration...', 75);

    // Extract server configuration from the entire VQL content (SET statements)
    try {
      console.log('[Worker] Starting server config extraction...');
      const serverConfig = extractServerConfig(content, currentAnalysisId);
      console.log('[Worker] Server config extracted:', serverConfig);

      if (serverConfig) {
        // Parse the configuration to check how many settings were found
        let settingsCount = 0;
        try {
          const parsedConfig = JSON.parse(serverConfig.configuration);
          settingsCount = Object.keys(parsedConfig).length;
        } catch (e) {
          console.warn('[Worker] Could not parse configuration JSON');
        }

        results.server_configuration.push(serverConfig);
        console.log(`✅ [Worker] Extracted ${settingsCount} server configuration settings`);
      } else {
        console.warn('[Worker] No server configuration extracted');
      }
    } catch (error: any) {
      console.error('[Worker] Failed to extract server configuration:', error);
    }

    sendProgress('Finalizing...', 80);

    // Deduplicate databases (case-insensitive, keep the one with most data)
    const databaseMap = new Map<string, any>();
    results.databases.forEach((db: any) => {
      if (!db || !db.name || typeof db.name !== 'string') {
        return; // skip invalid entries
      }
      const key = db.name.toLowerCase();
      const existing = databaseMap.get(key);

      if (!existing) {
        databaseMap.set(key, db);
      } else {
        // Keep the entry that is NOT a system database (has CREATE statement)
        // or keep the one with more information
        if (existing.isSystemDatabase && !db.isSystemDatabase) {
          databaseMap.set(key, db);
        }
      }
    });
    results.databases = Array.from(databaseMap.values());

    // Deduplicate database-level cache configs: keep last occurrence per DB
    if (results.database_cache && Array.isArray(results.database_cache)) {
      const lastByDb = new Map<string, any>();
      results.database_cache.forEach((row) => {
        const key = (row.database || '').toLowerCase();
        if (key) lastByDb.set(key, row);
      });
      results.database_cache = Array.from(lastByDb.values());
    }

    // Send results back to main thread
    self.postMessage({
      type: 'result',
      success: true,
      results: results
    } as ResultMessage);

  } catch (error: any) {
    console.error('[Worker] Parse error:', error);
    self.postMessage({
      type: 'result',
      success: false,
      error: error.message || String(error)
    } as ResultMessage);
  }
};

/**
 * EXACT REACT: Categorize processed statement data into result collections
 */
function categorizeResult(processedData: any, results: any, viewRegistry: Map<string, any>, dispatcher: StatementDispatcher, originalStatement?: string) {
  const { statementType } = processedData;

  switch (statementType) {
    case 'DATABASE':
      results.databases.push(normalizeDatabase(processedData));
      break;

    case 'USE_DATABASE':
      // System database from CONNECT/USE
      results.databases.push(normalizeDatabase({
        name: processedData.name,
        type: 'system',
        isSystemDatabase: true,
        currentDatabase: processedData.name
      }));
      break;

    case 'VIEW':
    case 'INTERFACE_VIEW':
    case 'TABLE':
      // For INTERFACE_VIEW, extract implementation from the original statement
      if (processedData.statementType === 'INTERFACE_VIEW' && originalStatement) {
        // Try quoted implementation name first
        let implMatch = originalStatement.match(/SET\s+IMPLEMENTATION\s+"([^"]+)"/i);
        if (!implMatch) {
          // Try unquoted implementation name
          implMatch = originalStatement.match(/SET\s+IMPLEMENTATION\s+([^\s;()]+)/i);
        }

        if (implMatch) {
          processedData.implementation = implMatch[1].trim();
          // Store debug info in a special field to verify
          processedData._debug_impl = `Extracted: ${implMatch[1].trim()}`;
        } else {
          processedData._debug_impl = `No match in statement (len: ${originalStatement.length})`;
        }
      }

      results.views.push(normalizeView(processedData));

      // Register view for ALTER handling
      viewRegistry.set(processedData.name, {
        name: processedData.name,
        database: processedData.currentDatabase,
        statementType: processedData.statementType,
        hasCreateCache: processedData.cacheStatus && processedData.cacheStatus !== 'off'
      });

      // If CREATE has cache, add cache_data
      if (processedData.cacheStatus && processedData.cacheStatus !== 'off') {
        const cacheData = normalizeCacheData(processedData);
        if (cacheData) {
          results.cache_data.push(cacheData);
        }
      }
      break;

    case 'ALTER_DATABASE': {
      // Only record if cache is explicitly toggled
      const stmt = originalStatement || '';
      const cacheToggle = stmt.match(/CACHE\s+(ON|OFF)\b/i);
      if (!cacheToggle) break;

      const database = processedData.name || processedData.currentDatabase || null;
      if (!database) break;

      const enabled = cacheToggle[1].toUpperCase() === 'ON';
      const dsMatch = stmt.match(/DATASOURCE\s+(?:"([^"]+)"|([\w.-]+))/i);
      const datasource = dsMatch ? (dsMatch[1] || dsMatch[2] || '').trim() : null;
      const ttlMatch = stmt.match(/TIMETOLIVE\s+(NOEXPIRE|\d+)/i);
      const ttl = ttlMatch ? ttlMatch[1] : null;
      const mpMatch = stmt.match(/MAINTAINERPERIOD\s+(\d+)/i);
      const maintainer_period = mpMatch ? parseInt(mpMatch[1], 10) : null;

      if (!(results as any).database_cache) {
        (results as any).database_cache = [];
      }

      (results as any).database_cache.push({
        database,
        enabled,
        datasource,
        ttl,
        maintainer_period,
        raw: stmt
      });
      break;
    }
    case 'ALTER_VIEW':
      // Handle ALTER VIEW cache
      if (processedData.cacheStatus && processedData.cacheStatus !== 'off') {
        const registeredView = viewRegistry.get(processedData.name);
        if (registeredView && !registeredView.hasCreateCache) {
          const cacheData = normalizeCacheData({
            ...processedData,
            currentDatabase: registeredView.database,
            statementType: registeredView.statementType
          });
          if (cacheData) {
            results.cache_data.push(cacheData);
          }
        }
      }
      break;

    case 'DATASOURCE_JDBC':
    case 'DATASOURCE_CUSTOM':
    case 'DATASOURCE_DF':
    case 'DATASOURCE_JSON':
    case 'DATASOURCE_XML':
    case 'DATASOURCE_WS':
    case 'DATASOURCE_MONGODB':
    case 'DATASOURCE_SALESFORCE':
    case 'DATASOURCE_LDAP':
    case 'DATASOURCE_ODBC':
      // OPTIMIZED: Minimal debug logging (only first datasource)
      if (processedData.statementType === 'DATASOURCE_JDBC' && results.datasources.length === 0) {
        console.log('[Worker] First JDBC datasource:', {
          name: processedData.name,
          databaseName: processedData.databaseName,
          hasUrl: !!processedData.url
        });
      }

      const normalizedDatasource = normalizeDataSource(processedData);
      results.datasources.push(normalizedDatasource);
      break;

    case 'WRAPPER':
      results.wrappers.push(normalizeWrapper(processedData));
      break;

    case 'ASSOCIATION':
      results.associations.push(normalizeAssociation(processedData));
      break;

    case 'REST_WEBSERVICE':
    case 'SOAP_WEBSERVICE':
    case 'WEBSERVICE': {
      // Enrich with folder/resource/schema from original statement if missing
      if (originalStatement) {
        // Common: FOLDER
        if (!processedData.folder) {
          const f = originalStatement.match(/\bFOLDER\s*=\s*'([^']*)'/i);
          if (f) processedData.folder = f[1];
        }
        if (statementType === 'REST_WEBSERVICE') {
          if (!processedData.resourceName) {
            // Capture all VIEW <name> FIELDS occurrences (supports multiple resources per REST)
            const viewMatches = Array.from(
              originalStatement.matchAll(/\bVIEW\s+(?:\"([^\\"]+)\"|([A-Za-z0-9_.]+))\s+FIELDS\b/gi)
            ).map(m => (m[1] || m[2] || '').trim()).filter(Boolean);
            if (viewMatches.length > 0) {
              const uniqueViews = Array.from(new Set(viewMatches));
              processedData.resourceName = uniqueViews.join(', ');
            } else {
              // Fallback: first VIEW after RESOURCES block
              const resFirstView = originalStatement.match(/RESOURCES[\s\S]*?\bVIEW\s+(?:\"([^\\"]+)\"|([A-Za-z0-9_.]+))/i);
              if (resFirstView) {
                processedData.resourceName = (resFirstView[1] || resFirstView[2] || '').trim();
              }
            }
          }
        } else if (statementType === 'SOAP_WEBSERVICE') {
          if (!processedData.schemaName) {
            // Prefer OPERATION ... SCHEMA VIEW <name>; fallback to global scan
            const schemaScanOp = originalStatement.match(/\bOPERATION\b[\s\S]*?\bSCHEMA\s+VIEW\s+(?:"([^"]+)"|([A-Za-z0-9_.]+))/i);
            if (schemaScanOp) {
              processedData.schemaName = (schemaScanOp[1] || schemaScanOp[2] || '').trim();
            } else {
              const schemaScan = originalStatement.match(/\bSCHEMA\s+VIEW\s+(?:"([^"]+)"|([A-Za-z0-9_.]+))/i);
              if (schemaScan) processedData.schemaName = (schemaScan[1] || schemaScan[2] || '').trim();
            }
          }
        }
      }
      const normalizedWS = normalizeWebService(processedData);
      // Minimal debug: only first few entries
      if ((results.webservices?.length || 0) < 5) {
        console.log('[WS]', {
          stmtType: statementType,
          name: normalizedWS.name,
          type: normalizedWS.type,
          folder: normalizedWS.folder,
          resource: normalizedWS.resource_name,
          schema: normalizedWS.schema_name
        });
      }
      results.webservices.push(normalizedWS);
      break;
    }

    case 'RESOURCE_MANAGER_PLAN':
      results.resource_plans.push(normalizeResourcePlan(processedData));
      break;

    case 'RESOURCE_MANAGER_RULE':
      results.resource_rules.push(normalizeResourceRule(processedData));
      break;

    case 'USER':
    case 'ROLE':
    case 'LISTENER':
    case 'JAR':
    case 'MAP':
      results.global_elements.push(normalizeGlobalElement(processedData));
      break;

    case 'TAG':
      // Handle both single TAG and multiple TAGS
      if (originalStatement && originalStatement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?TAGS\s*\(/i)) {
        // Multiple tags - parse each one
        const tagsMatch = originalStatement.match(/TAGS\s*\(([^)]+)\)/i);
        if (tagsMatch) {
          const tagsList = tagsMatch[1];
          const tagItems = tagsList.split(',');

          tagItems.forEach(item => {
            const trimmedItem = item.trim();

            // Check if tag has description
            const tagWithDesc = trimmedItem.match(/(?:"([^"]+)"|(\w+))\s+DESCRIPTION\s*=\s*'([^']*)'/i);
            if (tagWithDesc) {
              results.global_elements.push(normalizeGlobalElement({
                type: processedData.statementType?.toLowerCase() || 'tag',
                name: tagWithDesc[1] || tagWithDesc[2],
                database: processedData.currentDatabase,
                description: tagWithDesc[3],
                tagType: 'multiple'
              }));
            } else {
              // Simple tag name - no description
              const nameMatch = trimmedItem.match(/(?:"([^"]+)"|(\w+))/);
              if (nameMatch) {
                results.global_elements.push(normalizeGlobalElement({
                  type: processedData.statementType?.toLowerCase() || 'tag',
                  name: nameMatch[1] || nameMatch[2],
                  database: processedData.currentDatabase,
                  description: null,
                  tagType: 'multiple'
                }));
              }
            }
          });
        }
      } else {
        // Single TAG
        results.global_elements.push(normalizeGlobalElement({
          ...processedData,
          tagType: 'single'
        }));
      }
      break;

    case 'viewstatsummary':
    case 'VIEWSTATSUMMARY':
      results.view_stats.push(normalizeViewStats(processedData));
      break;

    case 'ALTER_ROLE':
      const normalized = normalizeRoleModification(processedData);
      results.role_modifications.push(normalized);
      // Debug: Log first few ALTER_ROLE statements
      if (results.role_modifications.length <= 3) {
        console.log('[Worker] ALTER_ROLE processed:', {
          name: processedData.name,
          adminPrivileges: processedData.adminPrivileges,
          isAdmin: processedData.isAdmin,
          normalized
        });
      }
      break;
  }
}

/**
 * EXACT REACT NORMALIZATION FUNCTIONS - adapted for DuckDB schema
 */

function normalizeDatabase(data: any) {
  return {
    name: data.name || null,
    description: data.description || null,
    type: data.type || 'vdb',
    isSystemDatabase: data.isSystemDatabase || false
  };
}

function normalizeView(data: any) {
  return {
    name: data.name || null,
    database: data.currentDatabase || null,
    kind: data.kind || (data.statementType === 'INTERFACE_VIEW' ? 'interface view' : data.statementType === 'TABLE' ? 'table' : 'view'),
    folder: data.folder || null,
    implementation: data.implementation || null,
    selectBody: data.selectBody || null,  // CRITICAL: Include SELECT body for view complexity analysis
    cacheStatus: data.cacheStatus || null
  };
}

function normalizeDataSource(data: any) {
  // Use type from grammar extraction (already set correctly)
  // Fallback to statement type mapping only if type not set
  const finalType = data.type || (() => {
    const typeMapping: { [key: string]: string } = {
      'DATASOURCE_JDBC': 'JDBC',
      'DATASOURCE_CUSTOM': 'Custom',
      'DATASOURCE_DF': 'DelimitedFile',
      'DATASOURCE_JSON': 'JSON',
      'DATASOURCE_XML': 'XML',
      'DATASOURCE_WS': 'SOAP',  // WS datasources are SOAP type
      'DATASOURCE_MONGODB': 'MongoDB',
      'DATASOURCE_SALESFORCE': 'Salesforce',
      'DATASOURCE_LDAP': 'LDAP',
      'DATASOURCE_ODBC': 'ODBC'
    };
    return typeMapping[data.statementType] || 'JDBC';
  })();

  // Extract URL from various possible sources
  let urlValue = data.url || data.databaseUri || null;

  // If we have a JDBC type but no URL extracted, check the raw statement for property references
  if (!urlValue && finalType === 'JDBC' && data.rawStatement) {
    // Try to extract DATABASEURI property reference pattern: ${config.PROPERTY.xyz}
    const propertyRefMatch = data.rawStatement.match(/DATABASEURI\s*=\s*'(\$\{[^}]+\})'/i);
    if (propertyRefMatch) {
      urlValue = propertyRefMatch[1]; // Store the property reference
    }
  }

  return {
    name: data.name || null,
    database: data.currentDatabase || null,
    type: finalType,
    folder: data.folder || null,
    // CRITICAL: Include all extracted datasource fields (camelCase - batchInsert converts to snake_case)
    // Use databaseUri as fallback, and extract property references if needed
    url: urlValue,
    driver: data.driver || null,
    databaseName: data.databaseName || null,
    databaseVersion: data.databaseVersion || null,
    username: data.username || null,
    classpath: data.classpath || null,
    vendor: data.vendor || null,
    className: data.className || null,
    routeType: data.routeType || null,
    routeConnection: data.routeConnection || null,
    wsdlLocation: data.wsdlLocation || null,
    endpoint: data.endpoint || null,
    dsn: data.dsn || null,
    serverName: data.serverName || null,
    webServiceType: data.webServiceType || null
  };
}

function normalizeWrapper(data: any) {
  return {
    name: data.name || null,
    database: data.currentDatabase || null,
    wrapperType: data.wrapperType || data.type || 'CUSTOM',
    dataSourceName: data.dataSourceName || data.datasourceName || null,
    folder: data.folder || null,
    // NEW FIELDS from WrapperParser extractors
    parametersContent: data.parametersContent || null,
    streamTuplesConfig: data.streamTuplesConfig || null,
    parameters: data.parameters || null,
    isExcelWrapper: data.isExcelWrapper || false,
    typeOfFile: data.typeOfFile || null
  };
}

function normalizeAssociation(data: any) {
  // The dispatcher should have already extracted mapping as object with parsedMappings
  // If it's still a string, the custom processor didn't run properly, so parse it
  let mappingJson = null;
  if (data.mapping) {
    if (typeof data.mapping === 'string') {
      // Fallback: Parse "col1=col2 AND col3=col4" into JSON array
      const mappings = data.mapping.split(/\s+AND\s+/i).map((pair: string) => {
        const [left, right] = pair.split('=').map((s: string) => s.trim());
        return { leftColumn: left, rightColumn: right };
      });
      mappingJson = { parsedMappings: mappings, rawMapping: data.mapping };
    } else {
      // Already an object from custom processor
      mappingJson = data.mapping;
    }
  }

  return {
    name: data.name || null,
    database: data.currentDatabase || null,
    kind: data.kind || 'association',
    folder: data.folder || null,
    endpoints: data.endpoints || null,
    mapping: mappingJson
  };
}

function normalizeWebService(data: any) {
  return {
    name: data.name || null,
    database: data.currentDatabase || null,
    type: data.statementType === 'SOAP_WEBSERVICE' ? 'SOAP' : 'REST',
    folder: data.folder || null,
    // Pass through extracted fields (if present)
    resource_name: data.resourceName || null,
    schema_name: data.schemaName || null
  };
}

function normalizeGlobalElement(data: any) {
  return {
    name: data.name || null,
    database: data.currentDatabase || null,
    type: data.statementType?.toLowerCase() || data.type || 'unknown',
    folder: data.folder || null,
    // User/Role specific fields
    authType: data.authType || null,
    userType: data.userType || null,
    ldapDatasource: data.ldapDatasource || null,
    ldapUsername: data.ldapUsername || null,
    description: data.description || null,
    privileges: data.privileges || null,
    roleType: data.roleType || null,
    adminPrivileges: data.adminPrivileges || null,
    // JAR specific fields
    filePath: data.filePath || null,
    fileName: data.fileName || null,
    fileType: data.fileType || null,
    version: data.version || null,
    // TAG/MAP specific fields
    tagType: data.tagType || null,
    mapType: data.mapType || null,
    country: data.country || null,
    timezone: data.timezone || null
  };
}

function normalizeCacheData(data: any) {
  // DuckDB schema requires database NOT NULL, so filter out entries without database
  if (!data.currentDatabase) {
    return null;
  }

  return {
    name: data.name || null,  // DuckDB schema uses 'name' not 'viewName'
    database: data.currentDatabase,
    cache_status: data.cacheStatus || null,
    cache_type: data.cacheStatus || null,
    ttl: data.ttl || null
  };
}

function normalizeViewStats(data: any) {
  return {
    view_name: data.viewName || data.name || null,  // DuckDB schema uses 'view_name'
    database: data.currentDatabase || null,
    enabled: true
  };
}

function normalizeRoleModification(data: any) {
  return {
    analysis_id: currentAnalysisId,
    name: data.name || null,
    granted_roles: data.grantedRoles ? JSON.stringify(data.grantedRoles) : null,
    admin_privileges: data.adminPrivileges ? JSON.stringify(data.adminPrivileges) : null,
    is_admin: data.isAdmin || false
  };
}

function normalizeResourcePlan(data: any) {
  return {
    name: data.name || null,
    type: data.type || 'resource_plan',
    database: data.currentDatabase || null,
    description: data.description || null,
    condition: data.condition || null,
    action: data.action || null,
    parameters: data.parameters || null,  // Keep as object, batchInsert will stringify
    full_definition: data.fullDefinition || null
  };
}

function normalizeResourceRule(data: any) {
  return {
    name: data.name || null,
    type: data.type || 'resource_rule',
    database: data.currentDatabase || null,
    description: data.description || null,
    condition: data.condition || null,
    plan: data.plan || null,
    priority: data.priority || null,
    full_definition: data.fullDefinition || null
  };
}

/**
 * Extract server configuration from VQL content (SET statements)
 * Adapted from ServerConfigParser
 */
function extractServerConfig(content: string, analysisId: string): any {
  const configSettings: any = {};

  // Configuration mapping (same as ServerConfigParser)
  const configMap: { [key: string]: string } = {
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
    'com.denodo.vdb.misc.I18nParametersManager.i18nDefault': 'i18nDefault',
    'java.env.DENODO_OPTS_START': 'jvmOptions',
    // Connection settings
    'com.denodo.vdb.engine.thread.ThreadPool.maxThreads': 'maxThreads',
    'com.denodo.vdb.misc.datasource.JDBCDataSource.pool.maxActive': 'jdbcMaxActive',
    // VCS settings
    'com.denodo.vdb.vdbinterface.server.vcs.VCSConfigurationManager.useVCS': 'useVCS',
    'com.denodo.vdb.vdbinterface.server.vcs.VCSConfigurationManager.system': 'vcsSystem',
    'com.denodo.vdb.vdbinterface.server.vcs.VCSConfigurationManager.url': 'vcsUrl',
    // SSO settings
    'sso.token-enabled': 'ssoTokenEnabled',
    'sso.url': 'ssoUrl'
  };

  // WEBCONTAINER configuration mapping
  const webContainerConfigMap: { [key: string]: string } = {
    'com.denodo.tomcat.http.port': 'tomcatPort',
    'java.env.DENODO_OPTS_START': 'tomcatJvmOptions'
  };

  // Extract SET statements
  const setPattern = /SET\s+'([^']+)'\s*=\s*'([^']*)'/gi;
  const setMatches = [...content.matchAll(setPattern)];

  setMatches.forEach(match => {
    const [, property, value] = match;
    const mappedKey = configMap[property];

    if (mappedKey) {
      configSettings[mappedKey] = value; // Keep as string, will be resolved later with properties
    }
  });

  // Extract ALTER DATABASE SET statements
  const alterPattern = /ALTER\s+DATABASE\s+[^;]*SET\s+'([^']+)'\s*=\s*'([^']*)'/gi;
  const alterMatches = [...content.matchAll(alterPattern)];

  alterMatches.forEach(match => {
    const [, property, value] = match;
    const mappedKey = configMap[property];

    if (mappedKey) {
      configSettings[mappedKey] = value;
    }
  });

  // Extract WEBCONTAINER SET statements
  const webContainerPattern = /WEBCONTAINER\s+SET\s+'([^']+)'\s*=\s*'([^']*)'/gi;
  const webContainerMatches = [...content.matchAll(webContainerPattern)];

  console.log(`🔍 [Worker] Found ${webContainerMatches.length} WEBCONTAINER SET statements`);

  webContainerMatches.forEach(match => {
    const [, property, value] = match;
    const mappedKey = webContainerConfigMap[property];

    if (mappedKey) {
      console.log(`✅ [Worker] WEBCONTAINER ${property} -> ${mappedKey}: ${value}`);
      configSettings[mappedKey] = value; // Keep as string, will be resolved later with properties
    } else {
      console.log(`❌ [Worker] WEBCONTAINER ${property} NOT MAPPED`);
    }
  });

  console.log('📦 [Worker] Final config - tomcatPort:', configSettings.tomcatPort);
  console.log('📦 [Worker] Final config - tomcatJvmOptions:', configSettings.tomcatJvmOptions);

  // Return in the format expected by batchInsert (configuration as JSON string)
  // Don't include timestamp - let DuckDB use CURRENT_TIMESTAMP default
  return {
    analysis_id: analysisId,
    configuration: JSON.stringify(configSettings) // Store as JSON string
  };
}

export {};
