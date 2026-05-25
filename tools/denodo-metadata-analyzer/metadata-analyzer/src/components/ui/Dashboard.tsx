'use client';

import React, { useState } from 'react';
import { Database, BarChart3, Layers, Eye, Download, FileText, PieChart as PieChartIcon, Trophy } from 'lucide-react';
import { colors, spacing, borderRadius, shadows, typography } from '../../lib/theme';

// Import chart components (TypeScript)
import PieChart from '../PieChart.tsx';
import HorizontalBar from '../HorizontalBar.tsx';
import VerticalBar from '../VerticalBar.tsx';
import StackedHorizontalBar from '../StackedHorizontalBar.tsx';
import { DataSourceAnalyticsService } from '../../lib/services/datasource-analytics-service';
import PDFExportDialog from '../../../app/components/PDFExportDialog';
import { PDFExportService } from '../../lib/services/pdf-export-service';
import { DuckDBClient } from '../../lib/database/duckdb-client';
import { useComplexity } from '@/contexts/ComplexityContext';

interface DashboardProps {
  analysisData: any;
  onDatabaseSelect?: (database: string) => void;
  onViewChange?: (view: string) => void;
  analysisService?: any;
  complexityResults?: any;
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  color: string;
}

interface ChartDataItem {
  label: string;
  value: number;
  color: string;
}

