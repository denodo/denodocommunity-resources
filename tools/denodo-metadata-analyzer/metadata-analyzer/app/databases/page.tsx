'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatabaseMetrics {
  views: number;
  dataSources: number;
  baseViews: number;
  derivedViews: number;
  interfaceViews: number;
  cachedViews: number;
  associations: number;
  cachePercentage: number | string;
}

interface DatabaseRow {
  name: string;
  isSystemDatabase?: boolean;
  metrics: DatabaseMetrics;
  statsEnabledCount?: number;
  cacheEnabled?: boolean;
  cacheDatasource?: string | null;
}

export default function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<DatabaseRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    try {
      const { duckdb } = await import('@/lib/database/duckdb-client');
      await duckdb.waitForInitialization();

      // Check if database_stats table has data, if not rebuild it
      const statsCount = await duckdb.query('SELECT COUNT(*) as count FROM database_stats');
      if (statsCount[0].count === 0) {
        console.log('[VDB Breakdown] database_stats is empty, rebuilding...');
        await duckdb.rebuildDatabaseStats();
      }

      // Use pre-calculated database_stats table for instant loading (10-100x faster)
      const databasesQuery = `
        SELECT
          ds.database as name,
          ds.data_sources as dataSources,
          ds.total_views as totalViews,
          ds.base_views as baseViews,
          ds.derived_views as derivedViews,
          ds.interface_views as interfaceViews,
          ds.cached_views as cachedViews,
          ds.associations as associations
        FROM database_stats ds
        ORDER BY ds.database
      `;

      const dbResults = await duckdb.query(databasesQuery);

      // Load database-level cache settings (from ALTER DATABASE .. CACHE)
      let cacheMap: Record<string, { enabled: boolean; datasource: string | null }> = {};
      try {
        const cacheRows = await duckdb.query(
          `SELECT database, enabled, datasource FROM database_cache`
        );
        (cacheRows as any[]).forEach((row: any) => {
          const db = (row.database || row.DATABASE || '').toString();
          if (!db) return;
          cacheMap[db] = { enabled: !!row.enabled, datasource: row.datasource || null };
        });
      } catch (e) {
        console.log('[VDB Breakdown] database_cache not available, skipping DB-level cache highlight');
      }

      // Build map of stats-enabled counts per database (gracefully handle if table not present)
      let statsEnabledMap: Record<string, number> = {};
      try {
        const statsRows = await duckdb.query(
          `SELECT database, COUNT(*) as count FROM view_stats WHERE enabled = true GROUP BY database`
        );
        statsRows.forEach((row: any) => {
          const db = (row as any).database;
          const count = Number((row as any).count || 0);
          if (db) statsEnabledMap[db] = count;
        });
      } catch (e) {
        // view_stats table not available; leave map empty
        console.log('[VDB Breakdown] view_stats not available, skipping stats badge');
      }

      const databasesWithMetrics = dbResults.map((db: any) => {
        const totalViews = Number(db.totalViews || 0);
        const cachedViews = Number(db.cachedViews || 0);

        let cachePercentage: number | string = 0;
        if (totalViews > 0) {
          const exactPercentage = (cachedViews / totalViews) * 100;
          cachePercentage = cachedViews > 0 && exactPercentage < 0.5 ? '<1' : Math.round(exactPercentage);
        }

        const cacheInfo = cacheMap[db.name] || { enabled: false, datasource: null };

        return {
          name: db.name,
          isSystemDatabase: db.name === 'admin',
          metrics: {
            views: totalViews,
            dataSources: Number(db.dataSources || 0),
            baseViews: Number(db.baseViews || 0),
            derivedViews: Number(db.derivedViews || 0),
            interfaceViews: Number(db.interfaceViews || 0),
            cachedViews: cachedViews,
            associations: Number(db.associations || 0),
            cachePercentage: cachePercentage
          },
          statsEnabledCount: statsEnabledMap[db.name] || 0,
          cacheEnabled: cacheInfo.enabled,
          cacheDatasource: cacheInfo.datasource
        };
      });

      setDatabases(databasesWithMetrics);
    } catch (error) {
      console.error('Failed to load databases:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDatabases = databases.filter(db => {
    const matchesSearch = db.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    if (filterType === 'cached') {
      const percentage = typeof db.metrics.cachePercentage === 'string' ? 0.1 : db.metrics.cachePercentage;
      return matchesSearch && percentage > 0;
    }
    if (filterType === 'uncached') {
      const percentage = typeof db.metrics.cachePercentage === 'string' ? 0.1 : db.metrics.cachePercentage;
      return matchesSearch && percentage === 0;
    }

    return matchesSearch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredDatabases.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDatabases = filteredDatabases.slice(startIndex, endIndex);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '2px solid #3498db',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }}></div>
          <p style={{ fontSize: '14px', color: '#666' }}>Loading databases...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      {/* Modern Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1a1a1a',
          marginBottom: '4px'
        }}>VDB Breakdown</h1>
        <p style={{
          fontSize: '14px',
          color: '#666'
        }}>
          Detailed view of all {databases.length} virtual databases
        </p>
      </div>

      {/* Modern Search Bar */}
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        gap: '12px'
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '448px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#999'
            }}
          />
          <input
            type="text"
            placeholder="Search databases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '40px',
              paddingRight: '16px',
              paddingTop: '8px',
              paddingBottom: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: 'white'
            }}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: 'white'
          }}
        >
          <option value="all">All Databases</option>
          <option value="cached">With Cache</option>
          <option value="uncached">No Cache</option>
        </select>
      </div>

      {/* Ultra Modern Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{
                background: 'linear-gradient(to right, #f9fafb, #f3f4f6)',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Database Name</th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Data Sources</th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Base Views</th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Derived Views</th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Interface Views</th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Cached Views</th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Associations</th>
                <th style={{
                  padding: '16px 24px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Total Views</th>
              </tr>
            </thead>
            <tbody style={{
              backgroundColor: 'white'
            }}>
              {paginatedDatabases.map((db) => {
                const isSystemDb = db.isSystemDatabase || db.name === 'admin';
                const cachePercentage = typeof db.metrics.cachePercentage === 'string'
                  ? db.metrics.cachePercentage
                  : db.metrics.cachePercentage;

                return (
                  <tr
                    key={db.name}
                    onClick={() => router.push(`/databases/${encodeURIComponent(db.name)}`)}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      transition: 'background-color 150ms'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <td style={{
                      padding: '16px 24px',
                      whiteSpace: 'nowrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: db.cacheEnabled ? '#dcfce7' : '#dbeafe',
                          flexShrink: 0,
                          border: db.cacheEnabled ? '1px solid #86efac' : undefined
                        }}>
                          <Database size={16} color={db.cacheEnabled ? '#16a34a' : '#2563eb'} />
                        </div>
                        <div style={{ marginLeft: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#111827'
                            }}>{db.name}</div>
                            {/* Removed Cache Enabled badge per request */}
                            {!!(db.statsEnabledCount && db.statsEnabledCount > 0) && (
                              <span
                                title={`${db.statsEnabledCount} view(s) with stats enabled`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: '#e0f2fe',
                                  border: '1px solid #bae6fd',
                                  color: '#075985',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px'
                                }}
                              >
                                Stats Enabled
                              </span>
                            )}
                          </div>
                          {isSystemDb && (
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280'
                            }}>System Database</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#111827'
                      }}>{db.metrics.dataSources}</span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#111827'
                      }}>{db.metrics.baseViews}</span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#111827'
                      }}>{db.metrics.derivedViews}</span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#111827'
                      }}>{db.metrics.interfaceViews}</span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#111827'
                        }}>{db.metrics.cachedViews}</span>
                        {(typeof cachePercentage === 'string' || cachePercentage > 0) && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#d1fae5',
                            color: '#065f46'
                          }}>
                            {cachePercentage}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#111827'
                      }}>{db.metrics.associations}</span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      whiteSpace: 'nowrap',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#2563eb'
                      }}>{db.metrics.views}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {paginatedDatabases.length === 0 && filteredDatabases.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '48px'
          }}>
            <Database size={48} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '4px'
            }}>No databases found</h3>
            <p style={{
              fontSize: '14px',
              color: '#6b7280'
            }}>
              {searchTerm || filterType !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'No databases were found in the uploaded VQL file'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              color: currentPage === 1 ? '#9ca3af' : '#374151',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 1) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 1) {
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <span style={{
            fontSize: '14px',
            color: '#6b7280',
            fontWeight: 500
          }}>
            Page {currentPage} of {totalPages} ({filteredDatabases.length} databases)
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              color: currentPage === totalPages ? '#9ca3af' : '#374151',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== totalPages) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== totalPages) {
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '14px',
        color: '#6b7280'
      }}>
        <span>
          Showing {startIndex + 1}-{Math.min(endIndex, filteredDatabases.length)} of {filteredDatabases.length} filtered databases ({databases.length} total)
        </span>
        <span style={{ fontSize: '12px' }}>Click any row to view detailed information</span>
      </div>
    </div>
  );
}
