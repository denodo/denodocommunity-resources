import React, { useState } from 'react';
import { Database, Search, Filter, Grid, List, ArrowLeft } from 'lucide-react';
import { colors, spacing, borderRadius } from '../styles/theme';

const VDBBreakdown = ({ analysisData, onDatabaseSelect, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const { databases = [] } = analysisData || {};

  // Filter databases based on search and filter criteria
  const filteredDatabases = databases.filter(db => {
    const matchesSearch = db.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'cached') {
      const rawPercentage = db.metrics?.cachePercentage || 0;
      const hasCaching = rawPercentage === '<1' || parseFloat(rawPercentage || 0) > 0;
      return matchesSearch && hasCaching;
    }
    if (filterType === 'uncached') {
      const rawPercentage = db.metrics?.cachePercentage || 0;
      const hasCaching = rawPercentage === '<1' || parseFloat(rawPercentage || 0) > 0;
      return matchesSearch && !hasCaching;
    }
    
    return matchesSearch;
  });

  return (
    <div style={vdbStyles.container}>
      {/* Header */}
      <div style={vdbStyles.header}>
        <div style={vdbStyles.headerLeft}>
          <button onClick={onBack} style={vdbStyles.backButton}>
            <ArrowLeft size={18} />
          </button>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <img
              src={`${process.env.PUBLIC_URL}/denodo_logo2.png`}
              alt="Denodo"
              style={{
                height: '32px',
                width: 'auto',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
              }}
            />
            <div>
              <h1 style={vdbStyles.title}>VDB Breakdown</h1>
              <p style={vdbStyles.subtitle}>
                Detailed view of all {databases.length} virtual databases
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div style={vdbStyles.controls}>
        <div style={vdbStyles.searchContainer}>
          <Search size={14} style={vdbStyles.searchIcon} />
          <input
            type="text"
            placeholder="Search databases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={vdbStyles.searchInput}
          />
        </div>

        <div style={vdbStyles.filters}>
          <div style={vdbStyles.filterGroup}>
            <Filter size={14} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={vdbStyles.filterSelect}
            >
              <option value="all">All Databases</option>
              <option value="cached">With Cache</option>
              <option value="uncached">No Cache</option>
            </select>
          </div>

          <div style={vdbStyles.viewToggle}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                ...vdbStyles.viewToggleButton,
                ...(viewMode === 'grid' ? vdbStyles.viewToggleButtonActive : {})
              }}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                ...vdbStyles.viewToggleButton,
                ...(viewMode === 'list' ? vdbStyles.viewToggleButtonActive : {})
              }}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Databases Grid/List */}
      <div style={{
        ...vdbStyles.databasesContainer,
        ...(viewMode === 'list' ? vdbStyles.databasesList : vdbStyles.databasesGrid)
      }}>
        {filteredDatabases.map((database) => (
          <DatabaseCard
            key={database.id || database.name}
            database={database}
            viewMode={viewMode}
            onClick={() => onDatabaseSelect(database)}
          />
        ))}
      </div>

      {filteredDatabases.length === 0 && (
        <div style={vdbStyles.emptyState}>
          <Database size={40} color={colors.gray400} />
          <h3 style={vdbStyles.emptyStateTitle}>No databases found</h3>
          <p style={vdbStyles.emptyStateText}>
            {searchTerm || filterType !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'No databases were found in the uploaded VQL file'
            }
          </p>
        </div>
      )}
    </div>
  );
};

