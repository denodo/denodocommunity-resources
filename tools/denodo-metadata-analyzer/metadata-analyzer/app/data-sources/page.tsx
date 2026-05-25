'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Database, Server, Search, ChevronLeft, ChevronRight, Settings, FileText, Users, Globe, Cloud } from 'lucide-react';
import { DuckDBClient } from '../../src/lib/database/duckdb-client';
import { DataSourceAnalyticsService } from '../../src/lib/services/datasource-analytics-service';
import { ExcelWrapperStatsCard } from '../../src/components/ExcelWrapperStatsCard';
import { colors, spacing, borderRadius, shadows } from '../../src/lib/theme';

// Technology color mapping for consistent, professional styling
const getTechnologyColor = (technology: string, type: 'main' | 'hover' | 'active' = 'main') => {
  const colorMap: Record<string, string> = {
    'JDBC': '#3b82f6',
    'ODBC': '#8b5cf6',
    'Custom': '#f59e0b',
    'CUSTOM': '#f59e0b',
    'DelimitedFile': '#eab308',
    'Web Services': '#10b981',
    'SOAP WS': '#0ea5e9',
    'JSON': '#06b6d4',
    'XML': '#0ea5e9',
    'MONGODB': '#ec4899',
    'LDAP': '#6366f1',
    'SALESFORCE': '#14b8a6',
    'default': '#f97316'
  };

  const baseColor = colorMap[technology] || colorMap['default'];

  switch (type) {
    case 'hover':
      return `${baseColor}20`;
    case 'active':
      return baseColor;
    default:
      return baseColor;
  }
};

// Helper function to get technology-specific icons
const getTechnologyIcon = (technology: string) => {
  const iconMap: Record<string, any> = {
    'JDBC': Database,
    'ODBC': Database,
    'Custom': Settings,
    'CUSTOM': Settings,
    'JSON': FileText,
    'XML': FileText,
    'LDAP': Users,
    'Web Services': Globe,
    'SOAP WS': Globe,
    'MONGODB': Database,
    'SALESFORCE': Cloud,
    'DelimitedFile': FileText
  };

  return iconMap[technology] || Server;
};

