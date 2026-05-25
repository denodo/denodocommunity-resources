'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Database, BarChart3, Eye, Settings, Link2, Layers, Shield, Activity } from 'lucide-react';
import DataSourcesTab from './components/DataSourcesTab';
import ViewsTab from './components/ViewsTab';
import CacheTab from './components/CacheTab';
import AssociationsTab from './components/AssociationsTab';

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

interface CacheData {
  id: number;
  name: string;
  database: string;
  cache_type?: string;
  cache_status?: string;
  configuration?: any;
}

interface Association {
  id: number;
  name: string;
  kind?: string;
  database: string;
  folder?: string;
  endpoints?: any;
  mapping?: any;
}

interface DatabaseDetails {
  name: string;
  dataSources: number;
  baseViews: number;
  derivedViews: number;
  interfaceViews: number;
  totalViews: number;
  cachedViews: number;
  associations: number;
  cachePercentage: string;
  statsEnabled: number;
  wrappers: number;
  dataSourcesByType: { [key: string]: number };
  cacheStatus: {
    full: number;
    partial: number;
    off: number;
  };
  dataSourcesList?: DataSource[];
  viewsList?: View[];
  cacheDataList?: CacheData[];
  associationsList?: Association[];
  viewStatsByName?: Record<string, boolean>;
  viewCacheByName?: Record<string, string>;
  cacheEnabledDatabase?: boolean;
  cacheDatasource?: string | null;
}

