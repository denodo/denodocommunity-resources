// Grammar Registry - Combines all modular grammar packs
// Replaces the monolithic grammar-config.js with modular system

import type { GrammarConfig, GrammarPack } from '../../types/grammar';
import { DatabasePack } from './packs/database-pack';
import { ViewsPack } from './packs/views-pack';
import { DataSourcesPack } from './packs/datasources-pack';
import { WrappersPack } from './packs/wrappers-pack';
import { WebServicePack } from './packs/webservice-pack';
import { SecurityPack } from './packs/security-pack';
import { ResourcesPack } from './packs/resources-pack';

/**
 * Grammar Registry - Combines all grammar packs into a unified configuration
 * Maintains compatibility with the existing parser while providing modular organization
 */
class GrammarRegistry {
  private packs: GrammarPack[] = [];
  private compiledConfig: GrammarConfig | null = null;

  constructor() {
    this.loadAllPacks();
  }

  private loadAllPacks(): void {
    this.packs = [
      DatabasePack,     // DATABASE, USE_DATABASE, ALTER_DATABASE
      ViewsPack,        // VIEW, INTERFACE_VIEW, TABLE, ALTER_VIEW
      DataSourcesPack,  // All 10 DATASOURCE types
      WrappersPack,     // WRAPPER
      WebServicePack,   // REST_WEBSERVICE, SOAP_WEBSERVICE, WEBSERVICE
      SecurityPack,     // USER, ROLE, ALTER_ROLE
      ResourcesPack     // JAR, ASSOCIATION, VIEWSTATSUMMARY, RESOURCE_MANAGER_PLAN/RULE, MAP, TAG
    ];
  }

  /**
   * Compile all grammar packs into a unified configuration
   * This creates a single config compatible with existing parsers
   */
  public compile(): GrammarConfig {
    if (this.compiledConfig) {
      return this.compiledConfig;
    }

    const config: GrammarConfig = {
      version: "modular-v1.0.0",
      description: "Modular Grammar Configuration - All 29 statement types from 6 packs",
      statements: {},
      processors: {}
    };

    // Combine statements from all packs
    for (const pack of this.packs) {
      Object.assign(config.statements, pack.statements);
      if (pack.processors) {
        Object.assign(config.processors, pack.processors);
      }
    }

    this.compiledConfig = config;
    return config;
  }

  /**
   * Get a specific grammar pack by name
   */
  public getPack(name: string): GrammarPack | undefined {
    return this.packs.find(pack => pack.name === name);
  }

  /**
   * Get all loaded packs
   */
  public getAllPacks(): GrammarPack[] {
    return [...this.packs];
  }

  /**
   * Get metadata about the grammar registry
   */
  public getMetadata() {
    const config = this.compile();
    const statementTypes = Object.keys(config.statements);
    const processorCount = Object.keys(config.processors).length;

    return {
      totalPacks: this.packs.length,
      totalStatementTypes: statementTypes.length,
      totalProcessors: processorCount,
      statementTypes,
      packs: this.packs.map(pack => ({
        name: pack.name,
        version: pack.version,
        description: pack.description,
        statementCount: Object.keys(pack.statements).length,
        processorCount: pack.processors ? Object.keys(pack.processors).length : 0
      }))
    };
  }

  /**
   * Validate that all expected statement types are present
   */
  public validateCoverage(): {
    isComplete: boolean;
    covered: string[];
    missing: string[];
    total: number;
  } {
    const expectedStatements = [
      // Database (3)
      'DATABASE', 'USE_DATABASE', 'ALTER_DATABASE',
      // Views (4)
      'VIEW', 'INTERFACE_VIEW', 'TABLE', 'ALTER_VIEW',
      // DataSources (10)
      'DATASOURCE_JDBC', 'DATASOURCE_CUSTOM', 'DATASOURCE_DF', 'DATASOURCE_JSON',
      'DATASOURCE_XML', 'DATASOURCE_WS', 'DATASOURCE_MONGODB', 'DATASOURCE_SALESFORCE',
      'DATASOURCE_LDAP', 'DATASOURCE_ODBC',
      // Wrappers (2)
      'WRAPPER', 'REST_WEBSERVICE',
      // Security (3)
      'USER', 'ROLE', 'ALTER_ROLE',
      // Resources (7)
      'JAR', 'ASSOCIATION', 'VIEWSTATSUMMARY', 'RESOURCE_MANAGER_PLAN',
      'RESOURCE_MANAGER_RULE', 'MAP', 'TAG'
    ];

    const config = this.compile();
    const covered = Object.keys(config.statements);
    const missing = expectedStatements.filter(stmt => !covered.includes(stmt));

    return {
      isComplete: missing.length === 0,
      covered,
      missing,
      total: expectedStatements.length
    };
  }
}

// Export singleton instance
export const grammarRegistry = new GrammarRegistry();

// Export the compiled configuration for backward compatibility
export function getGrammarConfig(): GrammarConfig {
  return grammarRegistry.compile();
}

// Export metadata for debugging/monitoring
export function getGrammarMetadata() {
  return grammarRegistry.getMetadata();
}

// Export coverage validation
export function validateGrammarCoverage() {
  return grammarRegistry.validateCoverage();
}