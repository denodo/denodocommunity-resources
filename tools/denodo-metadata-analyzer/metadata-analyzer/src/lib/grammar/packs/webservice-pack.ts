// WebService Grammar Pack - Ported from React parser-config.json
// Contains: REST_WEBSERVICE, SOAP_WEBSERVICE, WEBSERVICE statements
// Stores in webservices table (different from React which uses globalElements)

import type { GrammarPack } from '../../../types/grammar';

const PATTERNS = {
  quotedIdentifier: '(?:"([^"]+)"|([\\w.-]+))',
  restWebservice: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?REST\\s+WEBSERVICE\\s+',
  soapWebservice: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?SOAP\\s+WEBSERVICE\\s+',
  // Generic WEBSERVICE (not REST/SOAP); REST/SOAP patterns must be checked first
  genericWebservice: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?WEBSERVICE\\s+'
};

export const WebServicePack: GrammarPack = {
  name: 'webservices',
  version: '1.0.0',
  description: 'Web Service statements - REST, SOAP, and generic WEBSERVICE',

  statements: {
    REST_WEBSERVICE: {
      patterns: [PATTERNS.restWebservice + PATTERNS.quotedIdentifier],
      extractors: {
        type: { value: 'REST' },
        name: {
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        // FOLDER = '/path'
        folder: {
          type: 'pattern',
          pattern: "\\bFOLDER\\s*=\\s*'([^']*)'",
          group: 1
        },
        // RESOURCES (...) VIEW <resource> FIELDS (...)
        resourceName: {
          type: 'pattern',
          pattern: "RESOURCES[\\s\\S]*?\\bVIEW\\s+([^\\s(]+)",
          group: 1
        }
      },
      normalize: {
        table: "webservices",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          folder: "$folder",
          resource_name: "$resourceName"
        }
      }
    },

    SOAP_WEBSERVICE: {
      patterns: [PATTERNS.soapWebservice + PATTERNS.quotedIdentifier],
      extractors: {
        type: { value: 'SOAP' },
        name: {
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        // FOLDER = '/path'
        folder: {
          type: 'pattern',
          pattern: "\\bFOLDER\\s*=\\s*'([^']*)'",
          group: 1
        },
        // OPERATION ... SCHEMA VIEW <schema>
        schemaName: {
          type: 'pattern',
          pattern: "\\bSCHEMA\\s+VIEW\\s+([^\\s]+)",
          group: 1
        }
      },
      normalize: {
        table: "webservices",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          folder: "$folder",
          schema_name: "$schemaName"
        }
      }
    },

    WEBSERVICE: {
      patterns: [PATTERNS.genericWebservice + PATTERNS.quotedIdentifier],
      extractors: {
        type: { value: 'WEBSERVICE' },
        name: {
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        }
      },
      normalize: {
        table: "webservices",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase"
        }
      }
    }
  },

  processors: {
    sanitizeIdentifier: (value: any) => {
      if (!value || typeof value !== 'string') return value;
      return value.replace(/\bOR\s+REPLACE\b/gi, '').replace(/^"([\s\S]*?)"$/, '$1').trim();
    },

    normalizeWebServiceType: (value: any) => {
      if (!value || typeof value !== 'string') return 'WEBSERVICE';
      const normalized = value.trim().toUpperCase();
      if (normalized.includes('REST')) return 'REST';
      if (normalized.includes('SOAP')) return 'SOAP';
      return 'WEBSERVICE';
    }
  }
};
