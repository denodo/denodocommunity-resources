/**
 * Main Library Export - Complete Next.js + DuckDB WASM System
 * TypeScript migration from React + IndexedDB architecture
 */

// Database Layer
export * from './database';

// Grammar System
export * from './grammar';

// Parser System
export * from './parsers';

// Service Layer
export * from './services';

// Type Definitions
export * from '../types';

/**
 * Next.js + DuckDB WASM System Overview:
 *
 * This library provides a complete VQL (Virtual Query Language) metadata analysis system
 * migrated from React + IndexedDB to Next.js + DuckDB WASM architecture.
 *
 * 🔧 Core Components:
 * - Database Layer: DuckDB WASM client with 17 optimized tables
 * - Grammar System: Modular grammar packs (6 packs, 29 statement types)
 * - Parser System: Complete VQL parser with 12 specialized parsers
 * - Service Layer: Business logic services with exact React functionality
 *
 * 🎯 Key Features:
 * - TypeScript with full type safety and IntelliSense
 * - DuckDB WASM for browser-based SQL analytics
 * - Web Workers with Comlink for background processing
 * - Context-aware parsing with database state management
 * - Advanced duplicate detection and analytics
 * - Comprehensive Excel wrapper stream tuples analysis
 * - Professional PDF reporting with jsPDF integration
 *
 * 📊 Supported Statement Types:
 * All 29 VQL statement types including DATABASE, VIEW, DATASOURCE (10 types),
 * WRAPPER, WEBSERVICE, SECURITY, ASSOCIATIONS, and GLOBAL ELEMENTS.
 *
 * Usage:
 * ```typescript
 * import { DuckDBClient, AnalysisService, ParserRegistry } from '@/lib';
 *
 * // Initialize DuckDB
 * const duckdb = new DuckDBClient();
 * await duckdb.initialize();
 *
 * // Initialize Analysis Service
 * const analysisService = new AnalysisService(duckdb);
 * await analysisService.initialize();
 *
 * // Analyze VQL files
 * const results = await analysisService.analyzeFiles({
 *   vqlFile: file,
 *   propertiesFile: propsFile
 * });
 * ```
 */