export default function DatabaseDetailPage() {
  const params = useParams();
  const router = useRouter();

  // With static export, params.name is hardcoded to 'index'
  // So we need to parse the actual database name from the URL pathname
  const [dbName, setDbName] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Extract database name from pathname: /databases/admin -> admin
      const pathname = window.location.pathname;
      const parts = pathname.split('/').filter(p => p);
      if (parts.length >= 2 && parts[0] === 'databases') {
        setDbName(decodeURIComponent(parts[1]));
      }
    }
  }, []);

  const [activeTab, setActiveTab] = useState('overview');
  const [dbDetails, setDbDetails] = useState<DatabaseDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDatabaseDetails = useCallback(async () => {
    try {
      const { duckdb } = await import('@/lib/database/duckdb-client');
      await duckdb.waitForInitialization();

      // Use database_stats table (same as VDB Breakdown page) for consistent data
      const query = `
        SELECT
          database as name,
          data_sources as dataSources,
          base_views as baseViews,
          derived_views as derivedViews,
          interface_views as interfaceViews,
          total_views as totalViews,
          cached_views as cachedViews,
          associations as associations
        FROM database_stats
        WHERE database = '${dbName}'
      `;

      const result = await duckdb.query(query);
      if (result.length > 0) {
        const db = result[0];
        const totalViews = Number(db.totalViews || 0);
        const cachedViews = Number(db.cachedViews || 0);
        const cachePercentage = totalViews > 0
          ? `${Math.round((cachedViews / totalViews) * 100)}`
          : '0';

        // Get data sources by type
        const dsQuery = `SELECT type, COUNT(*) as count FROM datasources WHERE database = '${dbName}' GROUP BY type`;
        const dsResult = await duckdb.query(dsQuery);
        const dataSourcesByType: { [key: string]: number } = {};
        dsResult.forEach((row: any) => {
          dataSourcesByType[row.type] = Number(row.count);
        });

        // Get wrappers count
        const wrappersQuery = `SELECT COUNT(*) as count FROM wrappers WHERE database = '${dbName}'`;
        const wrappersResult = await duckdb.query(wrappersQuery);
        const wrappers = Number(wrappersResult[0]?.count || 0);

        // Get stats enabled count and build per-view map
        let statsEnabled = 0;
        let viewStatsByName: Record<string, boolean> = {};
        try {
          const statsCountQuery = `SELECT COUNT(*) as count FROM view_stats WHERE database = '${dbName}' AND enabled = true`;
          const statsCountResult = await duckdb.query(statsCountQuery);
          statsEnabled = Number(statsCountResult[0]?.count || 0);

          const statsMapQuery = `SELECT view_name, enabled FROM view_stats WHERE database = '${dbName}'`;
          const statsMapRows = await duckdb.query(statsMapQuery);
          viewStatsByName = (statsMapRows as any[]).reduce((acc, row) => {
            // DuckDB client converts snake_case to camelCase → viewName, enabled
            const name = (row as any).viewName || (row as any).view_name || (row as any).viewname;
            if (name) acc[name] = !!row.enabled;
            return acc;
          }, {} as Record<string, boolean>);
        } catch (error) {
          console.log('view_stats table not available');
        }

        // Get cache status breakdown
        const cacheStatus = {
          full: 0,
          partial: 0,
          off: totalViews - cachedViews
        };

        // Get actual datasources list for the Data Sources tab
        // Use GROUP BY name to get unique datasources (handles potential duplicates)
        const dsListQuery = `
          SELECT
            name,
            MAX(type) as type,
            MAX(database) as database,
            MAX(database_name) as database_name,
            MAX(database_version) as database_version,
            MAX(url) as url,
            MAX(driver) as driver,
            MAX(username) as username,
            MAX(vendor) as vendor,
            MAX(class_name) as class_name,
            MAX(classpath) as classpath,
            MAX(folder) as folder,
            MAX(route_type) as route_type,
            MAX(web_service_type) as web_service_type,
            MAX(wsdl_location) as wsdl_location,
            MAX(server_name) as server_name,
            MAX(dsn) as dsn
          FROM datasources
          WHERE database = '${dbName}'
          GROUP BY name
          ORDER BY MAX(type), name
        `;
        const dataSourcesList = await duckdb.query(dsListQuery);
        console.log(`[VDB Detail] Loaded ${dataSourcesList.length} unique datasources for ${dbName}`);

        // Get views list for the Views tab
        const viewsListQuery = `SELECT id, name, kind, database, folder, cache_status, select_body, implementation, properties FROM views WHERE database = '${dbName}' ORDER BY name`;
        const viewsList = await duckdb.query(viewsListQuery);

        // Get cache data list for the Cache tab (from cache_data table as per documentation)
        const cacheDataQuery = `SELECT id, name, database, cache_type, cache_status, configuration FROM cache_data WHERE database = '${dbName}' ORDER BY cache_status DESC, name`;
        const cacheDataList = await duckdb.query(cacheDataQuery);
        // Build a quick lookup for cache status by view name (using camelCase keys)
        const viewCacheByName: Record<string, string> = {};
        (cacheDataList as any[]).forEach((c: any) => {
          const status = (c.cacheStatus || c.cache_status || '').toString().toLowerCase();
          if (c.name) viewCacheByName[c.name] = status;
        });

        // Get associations list for the Associations tab
        const associationsQuery = `SELECT id, name, kind, database, folder, endpoints, mapping FROM associations WHERE database = '${dbName}' ORDER BY name`;
        const associationsList = await duckdb.query(associationsQuery);

        // Get database-level cache configuration (ALTER DATABASE ... CACHE ...)
        let cacheEnabledDatabase = false;
        let cacheDatasource: string | null = null;
        try {
          const cacheCfgRows = await duckdb.query(
            `SELECT enabled, datasource FROM database_cache WHERE database = '${dbName}' LIMIT 1`
          );
          if (cacheCfgRows.length > 0) {
            cacheEnabledDatabase = !!(cacheCfgRows[0] as any).enabled;
            cacheDatasource = (cacheCfgRows[0] as any).datasource || null;
          }
        } catch (e) {
          // table may not exist on older analyses
        }

        setDbDetails({
          name: db.name,
          dataSources: Number(db.dataSources || 0),
          baseViews: Number(db.baseViews || 0),
          derivedViews: Number(db.derivedViews || 0),
          interfaceViews: Number(db.interfaceViews || 0),
          totalViews: totalViews,
          cachedViews: cachedViews,
          associations: Number(db.associations || 0),
          cachePercentage,
          statsEnabled,
          wrappers,
          dataSourcesByType,
          cacheStatus,
          dataSourcesList: dataSourcesList as DataSource[],
          viewsList: viewsList as View[],
          cacheDataList: cacheDataList as CacheData[],
          associationsList: associationsList as Association[]
          ,
          viewStatsByName,
          viewCacheByName,
          cacheEnabledDatabase,
          cacheDatasource
        });
      }
    } catch (error) {
      console.error('Failed to load database details:', error);
    } finally {
      setLoading(false);
    }
  }, [dbName]);

  useEffect(() => {
    // Only load if dbName is set
    if (dbName) {
      loadDatabaseDetails();
    }
  }, [loadDatabaseDetails, dbName]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '2px solid #3498db',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>
      </div>
    );
  }

  if (!dbDetails) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', paddingTop: '40px' }}>
          <Database size={48} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '8px'
          }}>Database not found</h3>
          <button
            onClick={() => router.push('/databases')}
            style={{
              fontSize: '14px',
              color: '#3498db',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            ← Back to Databases
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'datasources', label: `Data Sources`, count: dbDetails.dataSources, icon: Layers },
    { id: 'views', label: `Views`, count: dbDetails.totalViews, icon: Eye },
    { id: 'cache', label: 'Cache', count: dbDetails.cachedViews, icon: Settings },
    { id: 'associations', label: `Associations`, count: dbDetails.associations, icon: Link2 },
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#fafbfc', minHeight: '100vh' }}>
      {/* Compact Header */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => router.push('/databases')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: '#6b7280',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '12px',
            padding: '4px',
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
        >
          <ArrowLeft size={12} />
          <span>Back to Databases</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={24} color="#3b82f6" />
          <div>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#1f2937',
              margin: 0,
              lineHeight: 1.2
            }}>{dbDetails.name}</h1>
            <p style={{
              fontSize: '12px',
              color: '#9ca3af',
              margin: 0
            }}>Database Overview</p>
          </div>
        </div>
      </div>

      {/* Compact Tabs */}
      <div style={{
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '20px'
      }}>
        <nav style={{ display: 'flex', gap: '4px' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '-1px'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) e.currentTarget.style.color = '#6b7280';
                }}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span style={{
                    padding: '1px 5px',
                    backgroundColor: activeTab === tab.id ? '#dbeafe' : '#f3f4f6',
                    color: activeTab === tab.id ? '#1e40af' : '#6b7280',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: 600
                  }}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Compact Professional KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginBottom: '24px'
          }}>
            {/* Data Sources - Soft Blue */}
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '16px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Layers size={18} color="#3b82f6" />
                <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                  Data Sources
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: '#1e40af' }}>
                {dbDetails.dataSources}
              </div>
            </div>

            {/* Base Views - Soft Green */}
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Database size={18} color="#16a34a" />
                <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                  Base Views
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: '#15803d' }}>
                {dbDetails.baseViews}
              </div>
            </div>

            {/* Derived Views - Soft Indigo */}
            <div style={{
              backgroundColor: '#eef2ff',
              border: '1px solid #c7d2fe',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Eye size={18} color="#6366f1" />
                <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                  Derived Views
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: '#4f46e5' }}>
                {dbDetails.derivedViews}
              </div>
            </div>

            {/* Interface Views - Soft Rose */}
            <div style={{
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Eye size={18} color="#e11d48" />
                <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                  Interface Views
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: '#be123c' }}>
                {dbDetails.interfaceViews}
              </div>
            </div>

            {/* Cache Coverage - Soft Cyan */}
            <div style={{
              backgroundColor: '#ecfeff',
              border: '1px solid #a5f3fc',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Settings size={18} color="#0891b2" />
                <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                  Cache
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: '#0e7490' }}>
                {dbDetails.cachePercentage}%
              </div>
            </div>

            {/* Wrappers - Soft Amber */}
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Shield size={18} color="#d97706" />
                <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                  Wrappers
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: '#b45309' }}>
                {dbDetails.wrappers}
              </div>
            </div>

            {/* Stats Enabled - Soft Purple */}
            <div style={{
              backgroundColor: '#faf5ff',
              border: '1px solid #e9d5ff',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Activity size={18} color="#9333ea" />
                <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                  Stats
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: '#7e22ce' }}>
                {dbDetails.statsEnabled}
              </div>
            </div>
          </div>

          {/* Compact Three Column Breakdown */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {/* Views by Type */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Views by Type</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'base', value: dbDetails.baseViews },
                  { label: 'derived', value: dbDetails.derivedViews },
                  { label: 'interface', value: dbDetails.interfaceViews }
                ].map((item) => (
                  <div key={item.label} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#6b7280'
                    }}>{item.label}</span>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#111827'
                    }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Sources by Type */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Data Sources by Type</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {Object.entries(dbDetails.dataSourcesByType).map(([type, count]) => (
                  <div key={type} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#6b7280'
                    }}>{type}</span>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#111827'
                    }}>{count}</span>
                  </div>
                ))}
                {Object.keys(dbDetails.dataSourcesByType).length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    color: '#9ca3af',
                    fontSize: '12px'
                  }}>No data sources</div>
                )}
              </div>
            </div>

            {/* Database Cache (DB-level) */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Database Cache</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>Status</span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: dbDetails.cacheEnabledDatabase ? '#15803d' : '#6b7280',
                    backgroundColor: dbDetails.cacheEnabledDatabase ? '#dcfce7' : '#f3f4f6',
                    border: dbDetails.cacheEnabledDatabase ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
                    padding: '2px 8px',
                    borderRadius: '9999px'
                  }}>
                    {dbDetails.cacheEnabledDatabase ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {dbDetails.cacheEnabledDatabase && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0'
                  }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Datasource</span>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                      {dbDetails.cacheDatasource || '—'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Cache Status */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Cache Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'full', value: dbDetails.cacheStatus.full },
                  { label: 'partial', value: dbDetails.cacheStatus.partial },
                  { label: 'off', value: dbDetails.cacheStatus.off }
                ].map((item) => (
                  <div key={item.label} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#6b7280'
                    }}>{item.label}</span>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#111827'
                    }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Sources Tab */}
      {activeTab === 'datasources' && dbDetails.dataSourcesList && (
        <DataSourcesTab datasources={dbDetails.dataSourcesList} />
      )}

      {/* Views Tab */}
      {activeTab === 'views' && dbDetails.viewsList && (
        <ViewsTab views={dbDetails.viewsList} viewStats={dbDetails.viewStatsByName || {}} viewCache={dbDetails.viewCacheByName || {}} />
      )}

      {/* Cache Tab */}
      {activeTab === 'cache' && dbDetails.cacheDataList && dbDetails.viewsList && (
        <CacheTab cacheData={dbDetails.cacheDataList} views={dbDetails.viewsList} />
      )}

      {/* Associations Tab */}
      {activeTab === 'associations' && dbDetails.associationsList && (
        <AssociationsTab associations={dbDetails.associationsList} />
      )}

      {/* Other Tabs - Coming Soon */}
      {activeTab !== 'overview' && activeTab !== 'datasources' && activeTab !== 'views' && activeTab !== 'cache' && activeTab !== 'associations' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '48px',
          textAlign: 'center',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <BarChart3 size={40} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
          <h3 style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '6px'
          }}>Coming Soon</h3>
          <p style={{
            fontSize: '13px',
            color: '#6b7280'
          }}>
            The {tabs.find(t => t.id === activeTab)?.label} tab is under development.
          </p>
        </div>
      )}
    </div>
  );
}
