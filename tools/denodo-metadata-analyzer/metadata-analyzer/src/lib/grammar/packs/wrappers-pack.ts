// Wrappers Grammar Pack - Ported from existing grammar-config.js
// Contains: WRAPPER statements only (webservices moved to webservice-pack)

import type { GrammarPack } from '../../../types/grammar';

const PATTERNS = {
  quotedIdentifier: '(?:"([^"]+)"|([\\w.-]+))'
};

export const WrappersPack: GrammarPack = {
  name: 'wrappers',
  version: '1.0.0',
  description: 'Wrapper and REST WebService statements',

  statements: {
    WRAPPER: {
      patterns: [
        // Simplified pattern: Just match WRAPPER CUSTOM with name, extract PARAMETERS separately
        'CREATE\\s+(?:OR\\s+REPLACE\\s+)?WRAPPER\\s+CUSTOM\\s+(?:"((?:""|[^"])*)"|([^\\s(]+))',
        // Fallback for other wrapper types
        'CREATE\\s+(?:OR\\s+REPLACE\\s+)?WRAPPER\\s+(\\w+)\\s+(?:"([^"]+)"|(\\w[\\w_.-]*?))'
      ],
      extractors: {
        wrapperType: { value: "CUSTOM" }, // All Excel wrappers are CUSTOM type
        name: {
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeWrapperName",
          required: true
        },
        dataSourceName: {
          pattern: "DATASOURCENAME\\s*=\\s*(?:\"([^\"]+)\"|([\\w.-]+))",
          group: 1,
          fallbackGroup: 2
        },
        parametersContent: {
          type: "customProcessor",
          processor: "extractParametersContent"
        },
        parameters: {
          type: "customProcessor",
          processor: "parseParametersToObject"
        },
        streamTuplesConfig: {
          type: "customProcessor",
          processor: "extractStreamTuplesFromParams"
        },
        isExcelWrapper: {
          type: "customProcessor",
          processor: "detectExcelWrapperFromParams"
        },
        typeOfFile: {
          type: "customProcessor",
          processor: "extractTypeOfFileFromParams"
        }
      },
      normalize: {
        table: "wrappers",
        map: {
          name: "$name",
          wrapperType: "$wrapperType",
          database: "$currentDatabase",
          dataSourceName: "$dataSourceName",
          parametersContent: "$parametersContent",
          streamTuplesConfig: "$streamTuplesConfig",
          parameters: "$parameters",
          isExcelWrapper: "$isExcelWrapper",
          typeOfFile: "$typeOfFile"
        }
      }
    }
  },

  processors: {
    sanitizeIdentifier: (value: any) => {
      if (!value || typeof value !== 'string') return value;
      return value.replace(/\bOR\s+REPLACE\b/gi, '').replace(/^"([\s\S]*?)"$/, '$1').trim();
    },

    sanitizeWrapperName: (value: any) => {
      if (!value) return value;
      // Handle quoted names with escaped quotes like the reference
      if (typeof value === 'string' && value.includes('""')) {
        return value.replace(/""/g, '"');
      }
      return value;
    },

    extractParametersContent: (statement: string) => {
      if (!statement || typeof statement !== 'string') return '';

      // DEBUG: Log first few wrapper statements to see what we're parsing
      if (Math.random() < 0.1) { // Log 10% of wrappers
        console.log('🔍 extractParametersContent called:', {
          hasParameters: statement.includes('PARAMETERS'),
          statementPreview: statement.substring(0, 200)
        });
      }

      // Extract PARAMETERS content using nested parentheses matching (like legacy approach)
      const paramMatch = statement.match(/PARAMETERS\s*\(/i);
      if (!paramMatch || paramMatch.index === undefined) return '';

      const startPos = paramMatch.index + paramMatch[0].length - 1; // Position of opening '('
      let depth = 1;
      let i = startPos + 1;
      let inQuotes = false;
      let quoteChar = '';
      let content = '';

      // Find matching closing parenthesis with proper quote handling
      while (i < statement.length && depth > 0) {
        const char = statement[i];
        const prev = i > 0 ? statement[i - 1] : '';

        // Handle quotes
        if ((char === '"' || char === "'") && prev !== '\\') {
          if (!inQuotes) {
            inQuotes = true;
            quoteChar = char;
          } else if (char === quoteChar) {
            inQuotes = false;
            quoteChar = '';
          }
        }

        // Handle parentheses when not in quotes
        if (!inQuotes) {
          if (char === '(') {
            depth++;
          } else if (char === ')') {
            depth--;
          }
        }

        // Add to content if we're still inside the parameters
        if (depth > 0) {
          content += char;
        }

        i++;
      }

      return content.trim();
    },

    extractTypeOfFileFromParams: (statement: string, context: any) => {
      if (!statement || typeof statement !== 'string') return null;

      // Get parameters content from context or extract from statement
      const paramsContent = context?.parametersContent || '';

      // Use regex pattern like the reference: /'Type\s+of\s+file'\s*(?:=\s*)?'([^']*)'/i
      const typeOfFileMatch = paramsContent.match(/'Type\s+of\s+file'\s*(?:=\s*)?'([^']*)'/i);
      return typeOfFileMatch ? typeOfFileMatch[1] : null;
    },

    extractStreamTuplesFromParams: (statement: string, context: any) => {
      if (!statement || typeof statement !== 'string') return {};

      // Match React logic: use parsed parameters object, not regex on raw string
      // React code: line 261 in WrapperParser.js
      const parameters = context?.parameters;

      if (parameters && typeof parameters === 'object') {
        // Find 'Stream tuples' parameter (case-insensitive search like React)
        const paramKeys = Object.keys(parameters);
        const streamTuplesKey = paramKeys.find(key =>
          key.toLowerCase() === 'stream tuples' ||
          key.toLowerCase() === 'streamtuples' ||
          key === 'Stream tuples'
        );

        if (streamTuplesKey) {
          const value = parameters[streamTuplesKey];
          const boolValue = value === true || value === 'true';
          return {
            streamTuples: boolValue,
            streamTuplesRaw: String(value),
            enabled: boolValue,
            disabled: !boolValue,
            configured: true,
            value: value
          };
        }
      }

      return { configured: false };
    },

    parseParametersToObject: (statement: string, context: any) => {
      if (!statement || typeof statement !== 'string') return {};

      // Get parameters content from context
      const paramsContent = context?.parametersContent || '';
      if (!paramsContent) return {};

      const parameters: any = {};

      // Extract all parameter key-value pairs using regex
      // Match: 'key' = 'value' or 'key' = value
      const paramRegex = /'([^']+)'\s*(?:=\s*)?(?:'([^']*)'|"([^"]*)"|([^,\r\n]+?)(?:,|$))/gi;
      let paramMatch;

      while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
        const key = paramMatch[1];
        const value = paramMatch[2] || paramMatch[3] || (paramMatch[4] ? paramMatch[4].trim() : '');

        if (key && value !== undefined) {
          // Handle boolean values
          if (/^(true|false)$/i.test(value)) {
            parameters[key] = /^true$/i.test(value);
          } else {
            parameters[key] = value;
          }
        }
      }

      return parameters;
    },

    detectExcelWrapperFromParams: (statement: string, context: any) => {
      if (!statement || typeof statement !== 'string') return false;

      // Get parameters content from context
      const paramsContent = context?.parametersContent || '';

      // Check for 'Type of file' parameter with Excel values
      const typeOfFileMatch = paramsContent.match(/'Type\s+of\s+file'\s*(?:=\s*)?'([^']*)'/i);
      if (typeOfFileMatch) {
        const typeOfFile = typeOfFileMatch[1].toLowerCase();
        // Excel indicators
        if (['excel', 'xls', 'xlsx'].some(excel => typeOfFile.includes(excel))) {
          return true;
        }
      }

      // Fallback: Check for Excel-specific parameters or wrapper names
      const excelIndicators = ['excel', 'xls', 'xlsx', 'spreadsheet'];
      const nameMatch = statement.match(/WRAPPER\s+CUSTOM\s+(?:"([^"]+)"|([^\\s(]+))/i);
      if (nameMatch) {
        const name = (nameMatch[1] || nameMatch[2] || '').toLowerCase();
        if (excelIndicators.some(indicator => name.includes(indicator))) {
          return true;
        }
      }

      return false;
    }
  }
};