// Database Card Component (copied from Dashboard)
const DatabaseCard = ({ database, viewMode, onClick }) => {
  const metrics = database.metrics || {};
  
  // Handle both numeric percentages and "<1" string case
  const rawCachePercentage = metrics.cachePercentage || 0;
  const cachePercentage = typeof rawCachePercentage === 'string' && rawCachePercentage === '<1' 
    ? '<1' 
    : parseFloat(rawCachePercentage || 0);
  
  // For numeric comparisons, treat "<1" as a positive value  
  const numericCachePercentage = cachePercentage === '<1' ? 0.1 : parseFloat(cachePercentage || 0);
  
  // Check if this is a system database (admin, etc.)
  const isSystemDatabase = database.isSystemDatabase || database.type === 'system_database' || database.name === 'admin';
  
  return (
    <div
      style={{
        ...vdbStyles.databaseCard,
        ...(viewMode === 'list' ? vdbStyles.databaseCardList : {}),
        ...(isSystemDatabase ? vdbStyles.systemDatabaseCard : {})
      }}
      onClick={onClick}
    >
      {/* Header Section */}
      <div style={vdbStyles.databaseHeader}>
        <div style={vdbStyles.databaseIcon}>
          <Database size={viewMode === 'list' ? 18 : 20} color={isSystemDatabase ? colors.gray500 : colors.primarySolid} />
        </div>
        <div style={vdbStyles.databaseInfo}>
          <div style={vdbStyles.databaseName} title={database.name}>
            {database.name}
          </div>
          {isSystemDatabase && (
            <div style={vdbStyles.systemBadge}>
              System Database
            </div>
          )}
        </div>
        {numericCachePercentage > 0 && (
          <div style={{
            ...vdbStyles.cacheIndicator,
            background: numericCachePercentage > 50 ? colors.cacheEnabled : colors.cachePartial
          }}>
            {cachePercentage}%
          </div>
        )}
      </div>

      {/* Metrics Section */}
      <div style={vdbStyles.metricsSection}>
        <div style={vdbStyles.mainMetric}>
          <div style={vdbStyles.mainMetricValue}>{metrics.views || 0}</div>
          <div style={vdbStyles.mainMetricLabel}>Total Views</div>
        </div>
        
        <div style={vdbStyles.quickMetricsGrid}>
          <div style={vdbStyles.quickMetric}>
            <div style={vdbStyles.quickMetricValue}>{metrics.dataSources || 0}</div>
            <div style={vdbStyles.quickMetricLabel}>Data Sources</div>
          </div>
          <div style={vdbStyles.quickMetric}>
            <div style={vdbStyles.quickMetricValue}>{metrics.viewsByType?.base || 0}</div>
            <div style={vdbStyles.quickMetricLabel}>Base Views</div>
          </div>
          <div style={vdbStyles.quickMetric}>
            <div style={vdbStyles.quickMetricValue}>{metrics.viewsByType?.derived || 0}</div>
            <div style={vdbStyles.quickMetricLabel}>Derived</div>
          </div>
          <div style={vdbStyles.quickMetric}>
            <div style={vdbStyles.quickMetricValue}>{metrics.viewsByType?.interface || 0}</div>
            <div style={vdbStyles.quickMetricLabel}>Interface</div>
          </div>
        </div>
      </div>

      {/* Cache Status Bar */}
      {numericCachePercentage > 0 && (
        <div style={vdbStyles.cacheStatusBar}>
          <div style={vdbStyles.cacheBarBackground}>
            <div 
              style={{
                ...vdbStyles.cacheBarFill,
                width: `${Math.min(numericCachePercentage, 100)}%`,
                background: numericCachePercentage > 50 ? colors.cacheEnabled : colors.cachePartial
              }}
            />
          </div>
          <div style={vdbStyles.cacheBarLabel}>
            {cachePercentage}% Cached
          </div>
        </div>
      )}
    </div>
  );
};

