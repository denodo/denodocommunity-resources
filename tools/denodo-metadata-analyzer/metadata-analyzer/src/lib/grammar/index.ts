// Grammar System Export - Modular Grammar for Denodo VQL Parsing
// Replaces the monolithic grammar-config.js with 6 modular packs

// Core exports
export { grammarRegistry, getGrammarConfig, getGrammarMetadata, validateGrammarCoverage } from './grammar-registry';
export { default as validateGrammarMigration } from './validate-migration';

// Individual pack exports
export { DatabasePack } from './packs/database-pack';
export { ViewsPack } from './packs/views-pack';
export { DataSourcesPack } from './packs/datasources-pack';
export { WrappersPack } from './packs/wrappers-pack';
export { WebServicePack } from './packs/webservice-pack';
export { SecurityPack } from './packs/security-pack';
export { ResourcesPack } from './packs/resources-pack';

// Type exports
export type { GrammarConfig, GrammarPack, StatementConfig, StatementExtractor } from '../../types/grammar';

/**
 * Modular Grammar System Overview:
 *
 * This system replaces the monolithic 2101-line grammar-config.js with 6 modular packs:
 *
 * 1. 📦 DatabasePack (3 statements)
 *    - DATABASE, USE_DATABASE, ALTER_DATABASE
 *    - Database context management
 *
 * 2. 📦 ViewsPack (4 statements)
 *    - VIEW, INTERFACE_VIEW, TABLE, ALTER_VIEW
 *    - View parsing with cache analysis and SELECT body extraction
 *
 * 3. 📦 DataSourcesPack (10 statements)
 *    - All DATASOURCE types: JDBC, CUSTOM, DF, JSON, XML, WS, MONGODB, SALESFORCE, LDAP, ODBC
 *    - Complex vendor detection and parameter extraction
 *
 * 4. 📦 WrappersPack (2 statements)
 *    - WRAPPER, REST_WEBSERVICE
 *    - Excel wrapper detection and parameter parsing
 *
 * 5. 📦 SecurityPack (3 statements)
 *    - USER, ROLE, ALTER_ROLE
 *    - LDAP vs VDP user detection, admin role analysis
 *
 * 6. 📦 ResourcesPack (7 statements)
 *    - JAR, ASSOCIATION, VIEWSTATSUMMARY, RESOURCE_MANAGER_PLAN, RESOURCE_MANAGER_RULE, MAP, TAG
 *    - Resource management and utility statements
 *
 * Total Coverage: 29 statement types, 36+ processors, 2100+ grammar rules
 *
 * Usage:
 * ```typescript
 * import { getGrammarConfig } from './lib/grammar';
 * const config = getGrammarConfig(); // Returns unified config compatible with existing parsers
 * ```
 */