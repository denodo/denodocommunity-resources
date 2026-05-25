// TypeScript types for the EXISTING grammar-config.js structure

export interface StatementExtractor {
  type?: string;
  pattern?: string;
  group?: number;
  fallbackGroup?: number | number[];
  fallbackGroup2?: number;
  processor?: string;
  required?: boolean;
  value?: string;
  keys?: string[];
  conditions?: Array<{ pattern?: string; value?: string }>;
  default?: any;
}

export interface StatementNormalization {
  table: string;
  map: { [key: string]: string };
}

export interface StatementConfig {
  patterns: string[];
  extractors: { [key: string]: StatementExtractor };
  normalize?: StatementNormalization;
  contextChange?: boolean;
}

export interface GrammarConfig {
  version: string;
  description: string;
  statements: { [key: string]: StatementConfig };
  processors: { [key: string]: (...args: any[]) => any };
}

export interface PatternConfig {
  createOrReplace: string;
  quotedIdentifier: string;
  keyValue: (keys: string[]) => string;
  databaseContext: string;
  prefixes: { [key: string]: string };
}

export interface GrammarPack {
  name: string;
  version: string;
  description: string;
  statements: { [key: string]: StatementConfig };
  processors?: { [key: string]: (...args: any[]) => any };
  patterns?: Partial<PatternConfig>;
}