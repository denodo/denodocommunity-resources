'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Database, Server, Search, ChevronLeft, ChevronRight, Settings } from 'lucide-react';

interface DataSource {
  id: number;
  name: string;
  type: string;
  database: string;
  url?: string;
  driver?: string;
  databaseName?: string;
  databaseVersion?: string;
  username?: string;
  vendor?: string;
  className?: string;
  classpath?: string;
  folder?: string;
  routeType?: string;
  webServiceType?: string;
  wsdlLocation?: string;
  serverName?: string;
  dsn?: string;
  connectionString?: string;
  properties?: any;
}

interface DataSourcesTabProps {
  datasources: DataSource[];
}

// Professional light color mapping
const getTechnologyColor = (type: string) => {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    'JDBC': { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    'ODBC': { bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca' },
    'Custom': { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    'JSON': { bg: '#f0fdf4', border: '#bbf7d0', text: '#065f46' },
    'XML': { bg: '#fdf2f8', border: '#fbcfe8', text: '#9f1239' },
    'LDAP': { bg: '#faf5ff', border: '#e9d5ff', text: '#5b21b6' },
    'WebService': { bg: '#ecfeff', border: '#a5f3fc', text: '#164e63' },
    'DelimitedFile': { bg: '#fefce8', border: '#fde047', text: '#713f12' },
    'Salesforce': { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a' },
    'SALESFORCE': { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a' },
    'MongoDB': { bg: '#d1fae5', border: '#6ee7b7', text: '#064e3b' },
    'MONGODB': { bg: '#d1fae5', border: '#6ee7b7', text: '#064e3b' }
  };
  return colorMap[type] || { bg: '#f9fafb', border: '#e5e7eb', text: '#374151' };
};

export default function DataSourcesTab({ datasources }: DataSourcesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Group datasources by type
  const groupedByType = useMemo(() => {
    const groups: Record<string, DataSource[]> = {};
    datasources.forEach(ds => {
      const type = ds.type || 'Unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(ds);
    });
    return groups;
  }, [datasources]);

  // Get type tabs with counts
  const typeTabs = useMemo(() => {
    return Object.entries(groupedByType)
      .map(([type, items]) => ({ type, count: items.length }))
      .sort((a, b) => b.count - a.count);
  }, [groupedByType]);

  // Filter datasources
  const filteredDatasources = useMemo(() => {
    // Start with datasources filtered by type
    let filtered = selectedType === 'all'
      ? datasources
      : (groupedByType[selectedType] || []);

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(ds =>
        ds.name?.toLowerCase().includes(search) ||
        ds.type?.toLowerCase().includes(search) ||
        ds.databaseName?.toLowerCase().includes(search) ||
        ds.databaseVersion?.toLowerCase().includes(search) ||
        ds.classpath?.toLowerCase().includes(search) ||
        ds.className?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [datasources, selectedType, searchTerm, groupedByType]);

  // Pagination logic
  const totalPages = Math.ceil(filteredDatasources.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDatasources = filteredDatasources.slice(startIndex, endIndex);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType]);

  if (datasources.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        textAlign: 'center',
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <Database size={48} color="#9ca3af" />
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#1f2937',
          marginTop: '16px',
          marginBottom: '8px'
        }}>No Data Sources</h3>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          This database doesn't have any configured data sources
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      {/* Compact Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={18} color="#3b82f6" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
              {datasources.length}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
              Total Sources
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: '#faf5ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Settings size={18} color="#8b5cf6" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
              {typeTabs.length}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
              Types
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Server size={18} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
              {typeTabs[0]?.type || 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
              Top Type ({typeTabs[0]?.count || 0})
            </div>
          </div>
        </div>
      </div>

      {/* Technology Type Filters */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '12px',
        overflowX: 'auto',
        padding: '2px'
      }}>
        <button
          onClick={() => setSelectedType('all')}
          style={{
            padding: '6px 12px',
            background: selectedType === 'all' ? '#111827' : 'white',
            color: selectedType === 'all' ? 'white' : '#6b7280',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s'
          }}
        >
          All ({datasources.length})
        </button>
        {typeTabs.map(({ type, count }) => {
          const colors = getTechnologyColor(type);
          const isActive = selectedType === type;

          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '6px 12px',
                background: isActive ? colors.bg : 'white',
                color: isActive ? colors.text : '#6b7280',
                border: `1px solid ${isActive ? colors.border : '#e5e7eb'}`,
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              {type} ({count})
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div style={{
        position: 'relative',
        marginBottom: '16px'
      }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9ca3af'
          }}
        />
        <input
          type="text"
          placeholder="Search by name, type, version, classpath..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '40px',
            paddingRight: '16px',
            paddingTop: '8px',
            paddingBottom: '8px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '13px',
            backgroundColor: 'white'
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        marginBottom: '16px'
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
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Data Source Name</th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Type</th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Version</th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  minWidth: '300px'
                }}>Classpath</th>
              </tr>
            </thead>
            <tbody style={{
              backgroundColor: 'white'
            }}>
              {paginatedDatasources.map((ds, index) => {
                const colors = getTechnologyColor(ds.type);
                const classpath = ds.classpath || ds.className || '-';
                const version = ds.databaseVersion || '-';

                return (
                  <tr
                    key={ds.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 150ms'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <td style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      color: '#111827',
                      fontWeight: 600
                    }}>
                      {ds.name}
                    </td>
                    <td style={{
                      padding: '12px 16px'
                    }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {ds.type}
                      </span>
                    </td>
                    <td style={{
                      padding: '12px 16px'
                    }}>
                      {version !== '-' ? (
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: '#eff6ff',
                          color: '#1e40af',
                          borderRadius: '4px',
                          fontWeight: 600,
                          border: '1px solid #bfdbfe'
                        }}>
                          v{version}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '13px',
                          color: '#9ca3af'
                        }}>-</span>
                      )}
                    </td>
                    <td style={{
                      padding: '12px 16px'
                    }}>
                      {classpath !== '-' ? (
                        <code style={{
                          fontSize: '11px',
                          color: '#374151',
                          background: '#f3f4f6',
                          padding: '3px 6px',
                          borderRadius: '3px',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          display: 'block'
                        }}>
                          {classpath}
                        </code>
                      ) : (
                        <span style={{
                          fontSize: '13px',
                          color: '#9ca3af'
                        }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {paginatedDatasources.length === 0 && filteredDatasources.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            textAlign: 'center'
          }}>
            <Search size={40} color="#9ca3af" />
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1f2937',
              marginTop: '12px',
              marginBottom: '4px'
            }}>No results found</h3>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px'
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
            Page {currentPage} of {totalPages} ({filteredDatasources.length} datasources)
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
        fontSize: '12px',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        Showing {startIndex + 1}-{Math.min(endIndex, filteredDatasources.length)} of {filteredDatasources.length} filtered datasources ({datasources.length} total)
      </div>
    </div>
  );
}