// Summary Card Component
const SummaryCard = ({ icon, title, count, subtitle, color }: any) => (
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
      }}>{count.toLocaleString()}</div>
      <div style={{
        fontSize: '13px',
        fontWeight: 500,
        color: colors.gray600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>{title}</div>
      {subtitle && (
        <div style={{
          fontSize: '12px',
          fontWeight: 400,
          color: colors.gray500,
          marginTop: '2px'
        }}>{subtitle}</div>
      )}
    </div>
  </div>
);

// Smart Data Source Table Component
const DataSourceTable = ({ data, columns, technologyType, showStreamTuplesStatus }: any) => {
  const renderCellValue = (value: any, columnKey: string) => {
    if (!value && value !== 0 && value !== false) return '-';

    // Special rendering for specific columns
    switch (columnKey) {
      case 'name':
        return <strong style={{ color: colors.gray900 }}>{value}</strong>;

      case 'databaseVersion':
      case 'version':
        return value ? (
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: colors.info,
            color: colors.white,
            borderRadius: borderRadius.sm,
            fontWeight: 500
          }}>v{value}</span>
        ) : '-';

      case 'databaseUri':
      case 'endpoint':
      case 'wsdl':
        return value ? (
          <code style={{
            fontSize: '11px',
            color: colors.gray700,
            background: colors.gray100,
            padding: '2px 6px',
            borderRadius: borderRadius.sm,
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }} title={value}>
            {value.length > 50 ? `${value.substring(0, 47)}...` : value}
          </code>
        ) : '-';

      case 'driverClassName':
      case 'fullClassName':
        return value ? (
          <code style={{
            fontSize: '11px',
            color: colors.gray700,
            background: colors.gray100,
            padding: '2px 6px',
            borderRadius: borderRadius.sm,
            fontFamily: 'monospace'
          }} title={value}>
            {value.split('.').pop()}
          </code>
        ) : '-';

      case 'username':
        return value ? (
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: colors.success,
            color: colors.white,
            borderRadius: borderRadius.sm,
            fontWeight: 500
          }}>{value}</span>
        ) : '-';

      case 'serviceType':
        return value ? (
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: colors.warning,
            color: colors.white,
            borderRadius: borderRadius.sm,
            fontWeight: 500
          }}>{value}</span>
        ) : '-';

      case 'routeType':
        return value ? (
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: colors.info,
            color: colors.white,
            borderRadius: borderRadius.sm,
            fontWeight: 500
          }}>{value}</span>
        ) : '-';

      case 'streamTuplesStatus':
        if (!value) return '-';

        const statusConfig: Record<string, { label: string; bg: string; color: string; icon: string }> = {
          'enabled': { label: 'Enabled', bg: colors.success, color: colors.white, icon: '✅' },
          'disabled': { label: 'Disabled', bg: colors.error, color: colors.white, icon: '❌' },
          'unconfigured': { label: 'Unconfigured (Default: Enabled)', bg: colors.gray500, color: colors.white, icon: '⚪' }
        };

        const config = statusConfig[value] || statusConfig['unconfigured'];
        return (
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: config.bg,
            color: config.color,
            borderRadius: borderRadius.sm,
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {config.icon} {config.label}
          </span>
        );

      default:
        return value.toString();
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(150px, 1fr))`,
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
        {columns.map((column: any) => (
          <div key={column.key} style={{ padding: spacing.xs }}>
            {column.label}
          </div>
        ))}
      </div>
      {data.map((item: any, index: number) => (
        <div
          key={index}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(150px, 1fr))`,
            gap: spacing.sm,
            padding: spacing.md,
            borderBottom: `1px solid ${colors.gray200}`,
            transition: 'background-color 0.2s ease',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.gray50;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {columns.map((column: any) => (
            <div key={column.key} style={{
              padding: spacing.xs,
              fontSize: '13px',
              color: colors.gray800,
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {renderCellValue(item[column.key], column.key)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default function DataSourcesPage() {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [excelWrapperStats, setExcelWrapperStats] = useState<any>(null);
  const [wrappersData, setWrappersData] = useState<any[]>([]);
  const [streamTuplesFilter, setStreamTuplesFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  const itemsPerPage = 50;

  // Reset pagination when tab, search, or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, activeSubTab, searchTerm, streamTuplesFilter]);

  const loadAnalysisData = useCallback(async () => {
    try {
      const client = new DuckDBClient();
      await client.initialize();

      const hasData = await client.loadFromParquet();
      if (!hasData) {
        window.location.href = '/';
        return;
      }

      // Helper function to detect vendor from JDBC URL (same logic as React version)
      const detectVendorFromUrl = (url: string | null): string => {
        if (!url) return 'generic';
        const urlLower = url.toLowerCase();

        if (urlLower.includes('sqlserver') || urlLower.includes('jdbc:sqlserver')) return 'sqlserver';
        if (urlLower.includes('postgresql') || urlLower.includes('jdbc:postgresql')) return 'postgresql';
        if (urlLower.includes(':sap:') || urlLower.includes('jdbc:sap')) return 'hdb';
        if (urlLower.includes('mysql') || urlLower.includes('jdbc:mysql')) return 'mysql';
        if (urlLower.includes('oracle') || urlLower.includes('jdbc:oracle')) return 'oracle';
        if (urlLower.includes('db2') || urlLower.includes('jdbc:db2')) return 'db2';
        if (urlLower.includes('sybase') || urlLower.includes('jdbc:sybase')) return 'sybase';

        return 'generic';
      };

      // Query databases, datasources, and wrappers
      const databases = await client.query('SELECT * FROM databases');
      const datasourcesRaw = await client.query('SELECT * FROM datasources');
      const wrappersRaw = await client.query('SELECT * FROM wrappers') || [];
      const properties = {}; // Properties would come from properties table if needed

      // DEBUG: Check first wrapper from DuckDB
      if (wrappersRaw.length > 0) {
        console.log('🔍 First wrapper from DuckDB:', {
          name: wrappersRaw[0].name,
          wrapperType: wrappersRaw[0].wrapperType,
          dataSourceName: wrappersRaw[0].dataSourceName,
          parametersType: typeof wrappersRaw[0].parameters,
          parametersIsNull: wrappersRaw[0].parameters === null,
          parametersValue: wrappersRaw[0].parameters
        });
      }

      // Store wrappers data for Excel wrapper analysis
      setWrappersData(wrappersRaw);

      // Build database objects with datasources - matching React IndexedDB structure
      const enrichedDatabases = databases.map((db: any) => ({
        name: db.name,
        dataSources: datasourcesRaw
          .filter((ds: any) => ds.database === db.name)
          .map((ds: any) => ({
            name: ds.name,
            type: ds.type,
            database: ds.database,
            // Use camelCase fields (query converts snake_case to camelCase)
            databaseName: ds.databaseName || detectVendorFromUrl(ds.url),
            databaseVersion: ds.databaseVersion,
            databaseUri: ds.url,
            username: ds.username,
            classpath: ds.classpath,
            className: ds.className,
            routeType: ds.routeType,
            routeConnection: ds.routeConnection,
            wsdlLocation: ds.wsdlLocation,
            endpoint: ds.endpoint,
            dsn: ds.dsn
          }))
      }));

      setAnalysisData({
        databases: enrichedDatabases,
        properties
      });
    } catch (error: any) {
      console.error('Failed to load analysis data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalysisData();
  }, [loadAnalysisData]);

  // Set default active tab to the highest count technology
  useEffect(() => {
    if (!analysisData || activeTab) return;

    const analytics = DataSourceAnalyticsService.getDataSourceAnalytics(analysisData.databases, analysisData.properties);
    const technologyTabs = DataSourceAnalyticsService.getTechnologyTabs(analytics);

    if (technologyTabs.length > 0) {
      setActiveTab(technologyTabs[0].id);
    }
  }, [analysisData, activeTab]);

  // Calculate Excel wrapper stats when Excel Wrappers subtab is selected
  useEffect(() => {
    const isExcelWrappersTab = activeTab === 'custom' && activeSubTab === 'excel-wrappers';

    if (isExcelWrappersTab && analysisData && wrappersData.length > 0) {
      const loadExcelWrapperStats = async () => {
        try {
          // Get all datasources
          const allDataSources = analysisData.databases.flatMap((db: any) => db.dataSources || []);

          // Calculate Excel wrapper statistics
          const stats = await DataSourceAnalyticsService.getExcelWrapperStreamTuplesStats(
            wrappersData,
            allDataSources
          );

          setExcelWrapperStats(stats);
        } catch (error) {
          console.error('Failed to load Excel wrapper stats:', error);
        }
      };

      loadExcelWrapperStats();
    } else {
      setExcelWrapperStats(null);
    }
  }, [activeTab, activeSubTab, analysisData, wrappersData]);

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
          <p style={{ fontSize: '14px', color: colors.gray600 }}>Loading data sources...</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: colors.gray50
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: colors.gray900,
            marginBottom: '12px'
          }}>No Data Available</h2>
          <p style={{
            fontSize: '14px',
            color: colors.gray600,
            marginBottom: '24px'
          }}>
            Please upload a VQL file to analyze data sources.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: colors.accent,
              color: colors.white,
              borderRadius: borderRadius.md,
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Upload VQL File
          </a>
        </div>
      </div>
    );
  }

  const analytics = DataSourceAnalyticsService.getDataSourceAnalytics(analysisData.databases, analysisData.properties);
  const summaryStats = DataSourceAnalyticsService.getSummaryStats(analytics);
  const technologyTabs = DataSourceAnalyticsService.getTechnologyTabs(analytics);

  // Get current technology type
  const getCurrentTechnologyType = () => {
    const tech = technologyTabs.find(tab => tab.id === activeTab);
    return tech ? tech.label : '';
  };

  // Get sub-tabs for current technology
  const subTabs = activeTab ? DataSourceAnalyticsService.getSubTechnologyTabs(analytics, getCurrentTechnologyType()) : [];

  const getCurrentSubTechnology = (): string | undefined => {
    if (!activeSubTab) return undefined;
    const subTab = subTabs.find(tab => tab.id === activeSubTab);
    return subTab ? subTab.label : undefined;
  };

  let tableData = activeTab ? DataSourceAnalyticsService.getTableData(analytics, getCurrentTechnologyType(), getCurrentSubTechnology()) : [];
  let tableColumns = activeTab ? DataSourceAnalyticsService.getTableColumns(getCurrentTechnologyType()) : [];

  // For Excel Wrappers subtab, enhance table data with stream tuples status
  const isExcelWrappersTab = activeTab === 'custom' && activeSubTab === 'excel-wrappers';
  if (isExcelWrappersTab && excelWrapperStats) {
    // Merge stream tuples status into table data
    const wrappersWithStatus = [...excelWrapperStats.enabledWrappers, ...excelWrapperStats.disabledWrappers];

    tableData = tableData.map((row: any) => {
      const matchingWrapper = wrappersWithStatus.find(
        (w: any) => w.name === row.name && w.database === row.database
      );

      if (matchingWrapper) {
        return {
          ...row,
          streamTuplesStatus: matchingWrapper.streamTuplesStatus
        };
      }
      return row;
    });

    // Add Stream Tuples Status column if not already present
    if (!tableColumns.find((col: any) => col.key === 'streamTuplesStatus')) {
      tableColumns = [
        ...tableColumns,
        { key: 'streamTuplesStatus', label: 'Stream Tuples Status', sortable: true }
      ];
    }
  }

  // Filter and paginate table data
  const getFilteredData = () => {
    let filtered = tableData;

    // Apply stream tuples filter for Excel Wrappers tab
    if (isExcelWrappersTab && streamTuplesFilter !== 'all') {
      filtered = filtered.filter((item: any) => {
        if (streamTuplesFilter === 'enabled') {
          return item.streamTuplesStatus === 'enabled';
        } else if (streamTuplesFilter === 'disabled') {
          return item.streamTuplesStatus === 'disabled';
        }
        return true;
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((item: any) => {
        const searchValue = searchTerm.toLowerCase();
        return Object.values(item).some(value =>
          value && value.toString().toLowerCase().includes(searchValue)
        );
      });
    }

    return filtered;
  };

  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

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
              background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentHover} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white
            }}>
              <Database size={24} />
            </div>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: colors.gray900,
                margin: 0,
                lineHeight: 1.2
              }}>Data Source Technology Breakdown</h1>
              <p style={{
                fontSize: '14px',
                color: colors.gray600,
                margin: `${spacing.xs} 0 0 0`
              }}>
                Interactive analysis of data source technologies with detailed connection information
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: spacing.md,
          marginBottom: spacing.lg
        }}>
          <SummaryCard
            icon={<Database size={28} />}
            title="Total Data Sources"
            count={summaryStats.totalDataSources}
            color={colors.accent}
          />
          <SummaryCard
            icon={<Server size={28} />}
            title="Technology Types"
            count={summaryStats.totalTypes}
            color={colors.databaseSolid}
          />
          <SummaryCard
            icon={<Globe size={28} />}
            title="Top Technology"
            count={summaryStats.topTechnologies[0]?.count || 0}
            subtitle={summaryStats.topTechnologies[0]?.technology || 'None'}
            color={colors.success}
          />
        </div>

        {/* Main Technology Tabs */}
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
            gap: spacing.xs,
            overflowX: 'auto',
            paddingBottom: spacing.xs
          }}>
            {technologyTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const IconComponent = getTechnologyIcon(tab.label);
              const tabColor = getTechnologyColor(tab.label, 'active');

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setActiveSubTab('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: isActive ? tabColor : 'transparent',
                    border: 'none',
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isActive ? colors.white : colors.gray600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = getTechnologyColor(tab.label, 'hover');
                      e.currentTarget.style.color = tabColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = colors.gray600;
                    }
                  }}
                >
                  <IconComponent size={16} />
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '11px',
                    opacity: 0.9,
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : `${tabColor}20`,
                    padding: '2px 6px',
                    borderRadius: borderRadius.sm
                  }}>({tab.count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-Technology Tabs */}
        {subTabs.length > 0 && (
          <div style={{
            background: colors.gray50,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
            border: `1px solid ${colors.gray200}`
          }}>
            <div style={{
              display: 'flex',
              gap: spacing.xs,
              overflowX: 'auto',
              paddingBottom: spacing.xs
            }}>
              <button
                onClick={() => setActiveSubTab('')}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: !activeSubTab ? getTechnologyColor(getCurrentTechnologyType(), 'active') : colors.white,
                  border: `1px solid ${!activeSubTab ? getTechnologyColor(getCurrentTechnologyType(), 'active') : colors.gray300}`,
                  borderRadius: borderRadius.md,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: !activeSubTab ? colors.white : colors.gray600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                All {getCurrentTechnologyType()} ({technologyTabs.find(t => t.id === activeTab)?.count || 0})
              </button>
              {subTabs.map((subTab) => {
                const isActive = activeSubTab === subTab.id;
                const subTabColor = getTechnologyColor(getCurrentTechnologyType(), 'active');

                return (
                  <button
                    key={subTab.id}
                    onClick={() => setActiveSubTab(subTab.id)}
                    style={{
                      padding: `${spacing.sm} ${spacing.md}`,
                      background: isActive ? subTabColor : colors.white,
                      border: `1px solid ${isActive ? subTabColor : colors.gray300}`,
                      borderRadius: borderRadius.md,
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isActive ? colors.white : colors.gray600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {subTab.label} ({subTab.count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Excel Wrapper Stats Card - Show only for Excel Wrappers subtab */}
        {isExcelWrappersTab && excelWrapperStats && (
          <ExcelWrapperStatsCard
            totalExcelWrappers={excelWrapperStats.totalExcelWrappers}
            streamTuplesEnabled={excelWrapperStats.streamTuplesEnabled}
            streamTuplesDisabled={excelWrapperStats.streamTuplesDisabled}
            streamTuplesUnconfigured={excelWrapperStats.streamTuplesUnconfigured}
            onFilterChange={setStreamTuplesFilter}
            currentFilter={streamTuplesFilter}
          />
        )}

        {/* Content Area */}
        <div style={{
          background: colors.white,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.sm,
          border: `1px solid ${colors.gray200}`,
          overflow: 'hidden'
        }}>
          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
            padding: spacing.md,
            borderBottom: `1px solid ${colors.gray200}`,
            background: colors.gray50
          }}>
            <div style={{
              position: 'relative',
              flex: 1,
              maxWidth: '400px'
            }}>
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
                placeholder={`Search ${getCurrentTechnologyType().toLowerCase()} connections...`}
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
              fontWeight: 500
            }}>
              Showing {filteredData.length} connection{filteredData.length !== 1 ? 's' : ''}
              {getCurrentSubTechnology() && ` in ${getCurrentSubTechnology()}`}
            </div>
          </div>

          {/* Table */}
          <div style={{ minHeight: '400px' }}>
            {paginatedData.length > 0 ? (
              <DataSourceTable
                data={paginatedData}
                columns={tableColumns}
                technologyType={getCurrentTechnologyType()}
                showStreamTuplesStatus={isExcelWrappersTab}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing.xxxl,
                textAlign: 'center',
                color: colors.gray500
              }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  marginBottom: spacing.xs
                }}>
                  {searchTerm
                    ? `No ${getCurrentTechnologyType().toLowerCase()} connections match your search`
                    : `No ${getCurrentTechnologyType().toLowerCase()} connections found`
                  }
                </div>
                {searchTerm && (
                  <div style={{
                    fontSize: '14px',
                    color: colors.gray400
                  }}>
                    Try adjusting your search criteria
                  </div>
                )}
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
                  opacity: currentPage === 1 ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <div style={{
                fontSize: '12px',
                color: colors.gray600
              }}>
                Page {currentPage} of {totalPages} •
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} items
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
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
