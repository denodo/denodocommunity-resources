// Parser System Export - Complete VQL Parsing System
// TypeScript version with DuckDB integration and modular grammar

// Core parser exports
export { BaseParser } from './base-parser';
export { StatementDispatcher } from './statement-dispatcher';
export { ParserRegistry } from './parser-registry';

// Specialized parser exports - all 12 exact ports
export { DatabaseParser } from './specialized/database-parser';
export { ViewParser } from './specialized/view-parser';
export { DataSourceParser } from './specialized/datasource-parser';
export { WrapperParser } from './specialized/wrapper-parser';
export { SecurityParser } from './specialized/security-parser';
export { ResourceParser } from './specialized/resource-parser';
export { AssociationParser } from './specialized/association-parser';
export { GlobalElementsParser } from './specialized/global-elements-parser';
export { WebServiceParser } from './specialized/webservice-parser';
export { default as ServerConfigParser } from './specialized/server-config-parser';

// Type exports
export type { ParseResult, MatchData, ExtractedData } from './base-parser';
export type { DispatchResult, StatementMatcher, StatementTypeInfo } from './statement-dispatcher';
export type { ParserInfo, ParseStats } from './parser-registry';
export type { DatabaseData } from './specialized/database-parser';
export type { ViewData } from './specialized/view-parser';
export type { DataSourceData } from './specialized/datasource-parser';
export type { WrapperData } from './specialized/wrapper-parser';
export type { SecurityData } from './specialized/security-parser';
export type { ResourceData } from './specialized/resource-parser';
export type { AssociationData } from './specialized/association-parser';
export type { GlobalElementData } from './specialized/global-elements-parser';
export type { WebServiceData } from './specialized/webservice-parser';
export type { ServerConfigData } from './specialized/server-config-parser';

/**
 * VQL Parser System Overview:
 *
 * This system provides comprehensive VQL statement parsing with:
 *
 * 🔧 Core Components:
 * - BaseParser: Abstract base class for all parsers
 * - StatementDispatcher: Routes statements to appropriate parsers
 * - ParserRegistry: Manages all parsers and coordinates parsing
 *
 * 📦 Specialized Parsers:
 * - DatabaseParser: DATABASE, USE_DATABASE, ALTER_DATABASE
 * - ViewParser: VIEW, INTERFACE_VIEW, TABLE, ALTER_VIEW
 * - DataSourceParser: All 10 DATASOURCE types
 * - WrapperParser: WRAPPER, REST_WEBSERVICE
 * - SecurityParser: USER, ROLE, ALTER_ROLE
 * - ResourceParser: JAR, ASSOCIATION, VIEWSTATSUMMARY, etc.
 *
 * 🎯 Key Features:
 * - TypeScript with full type safety
 * - DuckDB WASM integration for data storage
 * - Modular grammar system (6 grammar packs)
 * - Support for all 29 VQL statement types
 * - Context-aware parsing (database context tracking)
 * - Comprehensive error handling and logging
 *
 * Usage:
 * ```typescript
 * import { ParserRegistry } from './lib/parsers';
 * import { DuckDBClient } from './lib/database/duckdb-client';
 *
 * const duckdb = new DuckDBClient();
 * await duckdb.initialize();
 *
 * const registry = new ParserRegistry(duckdb);
 * const results = await registry.parseContent(vqlContent, 'my-file.vql');
 * ```
 */