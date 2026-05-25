'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, Server, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { duckdb } from '@/lib/database/duckdb-client';
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection-service';
import { colors, spacing, borderRadius, shadows, typography } from '@/lib/theme';

type JdbcDuplicateRow = {
  id: number;
  type: string;
  connectionString: string;
  count: number;
  sources: any; // JSON
  analysisId?: string;
};

export default function DuplicatesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<JdbcDuplicateRow[]>([]);
  const [jsonDuplicates, setJsonDuplicates] = useState<JdbcDuplicateRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'jdbc' | 'json'>('jdbc');

  useEffect(() => {
    const run = async () => {
      try {
        // Ensure DuckDB is ready
        await duckdb.waitForInitialization();
        // Try to refresh in-memory DB from OPFS Parquet in case another instance saved data
        try {
          const anyDuck: any = duckdb as any;
          if (typeof anyDuck.loadFromParquet === 'function') {
            await anyDuck.loadFromParquet();
          }
        } catch {}

        // Try to load existing JDBC duplicates
        let rows = await duckdb.query<JdbcDuplicateRow>(
          "SELECT id, type, connection_string, count, sources, analysis_id FROM duplicates WHERE type = 'jdbc' ORDER BY count DESC"
        );
        let rowsJson = await duckdb.query<JdbcDuplicateRow>(
          "SELECT id, type, connection_string, count, sources, analysis_id FROM duplicates WHERE type = 'json' ORDER BY count DESC"
        );

        // De-duplicate by connectionString + type to avoid repeats
        const uniq = (arr: any[]) => { const m = new Map<string, any>(); arr.forEach((r: any) => { const key = String((r as any).connectionString || '') + '::' + String((r as any).type || ''); if (!m.has(key)) m.set(key, r); }); return Array.from(m.values()); };
        setDuplicates(uniq(rows).map(r => ({
          id: (r as any).id,
          type: (r as any).type,
          connectionString: (r as any).connectionString,
          count: (r as any).count,
          sources: parseJsonSafe((r as any).sources),
          analysisId: (r as any).analysisId,
        })));
        setJsonDuplicates(uniq(rowsJson).map(r => ({
          id: (r as any).id,
          type: (r as any).type,
          connectionString: (r as any).connectionString,
          count: (r as any).count,
          sources: parseJsonSafe((r as any).sources),
          analysisId: (r as any).analysisId,
        })));
      } catch (e: any) {
        setError(e?.message || 'Failed to load duplicates');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const totalJdbcConnections = useMemo(() => duplicates.reduce((sum, d) => sum + (d?.count || 0), 0), [duplicates]);
  const totalJsonConnections = useMemo(() => jsonDuplicates.reduce((sum, d) => sum + (d?.count || 0), 0), [jsonDuplicates]);

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
          <p style={{ fontSize: '14px', color: colors.gray600 }}>Loading duplicate analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: colors.gray50
      }}>
        <div style={{
          background: colors.white,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: shadows.sm,
          border: `1px solid ${colors.gray200}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            marginBottom: spacing.md
          }}>
            <AlertTriangle size={24} color={colors.error} />
            <h2 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: colors.gray900,
              margin: 0
            }}>Error Loading Data</h2>
          </div>
          <p style={{
            fontSize: '14px',
            color: colors.gray600,
            marginBottom: spacing.md
          }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: `${spacing.sm} ${spacing.lg}`,
              backgroundColor: colors.accent,
              color: colors.white,
              borderRadius: borderRadius.md,
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
              background: `linear-gradient(135deg, ${colors.error} 0%, ${colors.errorLight} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white
            }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: colors.gray900,
                margin: 0,
                lineHeight: 1.2
              }}>Duplicate Connection Analysis</h1>
              <p style={{
                fontSize: '14px',
                color: colors.gray600,
                margin: `${spacing.xs} 0 0 0`
              }}>
                JDBC and JSON duplicates grouped by connection string
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: spacing.md,
          marginBottom: spacing.lg
        }}>
          {activeTab === 'jdbc' ? (
            <>
              <StatCard icon={<AlertTriangle size={28} />} label="Total JDBC Duplicates" value={totalJdbcConnections} color={colors.error} />
              <StatCard icon={<Database size={28} />} label="JDBC Groups" value={duplicates.length} color={colors.accent} />
            </>
          ) : (
            <>
              <StatCard icon={<AlertTriangle size={28} />} label="Total JSON Duplicates" value={totalJsonConnections} color={colors.error} />
              <StatCard icon={<Database size={28} />} label="JSON Groups" value={jsonDuplicates.length} color={colors.success} />
            </>
          )}
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
              onClick={() => setActiveTab('jdbc')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.md}`,
                background: activeTab === 'jdbc' ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'jdbc' ? colors.white : colors.gray600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Server size={16} />
              <span>JDBC ({duplicates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('json')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.md}`,
                background: activeTab === 'json' ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === 'json' ? colors.white : colors.gray600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Database size={16} />
              <span>JSON ({jsonDuplicates.length})</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'jdbc' && duplicates.length === 0 ? (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            padding: spacing.xxxl,
            textAlign: 'center'
          }}>
            <AlertTriangle size={48} color={colors.gray400} />
            <div style={{ fontWeight: 600, color: colors.gray900, marginTop: spacing.md, fontSize: '16px' }}>
              No JDBC duplicates found
            </div>
            <div style={{ color: colors.gray600, marginTop: spacing.xs, fontSize: '14px' }}>
              Upload a VQL with properties to analyze duplicates.
            </div>
          </div>
        ) : activeTab === 'jdbc' ? (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            overflow: 'hidden'
          }}>
            <div style={{ padding: spacing.md }}>
              {duplicates.map((dup, idx) => {
                const key = dup.connectionString || String(dup.id);
                const isOpen = !!expanded[key];
                const grouped = groupByDatabase(dup.sources || []);
                const isLast = idx === duplicates.length - 1;

                return (
                    <div
                        key={dup.id}
                        style={{
                          borderBottom: isLast ? 'none' : `1px solid ${colors.gray200}`,
                        }}
                      >
                    <div
                      onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: spacing.md,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = colors.gray50;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flex: 1 }}>
                        <span style={{ color: colors.gray600 }}>
                          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </span>
                        <span style={{ color: colors.accent }}>
                          <Server size={18} />
                        </span>
                        <code style={{
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          color: colors.gray900,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 600
                        }}>{dup.connectionString}</code>
                      </div>
                      <span style={{
                        background: colors.error,
                        color: colors.white,
                        borderRadius: borderRadius.md,
                        padding: `${spacing.xs} ${spacing.sm}`,
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}>{dup.count} duplicates</span>
                    </div>
                    {isOpen && (
                      <div style={{ paddingLeft: spacing.xl, paddingRight: spacing.md, paddingBottom: spacing.md }}>
                        {Object.entries(grouped).map(([db, items]) => (
                          <div key={db} style={{
                            padding: spacing.md,
                            background: colors.gray50,
                            borderRadius: borderRadius.md,
                            marginBottom: spacing.sm
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: spacing.sm
                            }}>
                              <span style={{ fontWeight: 600, color: colors.gray900, fontSize: '14px' }}>{db}</span>
                              <span style={{
                                background: colors.gray300,
                                color: colors.gray700,
                                borderRadius: borderRadius.sm,
                                padding: `2px ${spacing.sm}`,
                                fontSize: '11px',
                                fontWeight: 600
                              }}>{items.length} sources</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                              {items.map((s, i) => (
                                <div key={i} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: spacing.xs,
                                  color: colors.gray700,
                                  fontSize: '13px'
                                }}>
                                  <Database size={14} color={colors.info} />
                                  <span style={{ marginLeft: spacing.sm, fontWeight: 500 }}>
                                    {s.dataSourceName || s.name || 'Unknown'}
                                  </span>
                                  {s.username !== undefined && (
                                    <span style={{
                                      marginLeft: spacing.sm,
                                      color: colors.gray500,
                                      fontSize: '12px'
                                    }}>
                                      [{String(s.username) || 'username not available'}]
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : jsonDuplicates.length === 0 ? (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            padding: spacing.xxxl,
            textAlign: 'center'
          }}>
            <AlertTriangle size={48} color={colors.gray400} />
            <div style={{ fontWeight: 600, color: colors.gray900, marginTop: spacing.md, fontSize: '16px' }}>
              No JSON duplicates found
            </div>
            <div style={{ color: colors.gray600, marginTop: spacing.xs, fontSize: '14px' }}>
              Upload a VQL with properties to analyze duplicates.
            </div>
          </div>
        ) : (
          <div style={{
            background: colors.white,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.gray200}`,
            overflow: 'hidden'
          }}>
            <div style={{ padding: spacing.md }}>
              {jsonDuplicates.map((dup, idx) => {
                const key = `json-${dup.connectionString || String(dup.id)}`;
                const isOpen = !!expanded[key];
                const grouped = groupByDatabase(dup.sources || []);
                const isLast = idx === jsonDuplicates.length - 1;
                
                return (
                    <div
                      key={key}
                      style={{
                        borderBottom: isLast ? 'none' : `1px solid ${colors.gray200}`,
                      }}
                    >
                    <div
                      onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: spacing.md,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = colors.gray50;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flex: 1 }}>
                        <span style={{ color: colors.gray600 }}>
                          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </span>
                        <span style={{ color: colors.success }}>
                          <Database size={18} />
                        </span>
                        <code style={{
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          color: colors.gray900,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 600
                        }}>{dup.connectionString}</code>
                      </div>
                      <span style={{
                        background: colors.success,
                        color: colors.white,
                        borderRadius: borderRadius.md,
                        padding: `${spacing.xs} ${spacing.sm}`,
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}>{dup.count} duplicates</span>
                    </div>
                    {isOpen && (
                      <div style={{ paddingLeft: spacing.xl, paddingRight: spacing.md, paddingBottom: spacing.md }}>
                        {Object.entries(grouped).map(([db, items]) => (
                          <div key={db} style={{
                            padding: spacing.md,
                            background: colors.gray50,
                            borderRadius: borderRadius.md,
                            marginBottom: spacing.sm
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: spacing.sm
                            }}>
                              <span style={{ fontWeight: 600, color: colors.gray900, fontSize: '14px' }}>{db}</span>
                              <span style={{
                                background: colors.gray300,
                                color: colors.gray700,
                                borderRadius: borderRadius.sm,
                                padding: `2px ${spacing.sm}`,
                                fontSize: '11px',
                                fontWeight: 600
                              }}>{items.length} sources</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                              {items.map((s, i) => (
                                <div key={i} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: spacing.xs,
                                  color: colors.gray700,
                                  fontSize: '13px'
                                }}>
                                  <Database size={14} color={colors.success} />
                                  <span style={{ marginLeft: spacing.sm, fontWeight: 500 }}>
                                    {s.dataSourceName || s.name || 'Unknown'}
                                  </span>
                                  {s.username !== undefined && (
                                    <span style={{
                                      marginLeft: spacing.sm,
                                      color: colors.gray500,
                                      fontSize: '12px'
                                    }}>
                                      [{String(s.username) || 'username not available'}]
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function parseJsonSafe(v: any) {
  if (v == null) return [];
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return []; }
  }
  return v;
}

function groupByDatabase(sources: any[]) {
  const map: Record<string, any[]> = {};
  for (const s of sources) {
    const db = s.databaseName || s.database || 'Unknown Database';
    (map[db] ||= []).push(s);
  }
  return map;
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div style={{
      background: colors.white,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      border: `1px solid ${colors.gray200}`,
      boxShadow: shadows.sm,
      transition: 'all 0.2s ease'
    }}>
      <div style={{
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.gray50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color || colors.primarySolid
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '28px',
          fontWeight: 700,
          color: colors.gray900,
          lineHeight: 1,
          marginBottom: '4px'
        }}>{value.toLocaleString()}</div>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: colors.gray600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>{label}</div>
      </div>
    </div>
  );
}
