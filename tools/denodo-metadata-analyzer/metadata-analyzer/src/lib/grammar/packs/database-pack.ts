// Database Grammar Pack - Ported from existing grammar-config.js
// Contains: DATABASE, USE_DATABASE, ALTER_DATABASE statements

import type { GrammarPack } from '../../../types/grammar';

const PATTERNS = {
  // Exact working pattern from React: CREATE\s+(OR\s+REPLACE\s+)?DATABASE\s+(?:"([^"]+)"|([\w.-]+))
  database: 'CREATE\\s+(OR\\s+REPLACE\\s+)?DATABASE\\s+(?:"([^"]+)"|([\\w.-]+))',
  useDatabase: '(?:USE|SET|CONNECT)\\s+DATABASE\\s+(?:"([^"]+)"|([\\w.-]+))',
  alterDatabase: 'ALTER\\s+DATABASE\\s+(?:"([^"]+)"|([\\w.-]+))'
};

export const DatabasePack: GrammarPack = {
  name: 'database',
  version: '1.0.0',
  description: 'Database context statements - CREATE, USE, ALTER DATABASE',

  statements: {
    DATABASE: {
      patterns: [PATTERNS.database],
      extractors: {
        name: {
          group: 3,
          fallbackGroup: 4,
          processor: "sanitizeIdentifier",
          required: true
        },
        description: {
          type: "pattern",
          pattern: "DESCRIPTION\\s*=\\s*'([^']*)'?",
          group: 1,
          required: false
        }
      },
      normalize: {
        table: "databases",
        map: {
          name: "$name",
          denodo_version: "$denodoVersion"
        }
      }
    },

    USE_DATABASE: {
      patterns: [PATTERNS.useDatabase],
      extractors: {
        name: {
          group: 2,
          fallbackGroup: 3,
          processor: "sanitizeIdentifier"
        }
      },
      contextChange: true // This changes database context
    },

    ALTER_DATABASE: {
      patterns: [PATTERNS.alterDatabase],
      extractors: {
        name: {
          group: 2,
          fallbackGroup: 3,
          processor: "sanitizeIdentifier"
        }
      },
      contextChange: true // This changes database context
    }
  },

  processors: {
    sanitizeIdentifier: (value: any) => {
      if (!value || typeof value !== 'string') return value;
      return value.replace(/\bOR\s+REPLACE\b/gi, '').replace(/^"([\s\S]*?)"$/, '$1').trim();
    }
  }
};