// Views Grammar Pack - Ported from existing grammar-config.js
// Contains: VIEW, INTERFACE_VIEW, TABLE, ALTER_VIEW statements

import type { GrammarPack } from '../../../types/grammar';

const PATTERNS = {
  quotedIdentifier: '(?:"([^"]+)"|([\\w.-]+))',
  prefixes: {
    // Negative lookahead to exclude INTERFACE VIEW from matching VIEW pattern
    view: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?!INTERFACE\\s+)VIEW\\s+',
    interfaceView: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?INTERFACE\\s+VIEW\\s+',
    table: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?TABLE\\s+',
    alterView: 'ALTER\\s+VIEW\\s+'
  }
};

export const ViewsPack: GrammarPack = {
  name: 'views',
  version: '1.0.0',
  description: 'View and table statements - CREATE VIEW, INTERFACE VIEW, TABLE, ALTER VIEW',

  statements: {
    VIEW: {
      patterns: [PATTERNS.prefixes.view + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.view,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        kind: { value: "view" },
        selectBody: {
          type: "customProcessor",
          processor: "extractSelectBodyFromView"
        },
        folder: {
          type: "customProcessor",
          processor: "extractFolder"
        },
        cacheStatus: {
          type: "customProcessor",
          processor: "extractCacheStatus"
        }
      },
      normalize: {
        table: "views",
        map: {
          name: "$name",
          kind: "$kind",
          database: "$currentDatabase",
          folder: "$folder",
          selectBody: "$selectBody",
          cacheStatus: "$cacheStatus"
        }
      }
    },

    INTERFACE_VIEW: {
      patterns: [PATTERNS.prefixes.interfaceView + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.interfaceView,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        kind: { value: "interface view" },
        implementation: {
          type: "customProcessor",
          processor: "extractInterfaceImplementation"
        },
        folder: {
          type: "customProcessor",
          processor: "extractFolder"
        },
        cacheStatus: {
          type: "customProcessor",
          processor: "extractCacheStatus"
        }
      },
      normalize: {
        table: "views",
        map: {
          name: "$name",
          kind: "$kind",
          database: "$currentDatabase",
          folder: "$folder",
          implementation: "$implementation",
          cacheStatus: "$cacheStatus"
        }
      }
    },

    TABLE: {
      patterns: [PATTERNS.prefixes.table + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.table,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        kind: { value: "table" },
        folder: {
          type: "customProcessor",
          processor: "extractFolder"
        },
        cacheStatus: {
          type: "customProcessor",
          processor: "extractCacheStatus"
        }
      },
      normalize: {
        table: "views",
        map: {
          name: "$name",
          kind: "$kind",
          database: "$currentDatabase",
          folder: "$folder",
          cacheStatus: "$cacheStatus"
        }
      }
    },

    ALTER_VIEW: {
      // Only match ALTER VIEW statements that have CACHE (not LAYOUT or other properties)
      // Pattern captures: group 1/2 = view name (quoted/unquoted), group 3 = cache status
      patterns: [
        'ALTER\\s+VIEW\\s+(?:"([^"]+)"|([\\w.-]+))\\s+[\\s\\S]*?CACHE\\s+(FULL|PARTIAL)'
      ],
      extractors: {
        name: {
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        cacheStatus: {
          group: 3,  // Extract FULL/PARTIAL directly from regex match
          processor: "lowercase"  // Convert to lowercase
        }
      }
      // No normalize - ALTER VIEW updates existing views, doesn't create new ones
    }
  },

  processors: {
    sanitizeIdentifier: (value: any) => {
      if (!value || typeof value !== 'string') return value;
      return value.replace(/\bOR\s+REPLACE\b/gi, '').replace(/^"([\s\S]*?)"$/, '$1').trim();
    },

    extractInterfaceImplementation: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;

      // Handle quoted and unquoted identifiers separately
      const quotedMatch = statement.match(/SET\s+IMPLEMENTATION\s+"([^"]+)"/i);
      const unquotedMatch = statement.match(/SET\s+IMPLEMENTATION\s+([^\s;()]+)/i);

      let implMatch = quotedMatch || unquotedMatch;
      if (implMatch) {
        let impl = implMatch[1];
        if (impl) {
          return impl.trim();
        }
      }
      return null;
    },

    // Extract FOLDER = '/path' or "path" from the full statement
    extractFolder: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      const m = statement.match(/FOLDER\s*=\s*(?:'([^']*)'|"([^"]*)")/i);
      if (m) {
        return (m[1] || m[2] || '').trim();
      }
      return null;
    },

    extractSelectBodyFromView: (statement: string) => {
      if (!statement || typeof statement !== 'string') {
        console.log('⚠️  extractSelectBodyFromView: Invalid statement', typeof statement);
        return null;
      }

      console.log('🔍 extractSelectBodyFromView called, statement length:', statement.length, 'first 200 chars:', statement.substring(0, 200));

      // Helper function to find keywords outside quotes and comments
      const findKeywordOutside = (text: string, keyword: string) => {
        if (!text || !keyword) return -1;

        const target = keyword.toLowerCase();
        let i = 0;
        const n = text.length;
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inLineComment = false;
        let inBlockComment = false;

        while (i < n) {
          const ch = text[i];
          const next = i + 1 < n ? text[i + 1] : '';

          // Handle line comments
          if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            i++;
            continue;
          }

          // Handle block comments
          if (inBlockComment) {
            if (ch === '*' && next === '/') {
              inBlockComment = false;
              i += 2;
              continue;
            }
            i++;
            continue;
          }

          // Check for comment start
          if (!inSingleQuote && !inDoubleQuote) {
            if (ch === '-' && next === '-') {
              inLineComment = true;
              i += 2;
              continue;
            }
            if (ch === '/' && next === '*') {
              inBlockComment = true;
              i += 2;
              continue;
            }
          }

          // Handle quotes
          if (ch === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
          } else if (ch === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
          } else if (!inSingleQuote && !inDoubleQuote) {
            // Check for keyword match
            if (text.substring(i, i + keyword.length).toLowerCase() === target) {
              // Check word boundaries
              const prevChar = i > 0 ? text[i - 1] : ' ';
              const nextChar = i + keyword.length < n ? text[i + keyword.length] : ' ';

              if (!/\w/.test(prevChar) && !/\w/.test(nextChar)) {
                return i;
              }
            }
          }

          i++;
        }

        return -1;
      };

      // Find AS keyword outside quotes/comments
      const asPos = findKeywordOutside(statement, "AS");
      if (asPos === -1) return null;

      let body = statement.substring(asPos + 2).trim();

      // Remove leading comments and FOLDER clauses
      body = body.replace(/^\/\*[\s\S]*?\*\/\s*/g, ''); // Remove /* */ comments
      body = body.replace(/^--.*$/gm, ''); // Remove -- comments
      body = body.replace(/^\s*FOLDER\s*=\s*'[^']*'\s*/i, ''); // Remove FOLDER clause
      body = body.trim();

      // Remove trailing CONTEXT clause if present
      const contextPos = findKeywordOutside(body, "CONTEXT");
      if (contextPos !== -1) {
        body = body.substring(0, contextPos).trim();
      }

      // Remove trailing USING PARAMETERS clause if present
      const usingPos = findKeywordOutside(body, "USING");
      if (usingPos !== -1) {
        body = body.substring(0, usingPos).trim();
      }

      // Remove trailing semicolons
      body = body.replace(/;+\s*$/, '');

      // Check if it contains SELECT or WITH (both are valid SQL starts)
      const hasSelect = body.toLowerCase().includes('select');
      const hasWith = body.toLowerCase().trim().startsWith('with');

      if (!hasSelect && !hasWith) {
        console.log('⚠️  No SELECT or WITH found in body');
        return null;
      }

      const trimmedBody = body.trim();
      console.log('✅ extractSelectBodyFromView returning body, length:', trimmedBody.length, 'first 150 chars:', trimmedBody.substring(0, 150));
      return trimmedBody;
    },

    extractCacheStatus: (statement: string) => {
      if (!statement || typeof statement !== 'string') {
        return null;
      }

      // Enhanced patterns to match ONLY CACHE FULL and CACHE PARTIAL (filter out OFF)
      const cachePatterns = [
        // Pattern 1: Simple CACHE FULL/PARTIAL (most common) - NO OFF
        /\bCACHE\s+(FULL|PARTIAL)\b/gi,
        // Pattern 2: Cache with optional PRELOAD
        /\bCACHE\s+(FULL|PARTIAL)\s+PRELOAD\b/gi,
        // Pattern 3: Cache in multiline with parameters
        /\bCACHE\s+(FULL|PARTIAL)[\s\S]*?(?:BATCHSIZEINCACHE|TIMETOLIVEINCACHE)/gi,
        // Pattern 4: ALTER VIEW cache patterns
        /\bALTER\s+VIEW\s+[^\s]+\s+CACHE\s+(FULL|PARTIAL)\b/gi,
        // Pattern 5: Multiline ALTER VIEW with DECLARE CACHE INDEX
        /\bCACHE\s+(FULL|PARTIAL)[\s\S]*?DECLARE\s+CACHE\s+INDEX/gi,
        // Pattern 6: Case-insensitive flexible whitespace - NO OFF
        /cache\s+(full|partial)\b/gi
      ];

      // Test each pattern
      for (let i = 0; i < cachePatterns.length; i++) {
        const pattern = cachePatterns[i];
        // Reset pattern to start from beginning
        pattern.lastIndex = 0;
        const cacheMatch = pattern.exec(statement);
        if (cacheMatch) {
          const cacheType = cacheMatch[1].toLowerCase();
          // Only return if it's FULL or PARTIAL (filter out OFF)
          if (cacheType === 'full' || cacheType === 'partial') {
            return cacheType;
          }
        }
      }

      // Before using fallback patterns, check if this is explicitly CACHE OFF
      const cacheOffPattern = /\bCACHE\s+OFF\b/gi;
      cacheOffPattern.lastIndex = 0;
      if (cacheOffPattern.exec(statement)) {
        return null; // Don't use fallback if explicitly CACHE OFF
      }

      // Fallback: Look for cache-related keywords that might indicate caching
      const fallbackPatterns = [
        /\bBATCHSIZEINCACHE\s+(\w+)/gi,
        /\bTIMETOLIVEINCACHE\s+(\w+)/gi,
        /\bCACHE[\s\S]{1,50}(?:DEFAULT|NOEXPIRE)/gi
      ];

      for (let i = 0; i < fallbackPatterns.length; i++) {
        const pattern = fallbackPatterns[i];
        pattern.lastIndex = 0;
        const match = pattern.exec(statement);
        if (match) {
          return 'partial'; // Assume partial if cache params found without explicit CACHE
        }
      }

      return null; // No cache configuration found
    }
  }
};
