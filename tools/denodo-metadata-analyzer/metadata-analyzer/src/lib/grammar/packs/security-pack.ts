// Security Grammar Pack - Ported from existing grammar-config.js
// Contains: USER, ROLE, ALTER_ROLE statements

import type { GrammarPack } from '../../../types/grammar';

const PATTERNS = {
  quotedIdentifier: '(?:"([^"]+)"|([\\w.-]+))',
  prefixes: {
    user: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?USER\\s+',
    role: 'CREATE\\s+(?:OR\\s+REPLACE\\s+)?ROLE\\s+'
  }
};

export const SecurityPack: GrammarPack = {
  name: 'security',
  version: '1.0.0',
  description: 'Security statements - USER, ROLE, ALTER_ROLE',

  statements: {
    USER: {
      patterns: [PATTERNS.prefixes.user + PATTERNS.quotedIdentifier + '\\s*[\\s\\S]*?;'],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.user,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "user" },

        // Authentication type detection
        authType: {
          type: "conditional",
          conditions: [
            {
              pattern: "\\bLDAP\\s*\\(",
              value: "ldap"
            },
            {
              pattern: ".*", // Default fallback
              value: "vdp"
            }
          ]
        },

        // User type detection (admin vs normal)
        userType: {
          type: "conditional",
          conditions: [
            {
              pattern: "\\bWITH_ASSIGN_PRIVILEGES_ROLE\\b",
              value: "admin"
            },
            {
              pattern: "\\bADMIN\\b.*\\bWITH_ASSIGN_PRIVILEGES_ROLE\\b",
              value: "admin"
            },
            {
              pattern: ".*", // Default fallback
              value: "normal"
            }
          ]
        },

        // LDAP datasource extraction
        ldapDatasource: {
          type: "pattern",
          pattern: "\\bDATASOURCE\\s+([\\w\\.]+)",
          group: 1,
          conditions: [{ pattern: "\\bLDAP\\s*\\(" }]
        },

        // LDAP username extraction
        ldapUsername: {
          type: "pattern",
          pattern: "\\bUSERNAME\\s+'([^']+)'",
          group: 1,
          conditions: [{ pattern: "\\bLDAP\\s*\\(" }]
        },

        // Enhanced description extraction for both VDP and LDAP users
        description: {
          type: "customProcessor",
          processor: "extractUserDescription"
        }
      },
      normalize: {
        table: "global_elements",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          auth_type: "$authType",
          user_type: "$userType",
          ldap_datasource: "$ldapDatasource",
          ldap_username: "$ldapUsername",
          description: "$description"
        }
      }
    },

    ROLE: {
      patterns: [PATTERNS.prefixes.role + PATTERNS.quotedIdentifier],
      extractors: {
        name: {
          type: "identifierAfter",
          pattern: PATTERNS.prefixes.role,
          group: 1,
          fallbackGroup: 2,
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "role" },
        roleType: {
          type: "customProcessor",
          processor: "extractRoleType"
        },
        description: {
          type: "customProcessor",
          processor: "extractRoleDescription"
        }
      },
      normalize: {
        table: "global_elements",
        map: {
          name: "$name",
          type: "$type",
          database: "$currentDatabase",
          roleType: "$roleType",
          description: "$description"
        }
      }
    },

    ALTER_ROLE: {
      patterns: [
        'ALTER\\s+ROLE\\s+(?:"([^"]+)"|\'([^\']+)\'|([\\w\\d_.-]+))[\\s\\S]*?GRANT\\s+ROLE'
      ],
      extractors: {
        name: {
          group: 1,
          fallbackGroup: [2, 3],
          processor: "sanitizeIdentifier",
          required: true
        },
        type: { value: "alter_role" },
        grantedRoles: {
          type: "customProcessor",
          processor: "extractGrantedRoles"
        },
        adminPrivileges: {
          type: "customProcessor",
          processor: "extractAdminPrivileges"
        },
        isAdmin: {
          type: "customProcessor",
          processor: "isAdminRole"
        },
        fullDefinition: {
          type: "customProcessor",
          processor: "getFullStatement"
        }
      },
      normalize: {
        table: "role_modifications",
        map: {
          name: "$name",
          type: "$type",
          grantedRoles: "$grantedRoles",
          adminPrivileges: "$adminPrivileges",
          isAdmin: "$isAdmin",
          fullDefinition: "$fullDefinition",
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

    extractUserDescription: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;

      // Extract all quoted strings from the statement
      const matches = statement.match(/'([^']*)'/g);
      if (!matches || matches.length === 0) return null;

      const isLdapUser = /\bLDAP\s*\(/i.test(statement);

      if (isLdapUser) {
        // For LDAP users, the description is the last quoted string
        // Example: CREATE USER carf7o LDAP (...) NOCHECK 'Jennifer Carrle';
        const lastQuoted = matches[matches.length - 1];
        return lastQuoted.slice(1, -1); // Remove surrounding quotes
      } else {
        // For VDP users, the description is the last quoted string
        // (after password/encryption strings)
        // Example: CREATE USER cardiology_svc '${users.cardology_svc.PASSWORD}' ... 'Service Account';
        const lastQuoted = matches[matches.length - 1];
        const description = lastQuoted.slice(1, -1);

        // Filter out password-related strings
        if (description.includes('${users.') || description.includes('.PASSWORD') || description.includes('.ENCRYPTED') || description.includes('.ALGORITHM')) {
          // If the last quote is password-related, try the second-to-last
          if (matches.length >= 2) {
            const secondLastQuoted = matches[matches.length - 2];
            const secondDesc = secondLastQuoted.slice(1, -1);
            if (!secondDesc.includes('${users.') && !secondDesc.includes('.PASSWORD')) {
              return secondDesc;
            }
          }
          return null; // No valid description found
        }

        return description;
      }
    },

    extractGrantedRoles: (statement: string) => {
      if (!statement || typeof statement !== 'string') return [];

      // Look for GRANT ROLE statements and extract the roles
      const grantRoleMatch = statement.match(/GRANT\s+ROLE\s+([^\n]+)/i);
      if (!grantRoleMatch) return [];

      const rolesString = grantRoleMatch[1].trim();

      // Split by comma and clean up each role name
      const roles = rolesString.split(',')
        .map(role => role.trim())
        .filter(role => role.length > 0);

      return roles;
    },

    extractAdminPrivileges: (statement: string) => {
      if (!statement || typeof statement !== 'string') return [];

      // Extract roles from GRANT ROLE statement directly
      const grantRoleMatch = statement.match(/GRANT\s+ROLE\s+([^\n]+)/i);
      if (!grantRoleMatch) return [];

      const rolesPart = grantRoleMatch[1].trim();
      const roles = rolesPart.split(',').map(role => role.trim().replace(/['"]/g, ''));

      // Filter roles that contain "admin" in their name
      const adminPrivileges = roles.filter(role =>
        role.toLowerCase().includes('admin')
      );

      return adminPrivileges;
    },

    isAdminRole: (statement: string) => {
      if (!statement || typeof statement !== 'string') return false;

      // Check if the ALTER ROLE statement contains GRANT ROLE
      const hasGrantRole = /GRANT\s+ROLE\s+/i.test(statement);
      if (!hasGrantRole) return false;

      // Extract admin privileges directly
      const grantRoleMatch = statement.match(/GRANT\s+ROLE\s+([^\n]+)/i);
      if (!grantRoleMatch) return false;

      const rolesPart = grantRoleMatch[1].trim();
      const roles = rolesPart.split(',').map(role => role.trim().replace(/['"]/g, ''));
      const adminPrivileges = roles.filter(role => role.toLowerCase().includes('admin'));

      // Return true if there are any admin privileges
      return adminPrivileges.length > 0;
    },

    extractRoleType: (statement: string) => {
      // CREATE ROLE statements don't have type - will be determined by ALTER_ROLE
      // Return null for now, ALTER_ROLE will set it via role_modifications
      return null;
    },

    extractRoleDescription: (statement: string) => {
      if (!statement || typeof statement !== 'string') return null;
      // Extract description after role name: CREATE ROLE name 'description'
      const match = statement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?ROLE\s+(?:"[^"]+"|'[^']+'|\w+)\s+'([^']*)'/i);
      return match ? match[1] : null;
    },

    getFullStatement: (statement: any) => {
      // Return the full statement as-is for ALTER_ROLE
      return statement || '';
    }
  }
};