'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Users, Shield, Package, Map, Tag, Zap, Activity, Search, ChevronLeft, ChevronRight, UserCheck, UserX } from 'lucide-react';
import { DuckDBClient } from '../../src/lib/database/duckdb-client';
import { colors, spacing, borderRadius, shadows } from '../../src/lib/theme';

interface GlobalElement {
  type: string;
  name: string;
  database?: string;
  authType?: string;
  userType?: string;
  description?: string;
  ldapDatasource?: string;
  ldapUsername?: string;
  roleType?: string;
  adminPrivileges?: string;
  version?: string;
  fileType?: string;
  filePath?: string;
  mapType?: string;
  country?: string;
  timezone?: string;
  tagType?: string;
}

interface RoleModification {
  name: string;
  grantedRoles?: any[];
  adminPrivileges?: string[];
  isAdmin?: boolean;
}

interface ResourcePlan {
  name: string;
  type?: string;
  database?: string;
  description?: string;
  condition?: string;
  action?: string;
  parameters?: any;
  fullDefinition?: string;
}

interface ResourceRule {
  name: string;
  type?: string;
  database?: string;
  description?: string;
  condition?: string;
  plan?: string;
  priority?: number;
  fullDefinition?: string;
}

export default function GlobalStatsPage() {
  const [globalElements, setGlobalElements] = useState<GlobalElement[]>([]);
  const [roleModifications, setRoleModifications] = useState<RoleModification[]>([]);
  const [resourcePlans, setResourcePlans] = useState<ResourcePlan[]>([]);
  const [resourceRules, setResourceRules] = useState<ResourceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [userFilter, setUserFilter] = useState('all'); // all, vdp, ldap
  const [roleFilter, setRoleFilter] = useState('all'); // all, serveradmin, admin, other
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const itemsPerPage = 50;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, userFilter, roleFilter, searchTerm]);

  const loadGlobalElements = useCallback(async () => {
    try {
      const client = new DuckDBClient();
      await client.initialize();

      const hasData = await client.loadFromParquet();
      if (!hasData) {
        window.location.href = '/';
        return;
      }

      // Query global_elements, role_modifications, resource_plans, resource_rules from DuckDB
      const elements = await client.query('SELECT * FROM global_elements');
      const roleMods = await client.query('SELECT * FROM role_modifications');
      const plans = await client.query('SELECT * FROM resource_plans');
      const rules = await client.query('SELECT * FROM resource_rules');

      setGlobalElements(elements);
      setRoleModifications(roleMods);
      setResourcePlans(plans);
      setResourceRules(rules);
    } catch (error: any) {
      console.error('Failed to load global elements:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGlobalElements();
  }, [loadGlobalElements]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: colors.gray50
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: `3px solid ${colors.accent}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }}></div>
          <p style={{ fontSize: '14px', color: colors.gray600 }}>Loading global statistics...</p>
        </div>
      </div>
    );
  }

  // Group elements by type
  const elementsByType = globalElements.reduce((acc: any, element) => {
    const type = element.type || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(element);
    return acc;
  }, {});

  const users = elementsByType.user || [];
  const roles = elementsByType.role || [];
  const jars = elementsByType.jar || [];
  const maps = elementsByType.map || [];
  const tags = elementsByType.tag || [];

  // Enhanced roles with admin info from role_modifications
  const enhancedRoles = roles.map((role: GlobalElement) => {
    const roleModification = roleModifications.find(rm => rm.name === role.name);

    // Parse adminPrivileges from JSON string (DuckDB returns JSON as string)
    let adminPrivileges: string[] = [];
    if (roleModification?.adminPrivileges) {
      try {
        adminPrivileges = typeof roleModification.adminPrivileges === 'string'
          ? JSON.parse(roleModification.adminPrivileges)
          : roleModification.adminPrivileges;
      } catch (e) {
        adminPrivileges = [];
      }
    }

    // Parse granted roles (all privileges) from JSON/string, with fallback to snake_case
    let privileges: string[] = [];
    const rawGranted = (roleModification as any)?.grantedRoles ?? (roleModification as any)?.granted_roles;
    if (rawGranted) {
      try {
        privileges = typeof rawGranted === 'string' ? JSON.parse(rawGranted) : rawGranted;
      } catch (e) {
        privileges = [];
      }
    }

    const isAdmin = roleModification?.isAdmin || role.roleType === 'admin';
    const isCriticalAdmin = isAdmin && (privileges.length > 0 ? privileges : adminPrivileges).some((priv: string) => priv?.toLowerCase().includes('serveradmin'));

    return {
      ...role,
      roleModification,
      adminPrivileges,
      privileges,
      isAdmin,
      isCriticalAdmin
    };
  });

  // Filter users
  const getFilteredUsers = () => {
    let filtered = users;

    if (userFilter === 'vdp') filtered = filtered.filter((u: GlobalElement) => u.authType === 'vdp' || !u.authType);
    if (userFilter === 'ldap') filtered = filtered.filter((u: GlobalElement) => u.authType === 'ldap');

    if (searchTerm) {
      filtered = filtered.filter((u: GlobalElement) =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.description && u.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  };

  // Filter roles
  const getFilteredRoles = () => {
    let filtered = enhancedRoles;

    if (roleFilter === 'serveradmin') filtered = filtered.filter((r: any) => r.isCriticalAdmin);
    if (roleFilter === 'admin') filtered = filtered.filter((r: any) => r.isAdmin && !r.isCriticalAdmin);
    if (roleFilter === 'other') filtered = filtered.filter((r: any) => !r.isAdmin);

    if (searchTerm) {
      filtered = filtered.filter((r: any) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  };

  // Filter jars
  const getFilteredJars = () => {
    let filtered = jars;

    if (searchTerm) {
      filtered = filtered.filter((j: GlobalElement) =>
        j.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (j.description && j.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (j.filePath && j.filePath.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  };

  // Filter maps
  const getFilteredMaps = () => {
    let filtered = maps;

    if (searchTerm) {
      filtered = filtered.filter((m: GlobalElement) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.country && m.country.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.timezone && m.timezone.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  };

  // Filter tags
  const getFilteredTags = () => {
    let filtered = tags;

    if (searchTerm) {
      filtered = filtered.filter((t: GlobalElement) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  };

  const filteredItems = activeTab === 'users' ? getFilteredUsers() :
                        activeTab === 'roles' ? getFilteredRoles() :
                        activeTab === 'jars' ? getFilteredJars() :
                        activeTab === 'maps' ? getFilteredMaps() :
                        getFilteredTags();
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  // Stats
  const vdpUsers = users.filter((u: GlobalElement) => u.authType === 'vdp' || !u.authType);
  const ldapUsers = users.filter((u: GlobalElement) => u.authType === 'ldap');
  const adminUsers = users.filter((u: GlobalElement) => u.userType === 'admin');

  // Role stats
  const serverAdminRoles = enhancedRoles.filter((r: any) => r.isCriticalAdmin);
  const adminRoles = enhancedRoles.filter((r: any) => r.isAdmin && !r.isCriticalAdmin);
  const otherRoles = enhancedRoles.filter((r: any) => !r.isAdmin);

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.gray50,
      padding: spacing.lg
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          background: colors.white,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          marginBottom: spacing.lg,
          boxShadow: shadows.sm,
          border: `1px solid ${colors.gray200}`
        }}>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              background: 'none',
              border: 'none',
              color: colors.gray600,
              fontSize: '14px',
              cursor: 'pointer',
              marginBottom: spacing.md,
              transition: 'color 0.2s ease',
              padding: spacing.xs
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.gray600;
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: borderRadius.md,
              background: `linear-gradient(135deg, ${colors.info} 0%, ${colors.infoLight} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white
            }}>
              <Users size={24} />
            </div>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: colors.gray900,
                margin: 0,
                lineHeight: 1.2
              }}>Global Statistics</h1>
              <p style={{
                fontSize: '14px',
                color: colors.gray600,
                margin: `${spacing.xs} 0 0 0`
              }}>
                Users, roles, and system-wide resources
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing.md,
          marginBottom: spacing.lg
        }}>
          {activeTab === 'users' ? (
            <>
              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.gray900,
                  lineHeight: 1
                }}>{users.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Total Users</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.accent,
                  lineHeight: 1
                }}>{vdpUsers.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>VDP Users</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.success,
                  lineHeight: 1
                }}>{ldapUsers.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>LDAP Users</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.error,
                  lineHeight: 1
                }}>{adminUsers.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Admin Users</div>
              </div>
            </>
          ) : activeTab === 'roles' ? (
            <>
              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.gray900,
                  lineHeight: 1
                }}>{roles.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Total Roles</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#dc2626',
                  lineHeight: 1
                }}>{serverAdminRoles.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Server Admin</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.warning,
                  lineHeight: 1
                }}>{adminRoles.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Admin Roles</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.info,
                  lineHeight: 1
                }}>{otherRoles.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Other Roles</div>
              </div>
            </>
          ) : activeTab === 'jars' ? (
            <>
              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.gray900,
                  lineHeight: 1
                }}>{jars.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Total JAR Files</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.success,
                  lineHeight: 1
                }}>{jars.filter((j: GlobalElement) => j.version).length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>With Version</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.accent,
                  lineHeight: 1
                }}>{jars.filter((j: GlobalElement) => j.fileType).length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>With Type</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.info,
                  lineHeight: 1
                }}>{jars.filter((j: GlobalElement) => j.filePath).length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>With Path</div>
              </div>
            </>
          ) : activeTab === 'maps' ? (
            <>
              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.gray900,
                  lineHeight: 1
                }}>{maps.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Total Maps</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.accent,
                  lineHeight: 1
                }}>{maps.filter((m: GlobalElement) => m.mapType === 'i18n').length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>i18n Maps</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.success,
                  lineHeight: 1
                }}>{maps.filter((m: GlobalElement) => m.country).length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>With Country</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.info,
                  lineHeight: 1
                }}>{maps.filter((m: GlobalElement) => m.timezone).length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>With Timezone</div>
              </div>
            </>
          ) : activeTab === 'tags' ? (
            <>
              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.gray900,
                  lineHeight: 1
                }}>{tags.length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Total Tags</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.accent,
                  lineHeight: 1
                }}>{tags.filter((t: GlobalElement) => t.tagType === 'single').length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Single Tags</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.success,
                  lineHeight: 1
                }}>{tags.filter((t: GlobalElement) => t.tagType === 'multiple').length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>Multiple Tags</div>
              </div>

              <div style={{
                background: colors.white,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                border: `1px solid ${colors.gray200}`,
                boxShadow: shadows.sm
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: colors.info,
                  lineHeight: 1
                }}>{tags.filter((t: GlobalElement) => t.description).length}</div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.gray600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: spacing.xs
                }}>With Description</div>
              </div>
            </>
          ) : null}
        </div>

        {/* Tabs */}
        <div style={{
          background: colors.white,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
          boxShadow: shadows.sm,
          border: `1px solid ${colors.gray200}`
        }}>
          <div style={{
            display: 'flex',
            gap: spacing.xs
          }}>
            <button
              onClick={() => setActiveTab('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.md}`,
                background: activeTab === 'users' ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'users' ? colors.white : colors.gray600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Users size={16} />
              <span>Users ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('roles')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.md}`,
                background: activeTab === 'roles' ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'roles' ? colors.white : colors.gray600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Shield size={16} />
              <span>Roles ({roles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('jars')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.md}`,
                background: activeTab === 'jars' ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'jars' ? colors.white : colors.gray600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Package size={16} />
              <span>JAR Files ({jars.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('maps')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.md}`,
                background: activeTab === 'maps' ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'maps' ? colors.white : colors.gray600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Map size={16} />
              <span>Maps ({maps.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('tags')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.md}`,
                background: activeTab === 'tags' ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'tags' ? colors.white : colors.gray600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Tag size={16} />
              <span>Tags ({tags.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('resourcemanager')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.md}`,
                background: activeTab === 'resourcemanager' ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'resourcemanager' ? colors.white : colors.gray600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Activity size={16} />
              <span>Resource Manager ({resourcePlans.length + resourceRules.length})</span>
            </button>
          </div>
        </div>

        {/* Users Content */}
        {activeTab === 'users' && (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            overflow: 'hidden'
          }}>
            {/* Filter Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
              padding: spacing.md,
              background: colors.gray50,
              borderBottom: `1px solid ${colors.gray200}`
            }}>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <button
                  onClick={() => setUserFilter('all')}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: userFilter === 'all' ? colors.accent : colors.white,
                    border: `1px solid ${userFilter === 'all' ? colors.accent : colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: userFilter === 'all' ? colors.white : colors.gray600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setUserFilter('vdp')}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: userFilter === 'vdp' ? colors.accent : colors.white,
                    border: `1px solid ${userFilter === 'vdp' ? colors.accent : colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: userFilter === 'vdp' ? colors.white : colors.gray600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  VDP ({vdpUsers.length})
                </button>
                <button
                  onClick={() => setUserFilter('ldap')}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: userFilter === 'ldap' ? colors.accent : colors.white,
                    border: `1px solid ${userFilter === 'ldap' ? colors.accent : colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: userFilter === 'ldap' ? colors.white : colors.gray600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  LDAP ({ldapUsers.length})
                </button>
              </div>

              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: spacing.sm,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.gray400
                  }}
                />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    background: colors.white,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{
                fontSize: '12px',
                color: colors.gray600,
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                Showing {filteredItems.length} user{filteredItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Users Table */}
            <div>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 3fr 1fr 1fr',
                gap: spacing.sm,
                padding: spacing.md,
                background: colors.gray100,
                borderBottom: `1px solid ${colors.gray200}`,
                fontSize: '11px',
                fontWeight: 600,
                color: colors.gray700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <div>Username</div>
                <div>Description</div>
                <div>Type</div>
                <div>Auth Method</div>
              </div>

              {/* Table Rows */}
              {paginatedItems.length > 0 ? (
                paginatedItems.map((user: GlobalElement, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 3fr 1fr 1fr',
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderBottom: `1px solid ${colors.gray200}`,
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.gray50;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: colors.gray900
                    }}>
                      {user.name}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.gray600
                    }}>
                      {user.description || '-'}
                    </div>
                    <div>
                      {user.userType === 'admin' ? (
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          background: colors.error,
                          color: colors.white,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600
                        }}>
                          ADMIN
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          background: colors.gray400,
                          color: colors.white,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600
                        }}>
                          USER
                        </span>
                      )}
                    </div>
                    <div>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        background: user.authType === 'ldap' ? colors.success : colors.accent,
                        color: colors.white,
                        borderRadius: borderRadius.sm,
                        fontWeight: 600
                      }}>
                        {(user.authType || 'vdp').toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: spacing.xxxl,
                  textAlign: 'center',
                  color: colors.gray500
                }}>
                  No users found
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                background: colors.gray50,
                borderTop: `1px solid ${colors.gray200}`
              }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div style={{
                  fontSize: '12px',
                  color: colors.gray600
                }}>
                  Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} users
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Roles Content */}
        {activeTab === 'roles' && (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            overflow: 'hidden'
          }}>
            {/* Filter Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
              padding: spacing.md,
              background: colors.gray50,
              borderBottom: `1px solid ${colors.gray200}`
            }}>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <button
                  onClick={() => setRoleFilter('all')}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: roleFilter === 'all' ? colors.accent : colors.white,
                    border: `1px solid ${roleFilter === 'all' ? colors.accent : colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: roleFilter === 'all' ? colors.white : colors.gray600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  All ({roles.length})
                </button>
                <button
                  onClick={() => setRoleFilter('serveradmin')}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: roleFilter === 'serveradmin' ? colors.error : colors.white,
                    border: `1px solid ${roleFilter === 'serveradmin' ? colors.error : colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: roleFilter === 'serveradmin' ? colors.white : colors.gray600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Server Admin ({serverAdminRoles.length})
                </button>
                <button
                  onClick={() => setRoleFilter('admin')}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: roleFilter === 'admin' ? colors.warning : colors.white,
                    border: `1px solid ${roleFilter === 'admin' ? colors.warning : colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: roleFilter === 'admin' ? colors.white : colors.gray600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Admin ({adminRoles.length})
                </button>
                <button
                  onClick={() => setRoleFilter('other')}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: roleFilter === 'other' ? colors.info : colors.white,
                    border: `1px solid ${roleFilter === 'other' ? colors.info : colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: roleFilter === 'other' ? colors.white : colors.gray600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Other ({otherRoles.length})
                </button>
              </div>

              <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                <Search size={16} style={{
                  position: 'absolute',
                  left: spacing.sm,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.gray400
                }} />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    background: colors.white,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{
                fontSize: '12px',
                color: colors.gray600,
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                Showing {filteredItems.length} role{filteredItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Roles Table */}
            <div>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 2.5fr 2fr',
                gap: spacing.sm,
                padding: spacing.md,
                background: colors.gray100,
                borderBottom: `1px solid ${colors.gray200}`,
                fontSize: '11px',
                fontWeight: 600,
                color: colors.gray700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <div>Name</div>
                <div>Type</div>
                <div>Privileges</div>
                <div>Description</div>
              </div>

              {/* Table Rows */}
              {paginatedItems.length > 0 ? (
                paginatedItems.map((role: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.5fr 2.5fr 2fr',
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderBottom: `1px solid ${colors.gray200}`,
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.gray50;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: colors.gray900
                    }}>
                      {role.name}
                    </div>
                    <div>
                      {role.isCriticalAdmin ? (
                        <span style={{
                          fontSize: '10px',
                          padding: '3px 8px',
                          background: '#dc2626',
                          color: colors.white,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          SERVER ADMIN
                        </span>
                      ) : role.isAdmin ? (
                        <span style={{
                          fontSize: '10px',
                          padding: '3px 8px',
                          background: colors.warning,
                          color: colors.white,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          ADMIN
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '10px',
                          padding: '3px 8px',
                          background: colors.gray400,
                          color: colors.white,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          ROLE
                        </span>
                      )}
                    </div>
                    <div>
                      {role.privileges && role.privileges.length > 0 ? (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px'
                        }}>
                          {role.privileges.map((priv: string, i: number) => (
                            <span key={i} style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: colors.gray200,
                              color: colors.gray700,
                              borderRadius: borderRadius.sm,
                              fontWeight: 500
                            }}>
                              {priv}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '13px', color: colors.gray500 }}>-</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.gray600
                    }}>
                      {role.description || '-'}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: spacing.xxxl,
                  textAlign: 'center',
                  color: colors.gray500
                }}>
                  No roles found
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                background: colors.gray50,
                borderTop: `1px solid ${colors.gray200}`
              }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div style={{
                  fontSize: '12px',
                  color: colors.gray600
                }}>
                  Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} roles
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* JAR Files Content */}
        {activeTab === 'jars' && (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            overflow: 'hidden'
          }}>
            {/* Filter Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
              padding: spacing.md,
              background: colors.gray50,
              borderBottom: `1px solid ${colors.gray200}`
            }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: spacing.sm,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.gray400
                  }}
                />
                <input
                  type="text"
                  placeholder="Search JAR files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    background: colors.white,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{
                fontSize: '12px',
                color: colors.gray600,
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                Showing {filteredItems.length} JAR file{filteredItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* JAR Table */}
            <div>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 2.5fr 2fr',
                gap: spacing.sm,
                padding: spacing.md,
                background: colors.gray100,
                borderBottom: `1px solid ${colors.gray200}`,
                fontSize: '11px',
                fontWeight: 600,
                color: colors.gray700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <div>Name</div>
                <div>Version</div>
                <div>Type</div>
                <div>Path</div>
                <div>Description</div>
              </div>

              {/* Table Rows */}
              {paginatedItems.length > 0 ? (
                paginatedItems.map((jar: GlobalElement, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 2.5fr 2fr',
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderBottom: `1px solid ${colors.gray200}`,
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.gray50;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: colors.gray900
                    }}>
                      {jar.name}
                    </div>
                    <div>
                      {jar.version ? (
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: colors.success,
                          color: colors.white,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600
                        }}>
                          v{jar.version}
                        </span>
                      ) : (
                        <span style={{ fontSize: '13px', color: colors.gray500 }}>-</span>
                      )}
                    </div>
                    <div>
                      {jar.fileType ? (
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: colors.gray300,
                          color: colors.gray700,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600
                        }}>
                          {jar.fileType}
                        </span>
                      ) : (
                        <span style={{ fontSize: '13px', color: colors.gray500 }}>-</span>
                      )}
                    </div>
                    <div>
                      {jar.filePath ? (
                        <code style={{
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          background: colors.gray100,
                          padding: '3px 6px',
                          borderRadius: borderRadius.sm,
                          color: colors.gray700,
                          wordBreak: 'break-all'
                        }}>
                          {jar.filePath}
                        </code>
                      ) : (
                        <span style={{ fontSize: '13px', color: colors.gray500 }}>-</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.gray600
                    }}>
                      {jar.description || '-'}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: spacing.xxxl,
                  textAlign: 'center',
                  color: colors.gray500
                }}>
                  No JAR files found
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                background: colors.gray50,
                borderTop: `1px solid ${colors.gray200}`
              }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div style={{
                  fontSize: '12px',
                  color: colors.gray600
                }}>
                  Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} JAR files
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Maps Content */}
        {activeTab === 'maps' && (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            overflow: 'hidden'
          }}>
            {/* Filter Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
              padding: spacing.md,
              background: colors.gray50,
              borderBottom: `1px solid ${colors.gray200}`
            }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: spacing.sm,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.gray400
                  }}
                />
                <input
                  type="text"
                  placeholder="Search maps..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    background: colors.white,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{
                fontSize: '12px',
                color: colors.gray600,
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                Showing {filteredItems.length} map{filteredItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Maps Table */}
            <div>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1fr 1.5fr 1.5fr',
                gap: spacing.sm,
                padding: spacing.md,
                background: colors.gray100,
                borderBottom: `1px solid ${colors.gray200}`,
                fontSize: '11px',
                fontWeight: 600,
                color: colors.gray700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <div>Name</div>
                <div>Database</div>
                <div>Type</div>
                <div>Country</div>
                <div>Timezone</div>
              </div>

              {/* Table Rows */}
              {paginatedItems.length > 0 ? (
                paginatedItems.map((map: GlobalElement, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 2fr 1fr 1.5fr 1.5fr',
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderBottom: `1px solid ${colors.gray200}`,
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.gray50;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: colors.gray900
                    }}>
                      {map.name}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.gray600
                    }}>
                      {map.database || '-'}
                    </div>
                    <div>
                      {map.mapType ? (
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: colors.accent,
                          color: colors.white,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          {map.mapType}
                        </span>
                      ) : (
                        <span style={{ fontSize: '13px', color: colors.gray500 }}>-</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.gray600
                    }}>
                      {map.country || '-'}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.gray600
                    }}>
                      {map.timezone || '-'}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: spacing.xxxl,
                  textAlign: 'center',
                  color: colors.gray500
                }}>
                  No maps found
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                background: colors.gray50,
                borderTop: `1px solid ${colors.gray200}`
              }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div style={{
                  fontSize: '12px',
                  color: colors.gray600
                }}>
                  Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} maps
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tags Content */}
        {activeTab === 'tags' && (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            overflow: 'hidden'
          }}>
            {/* Filter Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
              padding: spacing.md,
              background: colors.gray50,
              borderBottom: `1px solid ${colors.gray200}`
            }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: spacing.sm,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.gray400
                  }}
                />
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 36px`,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    background: colors.white,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{
                fontSize: '12px',
                color: colors.gray600,
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                Showing {filteredItems.length} tag{filteredItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Tags Table */}
            <div>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1fr 3fr',
                gap: spacing.sm,
                padding: spacing.md,
                background: colors.gray100,
                borderBottom: `1px solid ${colors.gray200}`,
                fontSize: '11px',
                fontWeight: 600,
                color: colors.gray700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <div>Name</div>
                <div>Type</div>
                <div>Description</div>
              </div>

              {/* Table Rows */}
              {paginatedItems.length > 0 ? (
                paginatedItems.map((tag: GlobalElement, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '3fr 1fr 3fr',
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderBottom: `1px solid ${colors.gray200}`,
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.gray50;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: colors.gray900
                    }}>
                      {tag.name}
                    </div>
                    <div>
                      {tag.tagType ? (
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: tag.tagType === 'single' ? colors.accent : colors.success,
                          color: colors.white,
                          borderRadius: borderRadius.sm,
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          {tag.tagType}
                        </span>
                      ) : (
                        <span style={{ fontSize: '13px', color: colors.gray500 }}>-</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.gray600
                    }}>
                      {tag.description || '-'}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: spacing.xxxl,
                  textAlign: 'center',
                  color: colors.gray500
                }}>
                  No tags found
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                background: colors.gray50,
                borderTop: `1px solid ${colors.gray200}`
              }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div style={{
                  fontSize: '12px',
                  color: colors.gray600
                }}>
                  Page {currentPage} of {totalPages} • Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} tags
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.white,
                    border: `1px solid ${colors.gray300}`,
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.gray700,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Resource Manager Content */}
        {activeTab === 'resourcemanager' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: spacing.lg
          }}>
            {/* Resource Rules Panel */}
            <div style={{
              background: colors.white,
              borderRadius: borderRadius.lg,
              boxShadow: shadows.sm,
              border: `1px solid ${colors.gray200}`,
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.md,
                background: colors.gray50,
                borderBottom: `1px solid ${colors.gray200}`
              }}>
                <Zap size={20} style={{ color: colors.accent }} />
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: colors.gray900,
                  margin: 0
                }}>Resource Rules ({resourceRules.length})</h3>
              </div>

              <div style={{
                padding: spacing.md,
                maxHeight: '600px',
                overflowY: 'auto'
              }}>
                {resourceRules.length > 0 ? (
                  resourceRules.map((rule: ResourceRule, index: number) => (
                    <div
                      key={index}
                      style={{
                        padding: spacing.md,
                        marginBottom: spacing.sm,
                        background: colors.gray50,
                        borderRadius: borderRadius.md,
                        border: `1px solid ${colors.gray200}`
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: spacing.xs
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: colors.gray900
                        }}>{rule.name}</span>
                        {rule.plan && (
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            background: colors.accent,
                            color: colors.white,
                            borderRadius: borderRadius.sm,
                            fontWeight: 600
                          }}>
                            → {rule.plan}
                          </span>
                        )}
                      </div>

                      {rule.description && (
                        <p style={{
                          fontSize: '13px',
                          color: colors.gray600,
                          margin: `${spacing.xs} 0`
                        }}>{rule.description}</p>
                      )}

                      {rule.condition && (
                        <div style={{ marginTop: spacing.xs }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: colors.gray700,
                            textTransform: 'uppercase'
                          }}>Condition:</span>
                          <code style={{
                            display: 'block',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            background: colors.gray100,
                            padding: spacing.xs,
                            borderRadius: borderRadius.sm,
                            marginTop: spacing.xs,
                            color: colors.gray700,
                            wordBreak: 'break-all'
                          }}>{rule.condition}</code>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{
                    padding: spacing.xxxl,
                    textAlign: 'center',
                    color: colors.gray500
                  }}>
                    <Zap size={32} style={{ color: colors.gray400, marginBottom: spacing.sm }} />
                    <p>No resource rules configured</p>
                  </div>
                )}
              </div>
            </div>

            {/* Resource Plans Panel */}
            <div style={{
              background: colors.white,
              borderRadius: borderRadius.lg,
              boxShadow: shadows.sm,
              border: `1px solid ${colors.gray200}`,
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.md,
                background: colors.gray50,
                borderBottom: `1px solid ${colors.gray200}`
              }}>
                <Activity size={20} style={{ color: colors.success }} />
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: colors.gray900,
                  margin: 0
                }}>Resource Plans ({resourcePlans.length})</h3>
              </div>

              <div style={{
                padding: spacing.md,
                maxHeight: '600px',
                overflowY: 'auto'
              }}>
                {resourcePlans.length > 0 ? (
                  resourcePlans.map((plan: ResourcePlan, index: number) => {
                    // Parse parameters if it's a JSON string
                    let parameters: any = null;
                    if (plan.parameters) {
                      try {
                        parameters = typeof plan.parameters === 'string'
                          ? JSON.parse(plan.parameters)
                          : plan.parameters;
                      } catch (e) {
                        parameters = null;
                      }
                    }

                    return (
                      <div
                        key={index}
                        style={{
                          padding: spacing.md,
                          marginBottom: spacing.sm,
                          background: colors.gray50,
                          borderRadius: borderRadius.md,
                          border: `1px solid ${colors.gray200}`
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: spacing.xs
                        }}>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: colors.gray900
                          }}>{plan.name}</span>
                          {parameters && (
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              background: colors.info,
                              color: colors.white,
                              borderRadius: borderRadius.sm,
                              fontWeight: 600
                            }}>
                              {Object.keys(parameters).length} params
                            </span>
                          )}
                        </div>

                        {plan.description && (
                          <p style={{
                            fontSize: '13px',
                            color: colors.gray600,
                            margin: `${spacing.xs} 0`
                          }}>{plan.description}</p>
                        )}

                        {plan.condition && (
                          <div style={{ marginTop: spacing.xs }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: colors.gray700,
                              textTransform: 'uppercase'
                            }}>Condition:</span>
                            <code style={{
                              display: 'block',
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              background: colors.gray100,
                              padding: spacing.xs,
                              borderRadius: borderRadius.sm,
                              marginTop: spacing.xs,
                              color: colors.gray700,
                              wordBreak: 'break-all'
                            }}>{plan.condition}</code>
                          </div>
                        )}

                        {parameters && (
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: spacing.xs,
                            marginTop: spacing.sm
                          }}>
                            {Object.entries(parameters).map(([key, value]) => (
                              <span
                                key={key}
                                style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  background: colors.gray200,
                                  color: colors.gray700,
                                  borderRadius: borderRadius.sm,
                                  fontWeight: 500
                                }}
                              >
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{
                    padding: spacing.xxxl,
                    textAlign: 'center',
                    color: colors.gray500
                  }}>
                    <Activity size={32} style={{ color: colors.gray400, marginBottom: spacing.sm }} />
                    <p>No resource plans configured</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