const Dashboard: React.FC<DashboardProps> = ({
  analysisData,
  onDatabaseSelect,
  onViewChange,
  analysisService,
  complexityResults
}) => {
  const [showPDFDialog, setShowPDFDialog] = useState(false);
  const { complexityResults: contextComplexityResults } = useComplexity();

  // Transform DuckDB flat structure to expected nested structure
  const transformDataForDashboard = (data: any) => {
    if (!data) return { databases: [], stats: {} };

    const {
      databases: rawDatabases = [],
      datasources = [],
      views = [],
      wrappers = [],
      stats = {}
    } = data;

    // If databases table is empty, create databases from views and datasources
    let transformedDatabases = rawDatabases;

    if (rawDatabases.length === 0) {
      // Extract unique database names from views and datasources
      const databaseNames = new Set<string>();

      views.forEach((view: any) => {
        if (view.database && view.database.trim() !== '') {
          databaseNames.add(view.database);
        }
      });

      datasources.forEach((ds: any) => {
        if (ds.database && ds.database.trim() !== '') {
          databaseNames.add(ds.database);
        }
      });

      // If still no database names found, create a default database grouping
      if (databaseNames.size === 0) {
        console.log('[Dashboard] No database names found, creating default grouping');
        // Create a single "Unknown" database that contains all data
        transformedDatabases = [{
          name: 'Unknown Database',
          dataSources: datasources, // All datasources
          views: views, // All views
          wrappers: wrappers, // All wrappers
          metrics: {
            viewsByType: {
              base: views.filter((v: any) => v.type === 'base' || v.type === 'BASE').length,
              derived: views.filter((v: any) => v.type === 'derived' || v.type === 'DERIVED').length,
              interface: views.filter((v: any) => v.type === 'interface' || v.type === 'INTERFACE').length
            },
            totalViews: views.length,
            totalDataSources: datasources.length,
            totalWrappers: wrappers.length
          }
        }];
      } else {
        // Create synthetic database objects
        transformedDatabases = Array.from(databaseNames).map(dbName => {
          const dbViews = views.filter((view: any) => view.database === dbName);
          const dbDatasources = datasources.filter((ds: any) => ds.database === dbName);
          const dbWrappers = wrappers.filter((wrapper: any) => wrapper.database === dbName);

          // Calculate view metrics for this database
          const baseViews = dbViews.filter((v: any) => v.type === 'base' || v.type === 'BASE').length;
          const derivedViews = dbViews.filter((v: any) => v.type === 'derived' || v.type === 'DERIVED').length;
          const interfaceViews = dbViews.filter((v: any) => v.type === 'interface' || v.type === 'INTERFACE').length;

          return {
            name: dbName,
            dataSources: dbDatasources, // Required by DataSourceAnalyticsService
            views: dbViews,
            wrappers: dbWrappers,
            metrics: {
              viewsByType: {
                base: baseViews,
                derived: derivedViews,
                interface: interfaceViews
              },
              totalViews: baseViews + derivedViews + interfaceViews,
              totalDataSources: dbDatasources.length,
              totalWrappers: dbWrappers.length
            }
          };
        });
      }
    } else {
      // If databases exist, enrich them with datasources and views
      // Only enrich if not already enriched (to avoid overwriting dataSources from page.tsx)
      transformedDatabases = rawDatabases.map((db: any) => ({
        ...db,
        // Use existing dataSources if already attached, otherwise filter from flat datasources array
        dataSources: db.dataSources || datasources.filter((ds: any) => ds.database === db.name),
        views: db.views || views.filter((view: any) => view.database === db.name),
        wrappers: db.wrappers || wrappers.filter((wrapper: any) => wrapper.database === db.name)
      }));
    }

    // Preserve original stats if transformation produces no databases but original stats exist
    const finalStats = {
      ...stats,
      totalDatabases: transformedDatabases.length || stats.totalDatabases || 0
    };

    return {
      databases: transformedDatabases,
      stats: finalStats
    };
  };

  const transformedData = transformDataForDashboard(analysisData);
  const { databases = [], stats = {} } = transformedData;

  // Debug logging
  console.log('[Dashboard] Original analysisData:', analysisData);
  console.log('[Dashboard] Original stats before transformation:', analysisData?.stats);
  console.log('[Dashboard] transformedData:', transformedData);
  console.log('[Dashboard] databases:', databases);
  console.log('[Dashboard] Final stats after transformation:', stats);

  // Calculate totals for professional cards
  const totalViews = (stats.totalBaseViews || 0) + (stats.totalDerivedViews || 0) + (stats.totalInterfaceViews || 0);

  // Prepare pie chart data for view types
  const pieChartData = [
    {
      label: 'Base Views',
      value: stats.totalBaseViews || 0,
      color: colors.successLight
    },
    {
      label: 'Derived Views',
      value: stats.totalDerivedViews || 0,
      color: colors.accent
    },
    {
      label: 'Interface Views',
      value: stats.totalInterfaceViews || 0,
      color: colors.errorLight
    }
  ];

  // Prepare data source breakdown chart data - count ALL datasources directly
  const dataSourceChartData: ChartDataItem[] = [];

  // Define colors for different data source types
  const dataSourceColors: { [key: string]: string } = {
    'JDBC': colors.primarySolid,
    'DelimitedFile': colors.databaseSolid,
    'Custom': colors.accent,
    'CUSTOM': colors.accent,
    'JSON': colors.successLight,
    'XML': colors.warningLight,
    'MONGODB': colors.errorLight,
    'SALESFORCE': colors.primaryLight,
    'LDAP': colors.cacheEnabled,
    'ODBC': colors.gray600
  };

  // Count datasources by type from analysisData.datasources (all datasources, not just those attached to databases)
  if (analysisData?.datasources && Array.isArray(analysisData.datasources)) {
    const typeCounts: { [key: string]: number } = {};

    analysisData.datasources.forEach((ds: any) => {
      if (ds.type) {
        typeCounts[ds.type] = (typeCounts[ds.type] || 0) + 1;
      }
    });

    console.log('[Dashboard] Datasource type counts:', typeCounts);

    // Convert to chart data format (excluding Web Services)
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (type !== 'REST' && type !== 'SOAP' && count > 0) {
        dataSourceChartData.push({
          label: type === 'DelimitedFile' ? 'Delimited File' :
                 type === 'Custom' || type === 'CUSTOM' ? 'Custom Wrapper' :
                 type === 'MONGODB' ? 'MongoDB' :
                 type === 'SALESFORCE' ? 'Salesforce' :
                 type,
          value: count,
          color: dataSourceColors[type] || colors.gray400
        });
      }
    });

    // Sort by count descending for better visual display
    dataSourceChartData.sort((a, b) => b.value - a.value);
  }

  console.log('[Dashboard] dataSourceChartData:', dataSourceChartData);

  // Prepare top 10 databases data for stacked horizontal bar chart
  const topDatabasesData = databases
    .map((database: any) => {
      const metrics = database.metrics || {};

      // Handle both the new metrics structure and fallback to direct calculation
      let baseViews = metrics.viewsByType?.base || 0;
      let derivedViews = metrics.viewsByType?.derived || 0;
      let interfaceViews = metrics.viewsByType?.interface || 0;

      // If metrics are not available, calculate from views array
      if (!baseViews && !derivedViews && !interfaceViews && database.views) {
        baseViews = database.views.filter((v: any) => v.type === 'base' || v.type === 'BASE').length;
        derivedViews = database.views.filter((v: any) => v.type === 'derived' || v.type === 'DERIVED').length;
        interfaceViews = database.views.filter((v: any) => v.type === 'interface' || v.type === 'INTERFACE').length;
      }

      const totalViews = baseViews + derivedViews + interfaceViews;

      return {
        name: database.name,
        total: totalViews,
        base: baseViews,
        derived: derivedViews,
        interface: interfaceViews
      };
    })
    .filter((db: any) => db.total > 0) // Only include databases with views
    .sort((a: any, b: any) => b.total - a.total) // Sort by total views descending
    .slice(0, 10); // Take top 10

  console.log('[Dashboard] topDatabasesData:', topDatabasesData);

  const handleExportJSON = async () => {
    if (analysisService) {
      try {
        await analysisService.exportToJSON();
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed. Please try again.');
      }
    }
  };

  const handleExportSummaryPDF = async () => {
    // Show the new professional PDF export dialog
    setShowPDFDialog(true);
  };

  const handlePDFExport = async (options: any) => {
    setShowPDFDialog(false);

    // Show loading message
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdf-loading';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    loadingDiv.innerHTML = `
      <div style="background: white; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);">
        <div style="width: 48px; height: 48px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
        <p style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0 0 8px 0;">Generating PDF Report</p>
        <p style="font-size: 14px; color: #64748b; margin: 0;">This may take a moment...</p>
      </div>
    `;
    document.body.appendChild(loadingDiv);

    try {
      // Fetch server configuration and additional counts from DuckDB
      const client = new DuckDBClient();
      await client.initialize();
      await client.loadFromParquet();

      let serverConfig: any = {};
      let cacheDataCount = 0;
      let associationsCount = 0;
      let statsEnabledCount = 0;
      let resourcePlansCount = 0;
      let resourceRulesCount = 0;

      try {
        const result = await client.query('SELECT * FROM server_configuration ORDER BY timestamp DESC LIMIT 1');
        if (result && result.length > 0) {
          const configRow = result[0];
          if (configRow.configuration) {
            if (typeof configRow.configuration === 'string') {
              serverConfig = JSON.parse(configRow.configuration);
            } else {
              serverConfig = configRow.configuration;
            }
          }

          // Resolve property references
          const propsStr = localStorage.getItem('uploaded_properties');
          if (propsStr) {
            const properties = JSON.parse(propsStr);
            for (const [key, value] of Object.entries(serverConfig)) {
              if (typeof value === 'string' && value.includes('${config.')) {
                const match = value.match(/\$\{config\.((?:WEBCONTAINER\.)?PROPERTY)\.([^}]+)\}/);
                if (match) {
                  const fullPropertyKey = `config.${match[1]}.${match[2]}`;
                  if (properties[fullPropertyKey]) {
                    serverConfig[key] = properties[fullPropertyKey];
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load server configuration:', error);
      }

      // Fetch JDBC duplicates from the duplicates table
      let jdbcDuplicates: any[] = [];
      try {
        jdbcDuplicates = await client.query("SELECT id, type, connection_string as connectionString, count, sources, analysis_id FROM duplicates WHERE type = 'jdbc' ORDER BY count DESC");
      } catch (error) {
        console.log('duplicates table not available');
      }

      // Fetch additional counts from separate tables
      try {
        const cacheData = await client.query('SELECT * FROM cache_data');
        cacheDataCount = cacheData.length;
      } catch (error) {
        console.log('cache_data table not available');
      }

      try {
        const associations = await client.query('SELECT * FROM associations');
        associationsCount = associations.length;
      } catch (error) {
        console.log('associations table not available');
      }

      try {
        const viewStats = await client.query('SELECT * FROM view_stats WHERE enabled = true');
        statsEnabledCount = viewStats.length;
      } catch (error) {
        console.log('view_stats table not available');
      }

      try {
        const resourcePlans = await client.query('SELECT * FROM resource_plans');
        resourcePlansCount = resourcePlans.length;
      } catch (error) {
        console.log('resource_plans table not available');
      }

      try {
        const resourceRules = await client.query('SELECT * FROM resource_rules');
        resourceRulesCount = resourceRules.length;
      } catch (error) {
        console.log('resource_rules table not available');
      }

      // Prepare lightweight data for PDF export (only essential fields, no full objects)
      const pdfData = {
        databases: (analysisData?.databases || []).map((db: any) => ({
          name: db.name,
          cacheStatus: db.cacheStatus,
          denodoVersion: db.denodoVersion
        })),
        dataSources: (analysisData?.datasources || []).map((ds: any) => ({
          name: ds.name,
          type: ds.type,
          database: ds.database,
          url: ds.url,  // JDBC URL field
          databaseName: ds.database_name || ds.databaseName,
          username: ds.username,
          properties: ds.properties  // Include properties for URL extraction
        })),
        views: (analysisData?.views || []).map((v: any) => ({
          name: v.name,
          database: v.database,
          kind: v.kind,
          type: v.type,
          complexityScore: v.complexityScore,
          cacheEnabled: v.cacheEnabled,
          statsEnabled: v.statsEnabled,
          hasAssociations: v.hasAssociations
        })),
        globalElements: (analysisData?.globalElements || []).map((el: any) => ({
          type: el.type
        })),
        serverConfiguration: serverConfig,
        denodoVersion: analysisData?.denodoVersion,
        fileName: analysisData?.fileName,
        // Additional counts from separate tables
        additionalCounts: {
          cacheEnabled: cacheDataCount,
          associations: associationsCount,
          statsEnabled: statsEnabledCount,
          resourcePlans: resourcePlansCount,
          resourceRules: resourceRulesCount
        },
        duplicateRows: jdbcDuplicates,
        // Include Python complexity results from ComplexityContext
        complexityData: contextComplexityResults?.top_views || []
      };

      // Generate PDF
      const pdfService = new PDFExportService();
      await pdfService.generateReport(pdfData, options);

      // Remove loading message
      const loader = document.getElementById('pdf-loading');
      if (loader) loader.remove();
    } catch (error) {
      console.error('PDF export failed:', error);

      // Remove loading message
      const loader = document.getElementById('pdf-loading');
      if (loader) loader.remove();

      alert('PDF export failed. Please try again.');
    }
  };

  return (
    <>
      {showPDFDialog && (
        <PDFExportDialog
          onClose={() => setShowPDFDialog(false)}
          onExport={handlePDFExport}
          analysisData={analysisData}
        />
      )}

      <div style={styles.container}>
        {/* Header with Version Info */}
        <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <Database size={32} style={{ color: colors.primarySolid }} />
          <div>
            <h1 style={styles.title}>Analysis Dashboard</h1>
            <p style={styles.subtitle}>
              Overview of your Denodo metadata analysis
            </p>
          </div>
        </div>

        <div style={styles.headerRight}>
          {/* Version Info - Top Right */}
          {analysisData?.denodoVersion && (
            <div style={styles.versionInfo}>
              <div style={styles.versionTitle}>Denodo Platform {analysisData.denodoVersion}</div>
              <div style={styles.versionSubtitle}>Analysis Report</div>
            </div>
          )}

          <div style={styles.exportButtons}>
            <button onClick={handleExportSummaryPDF} style={styles.summaryButton}>
              <FileText size={16} />
              Summary Report
            </button>
            <button onClick={handleExportJSON} style={styles.exportButton}>
              <Download size={16} />
              Export Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Professional Summary Cards */}
      <div style={styles.professionalStatsGrid}>
        <ProfessionalStatCard
          icon={<Database size={28} />}
          title="Total Databases"
          value={stats.totalDatabases || 0}
          color={colors.primarySolid}
        />
        <ProfessionalStatCard
          icon={<Layers size={28} />}
          title="Total Data Sources"
          value={stats.totalDataSources || stats.totalDatasources || 0}
          color={colors.databaseSolid}
        />
        <ProfessionalStatCard
          icon={<Eye size={28} />}
          title="Total Views"
          value={totalViews}
          color={colors.accent}
        />
      </div>

      {/* Analytics Section */}
      <div style={styles.analyticsSection}>
        {/* Top Row - Pie Chart and Bar Chart */}
        <div style={styles.topRowContainer}>
          {/* View Type Distribution - Left */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <PieChartIcon size={20} />
              <h3 style={styles.chartTitle}>View Type Distribution</h3>
            </div>
            <PieChart
              data={pieChartData as any}
              size={200}
            />
          </div>

          {/* Data Source Breakdown Chart - Right */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <BarChart3 size={20} />
              <h3 style={styles.chartTitle}>Data Source Technology Breakdown</h3>
            </div>
            {dataSourceChartData.length > 0 ? (
              <VerticalBar
                data={dataSourceChartData as any}
                maxHeight={180}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', color: colors.gray500 }}>
                No data source data available
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row - Top 10 Databases and Detailed Analysis */}
        <div style={styles.bottomRowContainer}>
          {/* Top 10 Databases Chart - Left */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <Trophy size={20} />
              <h3 style={styles.chartTitle}>Top 10 Databases by Views</h3>
            </div>
            {topDatabasesData.length > 0 ? (
              <StackedHorizontalBar
                data={topDatabasesData as any}
                maxBars={10}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: colors.gray500 }}>
                No database data available
              </div>
            )}
          </div>

          {/* Detailed View Analysis - Right */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <BarChart3 size={20} />
              <h3 style={styles.chartTitle}>Detailed View Analysis</h3>
            </div>

            <div style={styles.barsContainer}>
              {/* View Type Bars */}
              <HorizontalBar
                label="Base Views"
                value={stats.totalBaseViews || 0}
                total={totalViews}
                color={colors.successLight}
              />

              <HorizontalBar
                label="Interface Views"
                value={stats.totalInterfaceViews || 0}
                total={totalViews}
                color={colors.errorLight}
              />

              <HorizontalBar
                label="Derived Views"
                value={stats.totalDerivedViews || 0}
                total={totalViews}
                color={colors.accent}
              />

              {/* Additional Metrics with Arrows */}
              <HorizontalBar
                label="Cached Views"
                value={stats.totalCachedViews || 0}
                total={totalViews}
                color={colors.cacheEnabled}
                hasArrow={true}
              />

              <HorizontalBar
                label="Associations"
                value={stats.totalAssociations || 0}
                total={stats.totalDataSources || 1}
                color={colors.primaryLight}
                hasArrow={true}
              />

              <HorizontalBar
                label="Stats Enabled Views"
                value={stats.totalStatsEnabled || 0}
                total={totalViews}
                color={colors.warningLight}
                hasArrow={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

// Professional Stat Card Component
const ProfessionalStatCard: React.FC<StatCardProps> = ({ icon, title, value, color }) => (
  <div style={styles.professionalStatCard}>
    <div style={{ ...styles.professionalStatIcon, color }}>
      {icon}
    </div>
    <div style={styles.professionalStatContent}>
      <div style={styles.professionalStatValue}>{(value || 0).toLocaleString()}</div>
      <div style={styles.professionalStatTitle}>{title}</div>
    </div>
  </div>
);

// Component styles using our modern theme system
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: spacing.lg
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.sm
  },

  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray800,
    margin: `0 0 ${spacing.xs} 0`,
    lineHeight: typography.lineHeight.tight
  },

  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.gray600,
    margin: 0
  },

  headerRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: spacing.md
  },

  versionInfo: {
    textAlign: 'right' as const,
    marginBottom: spacing.sm
  },

  versionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    margin: 0,
    color: colors.gray800
  },

  versionSubtitle: {
    fontSize: typography.fontSize.sm,
    margin: 0,
    fontWeight: typography.fontWeight.normal,
    color: colors.gray600
  },

  exportButtons: {
    display: 'flex',
    gap: spacing.md
  },

  summaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.lg}`,
    backgroundColor: colors.success,
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },

  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.lg}`,
    backgroundColor: colors.primarySolid,
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },

  // Professional stats grid
  professionalStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: spacing.lg,
    marginBottom: spacing.xl
  },

  professionalStatCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    border: `1px solid ${colors.gray200}`,
    boxShadow: shadows.sm,
    transition: 'all 0.2s ease'
  },

  professionalStatIcon: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  professionalStatContent: {
    flex: 1
  },

  professionalStatValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray900,
    lineHeight: typography.lineHeight.tight,
    marginBottom: spacing.xs
  },

  professionalStatTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    lineHeight: typography.lineHeight.tight
  },

  // Analytics section
  analyticsSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing.lg,
    marginBottom: spacing.xl
  },

  // Top row container for aligned charts
  topRowContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.lg,
    alignItems: 'stretch'
  },

  // Bottom row container for aligned charts
  bottomRowContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.lg,
    alignItems: 'stretch'
  },

  chartCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    border: `1px solid ${colors.gray200}`,
    boxShadow: shadows.sm,
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: '350px'
  },

  chartHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottom: `1px solid ${colors.gray200}`
  },

  chartTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray800,
    margin: 0,
    lineHeight: typography.lineHeight.tight
  },

  barsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing.sm
  }
};

export default Dashboard;