// Styles (copied and adapted from Dashboard)
const vdbStyles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    padding: spacing.md,
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.md,
    backdropFilter: 'blur(10px)'
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md
  },

  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    background: colors.gray100,
    border: 'none',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    ':hover': {
      background: colors.gray200
    }
  },
  
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: colors.gray800,
    margin: `0 0 ${spacing.xs} 0`
  },
  
  subtitle: {
    fontSize: '14px',
    color: colors.gray600,
    margin: 0
  },
  
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.md,
    backdropFilter: 'blur(10px)'
  },
  
  searchContainer: {
    position: 'relative',
    flex: 1,
    maxWidth: '400px'
  },
  
  searchIcon: {
    position: 'absolute',
    left: spacing.md,
    top: '50%',
    transform: 'translateY(-50%)',
    color: colors.gray400
  },
  
  searchInput: {
    width: '100%',
    padding: `${spacing.sm} ${spacing.sm} ${spacing.sm} 40px`,
    border: `1px solid ${colors.gray300}`,
    borderRadius: borderRadius.md,
    fontSize: '14px',
    background: colors.white,
    ':focus': {
      outline: 'none',
      borderColor: colors.primarySolid,
      boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.2)'
    }
  },
  
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md
  },
  
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm
  },
  
  filterSelect: {
    padding: `${spacing.sm} ${spacing.md}`,
    border: `1px solid ${colors.gray300}`,
    borderRadius: borderRadius.md,
    fontSize: '14px',
    background: colors.white,
    cursor: 'pointer'
  },
  
  viewToggle: {
    display: 'flex',
    border: `1px solid ${colors.gray300}`,
    borderRadius: borderRadius.md,
    overflow: 'hidden'
  },
  
  viewToggleButton: {
    padding: spacing.sm,
    border: 'none',
    background: colors.white,
    color: colors.gray600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  viewToggleButtonActive: {
    background: colors.primary,
    color: colors.white
  },
  
  databasesContainer: {
    marginBottom: spacing.xl
  },
  
  databasesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: spacing.md
  },
  
  databasesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md
  },
  
  databaseCard: {
    background: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: `1px solid ${colors.border}`,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
      borderColor: colors.primary
    }
  },
  
  databaseCardList: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm
  },
  
  databaseHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  
  databaseIcon: {
    flexShrink: 0
  },
  
  databaseInfo: {
    flex: 1,
    minWidth: 0
  },
  
  databaseName: {
    fontSize: '1rem',
    fontWeight: '600',
    color: colors.text,
    margin: '0',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.2
  },
  
  cacheIndicator: {
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: borderRadius.full,
    color: colors.white,
    fontSize: '11px',
    fontWeight: 600,
    flexShrink: 0
  },
  
  emptyState: {
    textAlign: 'center',
    padding: spacing['3xl'],
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: borderRadius.lg,
    backdropFilter: 'blur(10px)'
  },
  
  emptyStateTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: colors.gray700,
    margin: `${spacing.md} 0 ${spacing.sm} 0`
  },
  
  emptyStateText: {
    fontSize: '14px',
    color: colors.gray500,
    margin: 0
  },
  
  systemBadge: {
    fontSize: '0.7rem',
    fontWeight: '500',
    color: colors.gray500,
    backgroundColor: colors.gray100,
    padding: `2px ${spacing.xs}`,
    borderRadius: borderRadius.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },

  metricsSection: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: `${spacing.sm} 0`
  },

  mainMetric: {
    textAlign: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    minWidth: '70px'
  },

  mainMetricValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: colors.primary,
    lineHeight: 1,
    marginBottom: '2px'
  },

  mainMetricLabel: {
    fontSize: '0.8rem',
    color: colors.muted,
    fontWeight: '500'
  },

  quickMetricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: spacing.sm,
    flex: 1
  },

  quickMetric: {
    textAlign: 'center',
    padding: spacing.xs
  },

  quickMetricValue: {
    fontSize: '1rem',
    fontWeight: '600',
    color: colors.text,
    lineHeight: 1,
    marginBottom: '1px'
  },

  quickMetricLabel: {
    fontSize: '0.7rem',
    color: colors.muted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },

  cacheStatusBar: {
    marginTop: spacing.sm
  },

  cacheBarBackground: {
    height: '6px',
    backgroundColor: colors.gray200,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs
  },

  cacheBarFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    transition: 'width 0.3s ease'
  },

  cacheBarLabel: {
    fontSize: '0.75rem',
    color: colors.muted,
    textAlign: 'center',
    fontWeight: '500'
  },

  // System database styling (admin, etc.) - lighter colors to distinguish from user databases
  systemDatabaseCard: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    border: `1px solid ${colors.gray300}`,
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
      borderColor: colors.gray400
    }
  }
};

export default VDBBreakdown;