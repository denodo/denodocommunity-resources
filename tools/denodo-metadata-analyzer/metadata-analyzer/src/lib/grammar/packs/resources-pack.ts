// Resources Grammar Pack - Ported from existing grammar-config.js
// Contains: JAR, ASSOCIATION, VIEWSTATSUMMARY, RESOURCE_MANAGER_PLAN, RESOURCE_MANAGER_RULE, MAP, TAG

import type { GrammarPack } from '../../../types/grammar';

const PATTERNS = {
  quotedIdentifier: '(?:"([^"]+)"|([\\w.-]+))',
  prefixes: {
    association: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?ASSOCIATION\\s+',
    viewStatsummary: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?VIEWSTATSUMMARY\\s+',
    map: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?MAP\\s+'
  }
};

export const ResourcesPack: GrammarPack = {
  name: 'resources',
  version: '1.0.0',
  description: 'Resource and utility statements - JAR, ASSOCIATION, VIEWSTATSUMMARY, RESOURCE_MANAGER_PLAN/RULE, MAP, TAG',

  statements: {
    JAR: {
      patterns: [
        "CREATE\\s+(?:OR\\s+REPLACE\\s+)?JAR\\s+(\\w+)",
        "CREATE\\s+(?:OR\\s+REPLACE\\s+)?JAR\\s+\"([^\"]+)\"",
        "CREATE\\s+(?:OR\\s+REPLACE\\s+)?JAR\\s+'([^']+)'"
      ],
      extractors: {
        name: {
          group: 1,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "jar" },
        filePath: {
          type: "customProcessor",
          processor: "extractJarFilePath"
        },
        fileName: {
          type: "customProcessor",
          processor: "extractJarFileName"
        },
        fileType: {
          type: "customProcessor",
          processor: "extractJarFileType"
        },
        version: {
          type: "customProcessor",
          processor: "extractJarVersion"
        },
        description: {
          type: "customProcessor",
          processor: "extractJarDescription"
        }
      },
      normalize: {
        table: "global_elements",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          filePath: "$filePath",
          fileName: "$fileName",
          fileType: "$fileType",
          version: "$version",
          description: "$description"
        }
      }
    },

    ASSOCIATION: {
      patterns: [PATTERNS.prefixes.association + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.association,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        kind: { value: "association" },
        folder: {
          type: "regex",
          pattern: "FOLDER\\s*=\\s*'([^']*)'",
          group: 1,
          processor: "sanitizeQuoted"
        },
        endpoints: {
          type: "customProcessor",
          processor: "extractAssociationEndpoints"
        },
        mapping: {
          type: "customProcessor",
          processor: "extractAssociationMapping"
        }
      },
      normalize: {
        table: "associations",
        map: {
          name: "$name",
          kind: "$kind",
          folder: "$folder",
          endpoints: "$endpoints",
          mapping: "$mapping",
          database: "$currentDatabase"
        }
      }
    },

    VIEWSTATSUMMARY: {
      patterns: [PATTERNS.prefixes.viewStatsummary + PATTERNS.quotedIdentifier],
      extractors: {
        viewName: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.viewStatsummary,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        enabled: {
          type: "customProcessor",
          processor: "extractStatsEnabled"
        },
        statementType: { value: "viewstatsummary" }
      },
      normalize: {
        table: "view_stats",
        map: {
          viewName: "$viewName",
          enabled: "$enabled",
          statementType: "$statementType",
          database: "$currentDatabase"
        }
      }
    },

    RESOURCE_MANAGER_PLAN: {
      patterns: [
        'CREATE\\s+(?:OR\\s+REPLACE\\s+)?RESOURCE_MANAGER\\s+PLAN\\s+(?:"([^"]+)"|([\\w\\d_.-]+))'
      ],
      extractors: {
        name: {
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "resource_plan" },
        description: {
          type: "customProcessor",
          processor: "extractResourcePlanDescription"
        },
        condition: {
          type: "customProcessor",
          processor: "extractResourcePlanCondition"
        },
        action: {
          type: "customProcessor",
          processor: "extractResourcePlanAction"
        },
        parameters: {
          type: "customProcessor",
          processor: "extractResourcePlanParameters"
        },
        fullDefinition: {
          type: "customProcessor",
          processor: "getFullStatement"
        }
      },
      normalize: {
        table: "resource_plans",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          description: "$description",
          condition: "$condition",
          action: "$action",
          parameters: "$parameters",
          fullDefinition: "$fullDefinition"
        }
      }
    },

    RESOURCE_MANAGER_RULE: {
      patterns: [
        'CREATE\\s+(?:OR\\s+REPLACE\\s+)?RESOURCE_MANAGER\\s+RULE\\s+(?:"([^"]+)"|([\\w\\d_.-]+))'
      ],
      extractors: {
        name: {
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "resource_rule" },
        description: {
          type: "customProcessor",
          processor: "extractResourceRuleDescription"
        },
        condition: {
          type: "customProcessor",
          processor: "extractResourceRuleCondition"
        },
        plan: {
          type: "customProcessor",
          processor: "extractResourceRulePlan"
        },
        priority: {
          type: "customProcessor",
          processor: "extractResourceRulePriority"
        },
        fullDefinition: {
          type: "customProcessor",
          processor: "getFullStatement"
        }
      },
      normalize: {
        table: "resource_rules",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          description: "$description",
          condition: "$condition",
          plan: "$plan",
          priority: "$priority",
          fullDefinition: "$fullDefinition"
        }
      }
    },

    MAP: {
      patterns: [PATTERNS.prefixes.map + 'i18n\\s+' + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "map" },
        mapType: { value: "i18n" },
        country: {
          type: "customProcessor",
          processor: "extractMapCountry"
        },
        timezone: {
          type: "customProcessor",
          processor: "extractMapTimezone"
        },
        fullDefinition: {
          type: "customProcessor",
          processor: "getFullStatement"
        }
      },
      normalize: {
        table: "global_elements",
        map: {
          name: "$name",
          type: "$type",
          mapType: "$mapType",
          database: "$currentDatabase",
          country: "$country",
          timezone: "$timezone"
        }
      }
    },

    TAG: {
      patterns: [
        // Multi-tag syntax: CREATE OR REPLACE TAGS (tag1, tag2, tag3 DESCRIPTION = 'desc', tag4);
        "CREATE\\s+(?:OR\\s+REPLACE\\s+)?TAGS\\s*\\(",
        // Individual tag syntax: CREATE OR REPLACE TAG tagname
        "CREATE\\s+(?:OR\\s+REPLACE\\s+)?TAG\\s+(?:\"([^\"]+)\"|([\\w\\d_.-]+))"
      ],
      extractors: {
        name: {
          type: "customProcessor",
          processor: "extractTagName",
          required: true
        },
        tagType: {
          type: "customProcessor",
          processor: "extractTagType"
        },
        type: { value: "tag" },
        description: {
          type: "customProcessor",
          processor: "extractTagDescription"
        }
      },
      normalize: {
        table: "global_elements",
        map: {
          name: "$name",
          tagType: "$tagType",
          type: "$type",
          database: "$currentDatabase",
          description: "$description"
        }
      }
    }
  },

  processors: {
    sanitizeIdentifier: (value: any) => {
      if (!value || typeof value !== 'string') return value;
      return value.replace(/\bOR\s+REPLACE\b/gi, '').replace(/^"([\s\S]*?)"$/, '$1').trim();
    },

    sanitizeQuoted: (value: any) => {
      if (!value || typeof value !== 'string') return value;
      return value.replace(/^['"]|['"]$/g, '');
    },

    extractAssociationEndpoints: (statement: string) => {
      if (!statement || typeof statement !== 'string') return [];

      const endpoints = [];
      // Extract ENDPOINT lines - each defines table relationships
      // Handle both quoted and unquoted identifiers: ENDPOINT "alias" table_name or ENDPOINT alias table_name
      const endpointRegex = /ENDPOINT\s+(?:"([^"]+)"|(\w+))\s+(\w+)\s+(PRINCIPAL\s+)?\(([^)]+)\)/gi;
      let match;

      while ((match = endpointRegex.exec(statement)) !== null) {
        const alias = match[1] || match[2]; // quoted or unquoted alias
        const table = match[3];
        const isPrincipal = !!match[4]; // PRINCIPAL keyword captured
        const cardinality = match[5].trim();

        endpoints.push({
          alias: alias,
          table: table,
          cardinality: cardinality,
          isPrincipal: isPrincipal
        });
      }

      return endpoints;
    },

    extractAssociationMapping: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;

      // Extract ADD MAPPING clause - defines column relationships
      const mappingMatch = statement.match(/ADD\s+MAPPING\s+([^;]+)/i);
      if (mappingMatch) {
        return mappingMatch[1].trim();
      }

      return null;
    },

    extractStatsEnabled: (statement: string) => {
      if (!statement || typeof statement !== 'string') return false;

      // Parse SET ENABLED = true/false
      const enabledMatch = statement.match(/SET\s+ENABLED\s*=\s*(true|false)/i);
      if (enabledMatch) {
        return enabledMatch[1].toLowerCase() === 'true';
      }

      // Default to false if not specified
      return false;
    },

    extractResourcePlanDescription: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const match = statement.match(/DESCRIPTION\s*=\s*'([^']*)'/i);
      return match ? match[1] : null;
    },

    extractResourcePlanCondition: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      // Extract all CONDITION clauses - they appear before ACTION keywords
      const conditions: string[] = [];
      const conditionPattern = /CONDITION\s+([^A]+?)(?=\s+ACTION|\s*;|\s*$)/gi;
      let match;
      while ((match = conditionPattern.exec(statement)) !== null) {
        conditions.push(match[1].trim());
      }
      return conditions.length > 0 ? conditions.join(' | ') : null;
    },

    extractResourcePlanAction: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      // Extract action details after RESOURCE_MANAGER keyword
      const match = statement.match(/RESOURCE_MANAGER\s+(.+?)(?=\s*;|\s*$)/i);
      return match ? match[1].trim() : null;
    },

    extractResourcePlanParameters: (statement: string) => {
      if (!statement || typeof statement !== 'string') return {};
      const parameters: any = {};

      // Extract from PARAMETERS blocks: PARAMETERS ('key' = value)
      const paramPattern = /PARAMETERS\s*\(\s*'([^']+)'\s*=\s*(\d+)\s*\)/gi;
      let match;
      while ((match = paramPattern.exec(statement)) !== null) {
        const key = match[1];
        const value = parseInt(match[2], 10);
        // Convert to camelCase for consistency
        if (key === 'Priority') parameters.priority = value;
        else if (key === 'NumOfConcurrentQueries') parameters.maxConcurrentQueries = value;
        else parameters[key] = value;
      }

      // Extract specific keywords
      const maxConnMatch = statement.match(/MAX_CONNECTIONS\s+(\d+)/i);
      if (maxConnMatch) parameters.maxConnections = parseInt(maxConnMatch[1]);

      const maxTimeMatch = statement.match(/MAX_TIME\s+(\d+)/i);
      if (maxTimeMatch) parameters.maxTime = parseInt(maxTimeMatch[1]);

      const maxCpuMatch = statement.match(/MAX_CPU\s+(\d+)/i);
      if (maxCpuMatch) parameters.maxCpu = parseInt(maxCpuMatch[1]);

      const maxMemoryMatch = statement.match(/MAX_MEMORY\s+(\d+)/i);
      if (maxMemoryMatch) parameters.maxMemory = parseInt(maxMemoryMatch[1]);

      const queueSizeMatch = statement.match(/QUEUE_SIZE\s+(\d+)/i);
      if (queueSizeMatch) parameters.queueSize = parseInt(queueSizeMatch[1]);

      return Object.keys(parameters).length > 0 ? parameters : null;
    },

    extractResourceRuleDescription: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const match = statement.match(/DESCRIPTION\s*=\s*'([^']*)'/i);
      return match ? match[1] : null;
    },

    extractResourceRuleCondition: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      // Extract condition before RESOURCE_MANAGER keyword
      const match = statement.match(/CONDITION\s+(.+?)\s+RESOURCE_MANAGER/i);
      return match ? match[1].trim() : null;
    },

    extractResourceRulePlan: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      // Extract plan name after RESOURCE_MANAGER PLAN
      const match = statement.match(/RESOURCE_MANAGER\s+PLAN\s+(?:"([^"]+)"|(\w+))/i);
      return match ? (match[1] || match[2]) : null;
    },

    extractResourceRulePriority: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const match = statement.match(/PRIORITY\s+(\d+)/i);
      return match ? parseInt(match[1], 10) : null;
    },

    extractMapCountry: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const match = statement.match(/'country'\s*=\s*'([^']*)'/i);
      return match ? match[1] : null;
    },

    extractMapTimezone: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const match = statement.match(/'timezone'\s*=\s*'([^']*)'/i);
      return match ? match[1] : null;
    },

    extractTagName: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;

      // Check if this is TAGS (multiple) first - if so, return placeholder
      if (statement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?TAGS\s*\(/i)) {
        return 'tags_placeholder';
      }

      // For single TAG, extract the actual name
      const singleMatch = statement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?TAG\s+(?:"([^"]+)"|(\w+))/i);
      if (singleMatch) {
        return singleMatch[1] || singleMatch[2];
      }

      return null;
    },

    extractTagType: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      // Placeholder - actual type will be set by worker
      return null;
    },

    extractTagDescription: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      // For single TAG with description
      const match = statement.match(/DESCRIPTION\s*=\s*'([^']*)'/i);
      return match ? match[1] : null;
    },

    getFullStatement: (statement: any) => {
      return statement || '';
    },

    extractJarFilePath: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const match = statement.match(/FILE\s*=\s*'([^']*)'/i);
      return match ? match[1] : null;
    },

    extractJarFileName: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const filePathMatch = statement.match(/FILE\s*=\s*'([^']*)'/i);
      if (filePathMatch) {
        const filePath = filePathMatch[1];
        const fileName = filePath.split(/[/\\]/).pop();
        return fileName || null;
      }
      return null;
    },

    extractJarFileType: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const filePathMatch = statement.match(/FILE\s*=\s*'([^']*)'/i);
      if (filePathMatch) {
        const filePath = filePathMatch[1];
        const fileName = filePath.split(/[/\\]/).pop();
        if (fileName) {
          if (fileName.endsWith('.jar')) return 'jar';
          if (fileName.endsWith('.zip')) return 'zip';
          return 'unknown';
        }
      }
      return null;
    },

    extractJarVersion: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const filePathMatch = statement.match(/FILE\s*=\s*'([^']*)'/i);
      if (filePathMatch) {
        const filePath = filePathMatch[1];
        // Extract version from filename pattern like file-1.2.3.jar or file_1.2.3.jar
        const versionMatch = filePath.match(/[-_](\d+(?:\.\d+)*)/);
        return versionMatch ? versionMatch[1] : null;
      }
      return null;
    },

    extractJarDescription: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const match = statement.match(/DESCRIPTION\s*=\s*'([^']*)'/i);
      return match ? match[1] : null;
    }
  }
};