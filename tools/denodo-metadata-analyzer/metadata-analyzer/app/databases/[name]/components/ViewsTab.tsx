'use client';

import React, { useState, useMemo } from 'react';
import { Database, Eye, Layers, Search, ChevronDown, ChevronUp, BarChart3, Shield, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface View {
  id: number;
  name: string;
  kind: string;
  database: string;
  folder?: string;
  cache_status?: string;
  select_body?: string;
  implementation?: string;
  properties?: any;
}

interface ViewsTabProps {
  views: View[];
  viewStats?: Record<string, boolean>;
  viewCache?: Record<string, string>;
}

// Professional light color mapping for view types
const getViewTypeConfig = (kind: string) => {
  const configs: Record<string, { bg: string; border: string; text: string; label: string; badge: string }> = {
    'table': {
      bg: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      label: 'Base View',
      badge: 'B'
    },
    'view': {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#065f46',
      label: 'Derived View',
      badge: 'D'
    },
    'interface view': {
      bg: '#fdf4ff',
      border: '#f0abfc',
      text: '#86198f',
      label: 'Interface View',
      badge: 'I'
    }
  };
  return configs[kind] || {
    bg: '#f9fafb',
    border: '#e5e7eb',
    text: '#374151',
    label: kind,
    badge: 'V'
  };
};

// Cache status colors
const getCacheStatusConfig = (cache_status?: string) => {
  if (cache_status === 'full') return { bg: '#dcfce7', text: '#166534', label: 'Full Cache' };
  if (cache_status === 'partial') return { bg: '#fef3c7', text: '#92400e', label: 'Partial Cache' };
  return { bg: '#f3f4f6', text: '#6b7280', label: 'No Cache' };
};

const ViewsTab: React.FC<ViewsTabProps> = ({ views, viewStats = {}, viewCache = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('base');
  const [expandedView, setExpandedView] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [onlyStatsEnabled, setOnlyStatsEnabled] = useState(false);
  const itemsPerPage = 50;

  // Calculate view counts by type
  const viewCounts = useMemo(() => {
    return {
      all: views.length,
      base: views.filter(v => v.kind === 'table').length,
      derived: views.filter(v => v.kind === 'view').length,
      interface: views.filter(v => v.kind === 'interface view').length,
    };
  }, [views]);

  // Filter views
  const filteredViews = useMemo(() => {
    let filtered = views;

    // Apply type filter
    if (activeFilter === 'base') {
      filtered = filtered.filter(v => v.kind === 'table');
    } else if (activeFilter === 'derived') {
      filtered = filtered.filter(v => v.kind === 'view');
    } else if (activeFilter === 'interface') {
      filtered = filtered.filter(v => v.kind === 'interface view');
    }

    // Apply stats-enabled filter (only for base/derived)
    if (onlyStatsEnabled && (activeFilter === 'base' || activeFilter === 'derived')) {
      filtered = filtered.filter(v => !!viewStats[v.name]);
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.folder?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [views, activeFilter, searchTerm, onlyStatsEnabled, viewStats]);

  // Pagination
  const totalPages = Math.ceil(filteredViews.length / itemsPerPage);
  const paginatedViews = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredViews.slice(start, start + itemsPerPage);
  }, [filteredViews, currentPage]);

  // Reset to page 1 when filter/search/stats-toggle changes
  useMemo(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, onlyStatsEnabled]);

  // Extract interface view mappings
  const interfaceMappings = useMemo(() => {
    const interfaceViews = views.filter(v => v.kind === 'interface view');

    return interfaceViews.map(v => ({
      id: v.id,
      interfaceView: v.name,
      implementation: v.implementation || '-',
      folder: v.folder
    }));
  }, [views]);

  const toggleViewExpansion = (viewId: number) => {
    setExpandedView(expandedView === viewId ? null : viewId);
  };

  return (
    <div style={{ padding: '0' }}>
      {/* Filter Pills */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <FilterPill
          label="Base"
          count={viewCounts.base}
          active={activeFilter === 'base'}
          onClick={() => setActiveFilter('base')}
          color="#2563eb"
        />
        <FilterPill
          label="Derived"
          count={viewCounts.derived}
          active={activeFilter === 'derived'}
          onClick={() => setActiveFilter('derived')}
          color="#059669"
        />
        <FilterPill
          label="Interface"
          count={viewCounts.interface}
          active={activeFilter === 'interface'}
          onClick={() => setActiveFilter('interface')}
          color="#9333ea"
        />

        {/* Search */}
        <div style={{
          marginLeft: 'auto',
          position: 'relative',
          minWidth: '240px'
        }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af'
            }}
          />
          <input
            type="text"
            placeholder="Search views..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 34px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        {/* Stats Enabled toggle (only relevant for Base/Derived) */}
        <label
          title="Show only views with statistics enabled"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '12px',
            color: (activeFilter === 'base' || activeFilter === 'derived') ? '#111827' : '#9ca3af',
            backgroundColor: '#fff',
            cursor: (activeFilter === 'base' || activeFilter === 'derived') ? 'pointer' : 'not-allowed'
          }}
        >
          <input
            type="checkbox"
            disabled={!(activeFilter === 'base' || activeFilter === 'derived')}
            checked={onlyStatsEnabled}
            onChange={(e) => setOnlyStatsEnabled(e.target.checked)}
          />
          Only Stats Enabled
        </label>
      </div>

      {/* Results count */}
      <div style={{
        marginBottom: '12px',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        {activeFilter === 'interface'
          ? `Showing ${((currentPage - 1) * itemsPerPage) + 1}-${Math.min(currentPage * itemsPerPage, filteredViews.length)} of ${filteredViews.length} interface mapping${filteredViews.length !== 1 ? 's' : ''}`
          : `${filteredViews.length} view${filteredViews.length !== 1 ? 's' : ''}`
        }
        {searchTerm && ` matching "${searchTerm}"`}
        {(onlyStatsEnabled && (activeFilter === 'base' || activeFilter === 'derived')) && ' • only stats enabled'}
      </div>

      {/* Interface Views - Table View */}
      {activeFilter === 'interface' ? (
        filteredViews.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#9ca3af',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <Shield size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: '14px' }}>
              {searchTerm ? 'No interface view mappings found matching your search' : 'No interface view mappings'}
            </div>
          </div>
        ) : (
          <>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={headerStyle}>Interface View Name</th>
                    <th style={headerStyle}>Folder</th>
                    <th style={headerStyle}>Implementation View Name</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedViews.map((view, idx) => {
                    // Use direct implementation field from DuckDB, not from properties
                    const implementation = view.implementation || '-';

                    // DEBUG: Log what we're displaying (only first 3)
                    if (idx < 3) {
                      console.log(`[ViewsTab Display] ${view.name}: implementation = "${implementation}"`);
                    }

                    return (
                      <tr
                        key={view.id}
                        style={{
                          borderBottom: idx < paginatedViews.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <td style={cellStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{
                              fontWeight: '500',
                              color: '#111827',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <Shield size={14} style={{ color: '#a855f7', flexShrink: 0 }} />
                              {view.name}
                            </div>
                          </div>
                        </td>
                        <td style={cellStyle}>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{view.folder || '-'}</div>
                        </td>
                        <td style={cellStyle}>
                          <div style={{
                            fontSize: '13px',
                            color: '#374151',
                            fontFamily: 'Monaco, Consolas, monospace',
                            fontWeight: '500'
                          }}>
                            {implementation}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination for interface views */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                padding: '12px 0'
              }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Page {currentPage} of {totalPages}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    style={getButtonStyle(currentPage === 1)}
                    title="First page"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={getButtonStyle(currentPage === 1)}
                    title="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    color: '#111827',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {currentPage} / {totalPages}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={getButtonStyle(currentPage === totalPages)}
                    title="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    style={getButtonStyle(currentPage === totalPages)}
                    title="Last page"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )
      ) : activeFilter === 'base' || activeFilter === 'derived' ? (
        // Base/Derived Views - Table with pagination and Stats Enabled column
        filteredViews.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#9ca3af',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <Eye size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: '14px' }}>
              {searchTerm ? 'No views found matching your search' : 'No views in this category'}
            </div>
          </div>
        ) : (
          <>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={headerStyle}>View Name</th>
                    <th style={headerStyle}>Folder</th>
                    <th style={headerStyle}>Cache</th>
                    <th style={headerStyle}>Stats Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedViews.map((view, idx) => {
                    const cacheStatus = ((viewCache[view.name] as string) || (view as any).cacheStatus || (view as any).cache_status || '').toLowerCase();
                    const cacheOn = cacheStatus === 'full' || cacheStatus === 'partial';
                    const enabled = !!viewStats[view.name];
                    return (
                      <tr
                        key={view.id}
                        style={{
                          borderBottom: idx < paginatedViews.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        <td style={cellStyle}>
                          <div style={{ fontWeight: 500, color: '#111827', fontSize: '13px' }}>{view.name}</div>
                        </td>
                        <td style={cellStyle}>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{view.folder || '-'}</div>
                        </td>
                        <td style={cellStyle}>
                          <div
                            title={view.cache_status ? `Cache ${view.cache_status}` : 'Cache off'}
                            style={{
                              display: 'inline-flex',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              backgroundColor: cacheOn ? '#dcfce7' : '#f3f4f6',
                              color: cacheOn ? '#166534' : '#6b7280',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            {cacheOn ? 'On' : 'Off'}
                          </div>
                        </td>
                        <td style={cellStyle}>
                          <div style={{
                            display: 'inline-flex',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: enabled ? '#dcfce7' : '#f3f4f6',
                            color: enabled ? '#166534' : '#6b7280',
                            fontSize: '11px',
                            fontWeight: 600
                          }}>
                            {enabled ? 'Yes' : 'No'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination for base/derived views */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                padding: '12px 0'
              }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Page {currentPage} of {totalPages}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={getButtonStyle(currentPage === 1)} title="First page">
                    <ChevronsLeft size={16} />
                  </button>
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} style={getButtonStyle(currentPage === 1)} title="Previous page">
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ padding: '6px 12px', fontSize: '13px', color: '#111827', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                    {currentPage} / {totalPages}
                  </div>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={getButtonStyle(currentPage === totalPages)} title="Next page">
                    <ChevronRight size={16} />
                  </button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={getButtonStyle(currentPage === totalPages)} title="Last page">
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )
      ) : (
        // All Views - Uniform table with key columns
        filteredViews.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#9ca3af',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <Eye size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: '14px' }}>
              {searchTerm ? 'No views found matching your search' : 'No views found'}
            </div>
          </div>
        ) : (
          <>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={headerStyle}>View Name</th>
                    <th style={headerStyle}>Type</th>
                    <th style={headerStyle}>Folder</th>
                    <th style={headerStyle}>Cache</th>
                    <th style={headerStyle}>Stats Enabled</th>
                    <th style={headerStyle}>Implementation</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedViews.map((view, idx) => {
                    const cacheStatus = ((viewCache[view.name] as string) || (view as any).cacheStatus || (view as any).cache_status || '').toString().toLowerCase();
                    const cacheOn = cacheStatus === 'full' || cacheStatus === 'partial';
                    const enabled = !!viewStats[view.name];
                    const isInterface = view.kind === 'interface view';
                    return (
                      <tr
                        key={view.id}
                        style={{
                          borderBottom: idx < paginatedViews.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        <td style={cellStyle}>
                          <div style={{ fontWeight: 500, color: '#111827', fontSize: '13px' }}>{view.name}</div>
                        </td>
                        <td style={cellStyle}>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{view.kind}</div>
                        </td>
                        <td style={cellStyle}>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{(view as any).folder || '-'}</div>
                        </td>
                        <td style={cellStyle}>
                          <div
                            title={cacheStatus ? `Cache ${cacheStatus}` : 'Cache off'}
                            style={{
                              display: 'inline-flex',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              backgroundColor: cacheOn ? '#dcfce7' : '#f3f4f6',
                              color: cacheOn ? '#166534' : '#6b7280',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            {cacheOn ? 'On' : 'Off'}
                          </div>
                        </td>
                        <td style={cellStyle}>
                          <div style={{
                            display: 'inline-flex',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: enabled ? '#dcfce7' : '#f3f4f6',
                            color: enabled ? '#166534' : '#6b7280',
                            fontSize: '11px',
                            fontWeight: 600
                          }}>
                            {enabled ? 'Yes' : 'No'}
                          </div>
                        </td>
                        <td style={cellStyle}>
                          <div style={{
                            fontSize: '12px',
                            color: '#374151',
                            fontFamily: 'Monaco, Consolas, monospace'
                          }}>
                            {isInterface ? (view.implementation || '-') : '-'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination for all views */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                padding: '12px 0'
              }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Page {currentPage} of {totalPages}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={getButtonStyle(currentPage === 1)} title="First page">
                    <ChevronsLeft size={16} />
                  </button>
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} style={getButtonStyle(currentPage === 1)} title="Previous page">
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ padding: '6px 12px', fontSize: '13px', color: '#111827', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                    {currentPage} / {totalPages}
                  </div>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={getButtonStyle(currentPage === totalPages)} title="Next page">
                    <ChevronRight size={16} />
                  </button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={getButtonStyle(currentPage === totalPages)} title="Last page">
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
};

// Table Styles
const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#6b7280',
  whiteSpace: 'nowrap'
};

const cellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '13px',
  color: '#374151',
  verticalAlign: 'middle'
};

const getButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  backgroundColor: disabled ? '#f9fafb' : 'white',
  color: disabled ? '#d1d5db' : '#374151',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  transition: 'all 0.2s',
  opacity: disabled ? 0.5 : 1
});

// Filter Pill Component
interface FilterPillProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color: string;
}

const FilterPill: React.FC<FilterPillProps> = ({ label, count, active, onClick, color }) => {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: '20px',
        border: active ? `1.5px solid ${color}` : '1.5px solid #e5e7eb',
        backgroundColor: active ? `${color}10` : 'white',
        color: active ? color : '#6b7280',
        fontSize: '13px',
        fontWeight: active ? '600' : '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        outline: 'none'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.backgroundColor = `${color}08`;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = '#e5e7eb';
          e.currentTarget.style.backgroundColor = 'white';
        }
      }}
    >
      <span>{label}</span>
      <span style={{
        padding: '1px 6px',
        borderRadius: '10px',
        backgroundColor: active ? 'white' : '#f3f4f6',
        fontSize: '11px',
        fontWeight: '600',
        minWidth: '20px',
        textAlign: 'center'
      }}>
        {count}
      </span>
    </button>
  );
};

export default ViewsTab;
