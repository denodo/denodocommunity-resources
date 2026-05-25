/**
 * Services Export - Complete Service Layer for Next.js + DuckDB
 * TypeScript versions with DuckDB WASM integration
 */

// Core Analysis Service
export { AnalysisService } from './analysis-service';
export type {
  AnalysisResults,
  AnalysisStats,
  DatabaseWithData,
  DatabaseMetrics,
  ViewsByType,
  ViewsByCache,
  InterfaceViewMapping,
  FileUpload,
  ProgressCallback
} from './analysis-service';

// Data Source Analytics Service
export { DataSourceAnalyticsService } from './datasource-analytics-service';
export type {
  DataSourceAnalytics,
  TechnologyData,
  ConnectionData,
  DetailData,
  WrapperReference,
  SummaryStats,
  TopTechnology,
  TechnologyTab,
  SubTechnologyTab,
  ColumnConfig,
  WrapperAnalytics,
  ExcelWrapperStats,
  DatabaseWithSources
} from './datasource-analytics-service';

// Duplicate Detection Service
export { DuplicateDetectionService } from './duplicate-detection-service';
export type {
  DuplicateConnection,
  ConnectionReference,
  ConnectionDetails,
  DuplicateAnalysisResult,
  DuplicatesByType,
  ConnectionMap,
  DuplicateStats
} from './duplicate-detection-service';

// Excel Wrapper Query Service
export { ExcelWrapperQueryService } from './excel-wrapper-query-service';
export type {
  ExcelWrapperResult,
  ExcelWrapper,
  StreamTuplesStats,
  DetailedStats,
  DisabledWrapper,
  StreamTuplesConfig,
  StreamTuplesAnalysisResult
} from './excel-wrapper-query-service';

/**
 * Service Layer Overview:
 *
 * This service layer provides comprehensive business logic for the Denodo Metadata Analyzer,
 * migrated from React + IndexedDB to Next.js + DuckDB WASM architecture.
 *
 * 🔧 Core Services:
 * - AnalysisService: Main orchestration, file processing, and data analysis
 * - DataSourceAnalyticsService: Technology breakdown and analytics
 * - DuplicateDetectionService: Advanced duplicate connection detection
 * - ExcelWrapperQueryService: Excel wrapper analysis and stream tuples
 *
 * 🎯 Key Features:
 * - TypeScript with full type safety
 * - DuckDB WASM integration for data storage and queries
 * - Web Worker support with Comlink for background processing
 * - Exact functionality parity with original React implementation
 * - Advanced duplicate detection with sophisticated normalization
 * - Comprehensive Excel wrapper stream tuples analysis
 *
 * Usage:
 * ```typescript
 * import { AnalysisService, DuckDBClient } from '@/lib';
 *
 * const duckdb = new DuckDBClient();
 * await duckdb.initialize();
 *
 * const analysisService = new AnalysisService(duckdb);
 * await analysisService.initialize();
 *
 * const results = await analysisService.analyzeFiles({ vqlFile, propertiesFile });
 * ```
 */