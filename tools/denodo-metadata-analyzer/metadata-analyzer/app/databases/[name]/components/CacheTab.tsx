'use client';

import React, { useState, useMemo } from 'react';
import { Database, Layers, TrendingUp, Search } from 'lucide-react';

interface CacheData {
  id: number;
  name: string;
  database: string;
  cacheType?: string;
  cacheStatus?: string;
  configuration?: any;
}

interface View {
  id: number;
  name: string;
  kind: string;
}

interface CacheTabProps {
  cacheData: CacheData[];
  views: View[];
}

const CacheTab: React.FC<CacheTabProps> = ({ cacheData, views }) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Calculate cache statistics
  const cacheStats = useMemo(() => {
    const fullCache = cacheData.filter(c => c.cacheStatus?.toLowerCase() === 'full');
    const partialCache = cacheData.filter(c => c.cacheStatus?.toLowerCase() === 'partial');
    const totalViews = views.length;
    const cachedCount = cacheData.length;
    const uncachedCount = totalViews - cachedCount;
    const cachePercentage = totalViews > 0 ? Math.round((cachedCount / totalViews) * 100) : 0;

    return {
      total: cacheData.length,
      full: fullCache.length,
      partial: partialCache.length,
      uncached: uncachedCount,
      percentage: cachePercentage,
      fullList: fullCache,
      partialList: partialCache,
    };
  }, [cacheData, views]);

  // Filter cache data
  const filteredCacheData = useMemo(() => {
    let filtered = cacheData;

    // Apply cache type filter
    if (activeFilter === 'full') {
      filtered = cacheStats.fullList;
    } else if (activeFilter === 'partial') {
      filtered = cacheStats.partialList;
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [cacheData, cacheStats, activeFilter, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCacheData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredCacheData.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm]);

  return (
    <div style={{ padding: '0' }}>
      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <KPICard
          icon={<Database size={20} />}
          label="Cache Coverage"
          value={`${cacheStats.percentage}%`}
          color="#3b82f6"
          bg="#eff6ff"
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          label="Cached Views"
          value={cacheStats.total}
          color="#059669"
          bg="#f0fdf4"
        />
        <KPICard
          icon={<Layers size={20} />}
          label="Full Cache"
          value={cacheStats.full}
          color="#8b5cf6"
          bg="#faf5ff"
        />
        <KPICard
          icon={<Layers size={20} />}
          label="Partial Cache"
          value={cacheStats.partial}
          color="#f59e0b"
          bg="#fffbeb"
        />
      </div>

      {/* Filter Pills and Search */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <FilterPill
          label="All Cached"
          count={cacheStats.total}
          active={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
          color="#6b7280"
        />
        <FilterPill
          label="Full Cache"
          count={cacheStats.full}
          active={activeFilter === 'full'}
          onClick={() => setActiveFilter('full')}
          color="#8b5cf6"
        />
        <FilterPill
          label="Partial Cache"
          count={cacheStats.partial}
          active={activeFilter === 'partial'}
          onClick={() => setActiveFilter('partial')}
          color="#f59e0b"
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
            placeholder="Search cached views..."
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
      </div>

      {/* Results count and pagination info */}
      <div style={{
        marginBottom: '12px',
        fontSize: '13px',
        color: '#6b7280',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          {filteredCacheData.length} cached view{filteredCacheData.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
        </span>
        {filteredCacheData.length > 0 && (
          <span>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredCacheData.length)} of {filteredCacheData.length}
          </span>
        )}
      </div>

      {/* Modern Table */}
      {filteredCacheData.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#9ca3af',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <Database size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: '14px' }}>
            {searchTerm ? 'No cached views found matching your search' : 'No cached views in this category'}
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  View Name
                </th>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: '200px'
                }}>
                  Cache Type
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((cache, index) => {
                const status = cache.cacheStatus?.toLowerCase();
                const statusConfig = status === 'full'
                  ? { bg: '#faf5ff', border: '#e9d5ff', text: '#7c3aed', label: 'FULL' }
                  : { bg: '#fffbeb', border: '#fde68a', text: '#d97706', label: 'PARTIAL' };

                return (
                  <tr
                    key={cache.id}
                    style={{
                      borderBottom: index < paginatedData.length - 1 ? '1px solid #f3f4f6' : 'none',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{
                      padding: '14px 16px',
                      fontSize: '14px',
                      color: '#111827',
                      fontWeight: '500'
                    }}>
                      {cache.name}
                    </td>
                    <td style={{
                      padding: '14px 16px'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        backgroundColor: statusConfig.bg,
                        border: `1px solid ${statusConfig.border}`,
                        color: statusConfig.text,
                        fontSize: '11px',
                        fontWeight: '600',
                        letterSpacing: '0.5px'
                      }}>
                        {statusConfig.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredCacheData.length > itemsPerPage && (
        <div style={{
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
              color: currentPage === 1 ? '#9ca3af' : '#374151',
              fontSize: '13px',
              fontWeight: '500',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 1) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 1) {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }
            }}
          >
            Previous
          </button>

          {/* Page Numbers */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              // Show first page, last page, current page, and pages around current
              const showPage =
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1);

              const showEllipsis =
                (page === currentPage - 2 && currentPage > 3) ||
                (page === currentPage + 2 && currentPage < totalPages - 2);

              if (showEllipsis) {
                return (
                  <span key={page} style={{
                    padding: '8px 12px',
                    color: '#9ca3af',
                    fontSize: '13px'
                  }}>
                    ...
                  </span>
                );
              }

              if (!showPage) return null;

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '8px 12px',
                    minWidth: '40px',
                    border: page === currentPage ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: page === currentPage ? '#3b82f6' : 'white',
                    color: page === currentPage ? 'white' : '#374151',
                    fontSize: '13px',
                    fontWeight: page === currentPage ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (page !== currentPage) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== currentPage) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white',
              color: currentPage === totalPages ? '#9ca3af' : '#374151',
              fontSize: '13px',
              fontWeight: '500',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== totalPages) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== totalPages) {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

// KPI Card Component
interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, color, bg }) => {
  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '6px',
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#111827',
          lineHeight: 1
        }}>
          {value}
        </div>
        <div style={{
          fontSize: '11px',
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          marginTop: '2px'
        }}>
          {label}
        </div>
      </div>
    </div>
  );
};

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

export default CacheTab;
