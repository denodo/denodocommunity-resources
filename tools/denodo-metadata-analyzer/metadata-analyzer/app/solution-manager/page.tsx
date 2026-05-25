'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Server,
  Database,
  GitBranch,
  Activity,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  HardDrive,
  Calendar,
  Shield
} from 'lucide-react';
import { DuckDBClient } from '../../src/lib/database/duckdb-client';
import { SolutionManagerParser } from '../../src/lib/services/solution-manager-parser';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/lib/theme';

type TabType = 'environments' | 'vcs' | 'monitoring';

export default function SolutionManagerPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('environments');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data state
  const [environments, setEnvironments] = useState<any[]>([]);
  const [vcsConfig, setVcsConfig] = useState<any>(null);
  const [globalMonitoring, setGlobalMonitoring] = useState<any>(null);
  const [version, setVersion] = useState<string | null>(null);

  // Active tab states for nested navigation
  const [activeEnvIndex, setActiveEnvIndex] = useState<number>(0);
  const [activeClusterIndexes, setActiveClusterIndexes] = useState<Record<number, number>>({});

  // Load data on component mount
  useEffect(() => {
    loadSolutionManagerData()
      .catch(err => {
        console.error('Failed to load solution manager data on mount:', err);
        // Don't set error state if no data exists yet
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const loadSolutionManagerData = async () => {
    try {
      console.log('[SolutionManager] Loading solution manager data...');
      const client = new DuckDBClient();
      await client.initialize();
      console.log('[SolutionManager] DuckDB initialized');
      await client.loadFromParquet();
      console.log('[SolutionManager] Parquet loaded');

      // Load environments with their clusters and nodes
      const envs = await client.query(`
        SELECT * FROM sm_environments ORDER BY
        CASE
          WHEN LOWER(name) LIKE '%dev%' THEN 1
          WHEN LOWER(name) LIKE '%test%' THEN 2
          WHEN LOWER(name) LIKE '%uat%' THEN 3
          WHEN LOWER(name) LIKE '%prod%' THEN 4
          ELSE 5
        END
      `);

      console.log('[SolutionManager] Loaded environments:', envs.length);
      if (envs.length > 0) {
        console.log('[SolutionManager] First environment:', envs[0]);
      }

      // Load clusters, nodes, deployment, and monitoring config for each environment
      const enrichedEnvs = await Promise.all(envs.map(async (env: any) => {
        const envId = env.env_id || env.envId || env.id;
        const clusters = await client.query(`SELECT * FROM sm_clusters WHERE env_id = ${envId}`);
        const deploymentConfig = await client.query(`SELECT * FROM sm_deployment_config WHERE env_id = ${envId}`);

        const enrichedClusters = await Promise.all(clusters.map(async (cluster: any) => {
          const clusterId = cluster.cluster_id || cluster.clusterId || cluster.id;
          const nodes = await client.query(`SELECT * FROM sm_nodes WHERE cluster_id = ${clusterId}`);
          return { ...cluster, nodes };
        }));

        return {
          ...env,
          clusters: enrichedClusters,
          deploymentConfig: deploymentConfig[0] || null
        };
      }));

      console.log('Enriched environments:', enrichedEnvs.length);
      setEnvironments(enrichedEnvs);

      // Load VCS config
      const vcs = await client.query('SELECT * FROM sm_vcs_config LIMIT 1');
      setVcsConfig(vcs[0] || null);
      console.log('VCS config loaded:', vcs[0] ? 'yes' : 'no');

      // Load global monitoring
      const globalMon = await client.query('SELECT * FROM sm_global_monitoring LIMIT 1');
      setGlobalMonitoring(globalMon[0] || null);
      console.log('Global monitoring loaded:', globalMon[0] ? 'yes' : 'no');

      // Load version
      const metadata = await client.query('SELECT * FROM sm_metadata LIMIT 1');
      setVersion(metadata[0]?.version || null);
      console.log('[SolutionManager] Version loaded:', metadata[0]?.version || 'none');

      setError(null);
      console.log('✅ Solution Manager data loaded successfully');

    } catch (error: any) {
      console.error('❌ Error loading solution manager data:', error);
      throw error;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      const client = new DuckDBClient();
      await client.initialize();
      await client.loadFromParquet();

      const parser = new SolutionManagerParser(client);
      const result = await parser.parseSolutionManagerJSON(jsonData);

      if (result.success) {
        setSuccess(result.message);
        // Load data from the same client instance that just saved the data
        console.log('Upload successful, loading data from current client...');
        try {
          // Load environments with their clusters and nodes from the same client
          const envs = await client.query(`
            SELECT * FROM sm_environments ORDER BY
            CASE
              WHEN LOWER(name) LIKE '%dev%' THEN 1
              WHEN LOWER(name) LIKE '%test%' THEN 2
              WHEN LOWER(name) LIKE '%uat%' THEN 3
              WHEN LOWER(name) LIKE '%prod%' THEN 4
              ELSE 5
            END
          `);

          console.log('Loaded environments:', envs.length);
          if (envs.length > 0) {
            console.log('Sample environment object:', envs[0]);
          }

          // Load clusters, nodes, deployment, and monitoring config for each environment
          const enrichedEnvs = await Promise.all(envs.map(async (env: any) => {
            // Use the correct column name - check both snake_case and camelCase
            const envId = env.env_id || env.envId || env.id;
            console.log('Processing environment:', env.name, 'with id:', envId);

            const clusters = await client.query(`SELECT * FROM sm_clusters WHERE env_id = ${envId}`);
            const deploymentConfig = await client.query(`SELECT * FROM sm_deployment_config WHERE env_id = ${envId}`);

            console.log('Deployment config for env', env.name, ':', deploymentConfig);

            const enrichedClusters = await Promise.all(clusters.map(async (cluster: any) => {
              const clusterId = cluster.cluster_id || cluster.clusterId || cluster.id;
              const nodes = await client.query(`SELECT * FROM sm_nodes WHERE cluster_id = ${clusterId}`);
              return { ...cluster, nodes };
            }));

            return {
              ...env,
              clusters: enrichedClusters,
              deploymentConfig: deploymentConfig[0] || null
            };
          }));

          setEnvironments(enrichedEnvs);

          // Load VCS config
          const vcs = await client.query('SELECT * FROM sm_vcs_config LIMIT 1');
          setVcsConfig(vcs[0] || null);

          // Load global monitoring
          const globalMon = await client.query('SELECT * FROM sm_global_monitoring LIMIT 1');
          setGlobalMonitoring(globalMon[0] || null);

          // Load version
          const metadata = await client.query('SELECT * FROM sm_metadata LIMIT 1');
          setVersion(metadata[0]?.version || null);
          console.log('Version loaded after upload:', metadata[0]?.version || 'none');

          setError(null);
          console.log('✅ Data loaded and displayed successfully');
        } catch (loadError: any) {
          console.error('Error loading data after upload:', loadError);
          setError('Data imported but failed to display. Please refresh the page.');
        }
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      console.error('Error processing file:', error);
      setError('Invalid JSON file. Please upload a valid Solution Manager export.');
    } finally {
      setUploading(false);
      event.target.value = ''; // Reset input
    }
  };

  // Helper to get environment color
  const getEnvironmentColor = (name: string, index: number) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('dev')) return { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', active: '#DBEAFE' };
    if (lowerName.includes('test')) return { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', active: '#FEF08A' };
    if (lowerName.includes('uat')) return { bg: '#FED7AA', border: '#FDBA74', text: '#9A3412', active: '#FED7AA' };
    if (lowerName.includes('prod')) return { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', active: '#FECACA' };

    // Fallback colors for other environments
    const fallbackColors = [
      { bg: '#F3E8FF', border: '#C084FC', text: '#6B21A8', active: '#E9D5FF' },
      { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', active: '#A7F3D0' },
    ];
    return fallbackColors[index % fallbackColors.length];
  };


  const hasData = environments.length > 0;
  const totalClusters = environments.reduce((sum, env) => sum + (env.clusters?.length || 0), 0);
  const totalNodes = environments.reduce((sum, env) => {
    return sum + env.clusters?.reduce((clusterSum: number, cluster: any) =>
      clusterSum + (cluster.nodes?.length || 0), 0) || 0;
  }, 0);

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '400px'
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
          <p style={{ fontSize: '14px', color: '#666' }}>Loading Solution Manager data...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard')}
        style={styles.backButton}
        onMouseEnter={(e) => e.currentTarget.style.color = colors.accent}
        onMouseLeave={(e) => e.currentTarget.style.color = colors.gray600}
      >
        <ArrowLeft size={16} />
        <span>Back to Dashboard</span>
      </button>

      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={styles.headerIcon}>
            <Server size={22} color={colors.white} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={styles.title}>Solution Manager Overview</h1>
              {version && (
                <span style={{
                  padding: '4px 12px',
                  backgroundColor: colors.accent + '15',
                  color: colors.accent,
                  borderRadius: borderRadius.full,
                  fontSize: '13px',
                  fontWeight: typography.fontWeight.medium
                }}>
                  v{version}
                </span>
              )}
            </div>
            <p style={styles.subtitle}>Denodo environment configuration and deployment settings</p>
          </div>
        </div>

        {/* Upload Button */}
        <label style={styles.uploadButton}>
          <Upload size={16} />
          <span>{uploading ? 'Uploading...' : 'Upload JSON'}</span>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={styles.successMessage}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} style={styles.closeButton}>×</button>
        </div>
      )}

      {error && (
        <div style={styles.errorMessage}>
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={styles.closeButton}>×</button>
        </div>
      )}

      {hasData ? (
        <>
          {/* Summary Stats */}
          <div style={styles.statsRow}>
            <StatCard
              icon={<Database size={20} />}
              label="Environments"
              value={environments.length}
              color="#3B82F6"
            />
            <StatCard
              icon={<HardDrive size={20} />}
              label="Clusters"
              value={totalClusters}
              color="#8B5CF6"
            />
            <StatCard
              icon={<Server size={20} />}
              label="Nodes"
              value={totalNodes}
              color="#10B981"
            />
          </div>

          {/* Tab Navigation */}
          <div style={styles.tabsContainer}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'environments' ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab('environments')}
            >
              <Database size={16} />
              <span>Environments</span>
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'vcs' ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab('vcs')}
            >
              <GitBranch size={16} />
              <span>VCS Configuration</span>
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'monitoring' ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab('monitoring')}
            >
              <Activity size={16} />
              <span>Global Monitoring</span>
            </button>
          </div>

          {/* Tab Content */}
          <div style={styles.content}>
            {activeTab === 'environments' && (
              <EnvironmentsTab
                environments={environments}
                activeEnvIndex={activeEnvIndex}
                setActiveEnvIndex={setActiveEnvIndex}
                activeClusterIndexes={activeClusterIndexes}
                setActiveClusterIndexes={setActiveClusterIndexes}
                getEnvironmentColor={getEnvironmentColor}
              />
            )}
            {activeTab === 'vcs' && <VCSTab config={vcsConfig} />}
            {activeTab === 'monitoring' && <MonitoringTab config={globalMonitoring} />}
          </div>
        </>
      ) : (
        <div style={styles.emptyState}>
          <Server size={48} color={colors.gray400} />
          <h3 style={styles.emptyTitle}>No Solution Manager Data</h3>
          <p style={styles.emptyText}>
            Upload a Solution Manager JSON export to view environment configurations
          </p>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: `${color}15` }}>
        {React.cloneElement(icon as React.ReactElement, { color })}
      </div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

// Helper function for node type icons
function getNodeTypeIcon(type: string) {
  switch (type) {
    case 'VDP':
      return <Database size={16} color="#3B82F6" />;
    case 'SCHEDULER':
      return <Calendar size={16} color="#10B981" />;
    case 'DATA_CATALOG':
      return <HardDrive size={16} color="#8B5CF6" />;
    default:
      return <Server size={16} color="#6B7280" />;
  }
}

// Environments Tab Component with Modern Tabbed Interface
function EnvironmentsTab({
  environments,
  activeEnvIndex,
  setActiveEnvIndex,
  activeClusterIndexes,
  setActiveClusterIndexes,
  getEnvironmentColor
}: any) {
  if (environments.length === 0) {
    return (
      <div style={styles.emptyTab}>
        <Server size={40} color={colors.gray400} />
        <p style={styles.emptyTabText}>No environments found</p>
      </div>
    );
  }

  const currentEnv = environments[activeEnvIndex];

  // Safety check: if currentEnv is undefined, reset to first environment
  if (!currentEnv) {
    setActiveEnvIndex(0);
    return null;
  }

  const envColors = getEnvironmentColor(currentEnv.name, activeEnvIndex);
  const currentClusterIndex = activeClusterIndexes[activeEnvIndex] || 0;
  const currentCluster = currentEnv.clusters?.[currentClusterIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Environment Tabs */}
      <div style={styles.environmentTabsContainer}>
        {environments.map((env: any, index: number) => {
          const envColor = getEnvironmentColor(env.name, index);
          const isActive = index === activeEnvIndex;

          return (
            <button
              key={env.env_id || index}
              onClick={() => setActiveEnvIndex(index)}
              style={{
                ...styles.environmentTab,
                backgroundColor: isActive ? envColor.active : envColor.bg,
                borderBottom: isActive ? `3px solid ${envColor.border}` : 'none',
                color: envColor.text
              }}
            >
              <Database size={16} />
              <span>{env.name}</span>
              {env.clusters && (
                <span style={styles.envBadge}>{env.clusters.length} clusters</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Environment Info Card */}
      <div style={{ ...styles.envInfoCard, borderLeft: `4px solid ${envColors.border}` }}>
        <div style={styles.envInfoHeader}>
          <div>
            <h3 style={styles.envInfoTitle}>{currentEnv.name}</h3>
            {currentEnv.description && (
              <p style={styles.envInfoDescription}>{currentEnv.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {currentEnv.licenseAlias && (
              <span style={{ ...styles.infoBadge, backgroundColor: envColors.border, color: envColors.text }}>
                {currentEnv.licenseAlias}
              </span>
            )}
            {currentEnv.environmentType && (
              <span style={styles.infoBadge}>{currentEnv.environmentType}</span>
            )}
          </div>
        </div>
      </div>

      {/* Cluster Tabs */}
      {currentEnv.clusters && currentEnv.clusters.length > 0 && (
        <>
          <div style={styles.clusterTabsContainer}>
            {currentEnv.clusters.map((cluster: any, index: number) => {
              const isActive = index === currentClusterIndex;

              return (
                <button
                  key={cluster.cluster_id || cluster.clusterId || index}
                  onClick={() => setActiveClusterIndexes({ ...activeClusterIndexes, [activeEnvIndex]: index })}
                  style={{
                    ...styles.clusterTab,
                    backgroundColor: isActive ? '#F3F4F6' : 'white',
                    borderBottom: isActive ? `2px solid ${colors.accent}` : '1px solid #E5E7EB'
                  }}
                >
                  <HardDrive size={14} />
                  <span>{cluster.name}</span>
                  {cluster.nodes && (
                    <span style={styles.clusterBadge}>{cluster.nodes.length} nodes</span>
                  )}
                  {cluster.enabled ? (
                    <CheckCircle2 size={14} color={colors.success} />
                  ) : (
                    <XCircle size={14} color={colors.gray400} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Nodes Table */}
          {currentCluster && currentCluster.nodes && currentCluster.nodes.length > 0 && (
            <div style={styles.tableCard}>
              <h4 style={styles.tableTitle}>Server Nodes ({currentCluster.nodes.length})</h4>
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.tableHeader}>Name</th>
                      <th style={styles.tableHeader}>Description</th>
                      <th style={styles.tableHeader}>Type</th>
                      <th style={styles.tableHeader}>Host URL</th>
                      <th style={styles.tableHeader}>Kerberos</th>
                      <th style={styles.tableHeader}>Pass Through</th>
                      <th style={styles.tableHeader}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCluster.nodes.map((node: any, idx: number) => (
                      <tr key={node.node_id || node.nodeId || idx} style={{
                        ...styles.tableRow,
                        backgroundColor: idx % 2 === 0 ? '#FAFBFC' : 'white'
                      }}>
                        <td style={styles.tableCell}>
                          <div style={styles.nodeName}>
                            {getNodeTypeIcon(node.typeNode || node.type_node)}
                            <span>{node.name}</span>
                          </div>
                        </td>
                        <td style={styles.tableCell}>{node.description || '-'}</td>
                        <td style={styles.tableCell}>
                          <span style={styles.nodeTypeBadge}>{node.typeNode || node.type_node}</span>
                        </td>
                        <td style={styles.tableCell}>
                          <code style={styles.codeText}>
                            {node.urlIp}:{node.urlPort}
                          </code>
                        </td>
                        <td style={styles.tableCell}>
                          {(node.useKerberos || node.use_kerberos) ? (
                            <CheckCircle2 size={16} color={colors.success} />
                          ) : (
                            <XCircle size={16} color={colors.gray400} />
                          )}
                        </td>
                        <td style={styles.tableCell}>
                          {(node.usePassThrough || node.use_pass_through) ? (
                            <CheckCircle2 size={16} color={colors.success} />
                          ) : (
                            <XCircle size={16} color={colors.gray400} />
                          )}
                        </td>
                        <td style={styles.tableCell}>
                          {node.enabled ? (
                            <span style={styles.statusEnabled}>Enabled</span>
                          ) : (
                            <span style={styles.statusDisabled}>Disabled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Deployment Configuration */}
      {currentEnv.deploymentConfig && (
        <div style={styles.configSection}>
          <h4 style={styles.sectionTitle}>Deployment Configuration</h4>
          <DeploymentConfigCard config={currentEnv.deploymentConfig} />
        </div>
      )}
    </div>
  );
}

// Deployment Config Card
function DeploymentConfigCard({ config }: any) {
  const configItems = [
    { label: 'Deployments Enabled', value: config.deploymentsEnabled || config.deployments_enabled, type: 'boolean' },
    { label: 'Deployment Type', value: config.deploymentType || config.deployment_type },
    { label: 'Cluster Strategy', value: config.clusterStrategy || config.cluster_strategy },
    { label: 'Server Strategy', value: config.serverStrategy || config.server_strategy },
    { label: 'Configured Clusters', value: config.configuredClusters || config.configured_clusters },
    { label: 'Rollback Enabled', value: config.rollbackEnabled || config.rollback_enabled, type: 'boolean' },
    { label: 'Backup Enabled', value: config.backupEnabled || config.backup_enabled, type: 'boolean' },
    { label: 'Shared Cache', value: config.sharedCache || config.shared_cache, type: 'boolean' },
    { label: 'Shared Metadata', value: config.sharedMetadata || config.shared_metadata, type: 'boolean' },
    { label: 'Data Catalog Sync', value: config.dataCatalogSynchronizeEnabled || config.data_catalog_synchronize_enabled, type: 'boolean' },
    { label: 'Fast Cloud Deployments', value: config.fastCloudDeployments || config.fast_cloud_deployments, type: 'boolean' },
    { label: 'Queue Deployments', value: config.queueDeploymentsEnabled || config.queue_deployments_enabled, type: 'boolean' },
  ];

  return (
    <div style={styles.configCard}>
      <div style={styles.configGrid}>
        {configItems.map((item, idx) => (
          <ConfigItem key={idx} label={item.label} value={item.value} isBoolean={item.type === 'boolean'} />
        ))}
      </div>
    </div>
  );
}

// Monitoring Config Card
function MonitoringConfigCard({ config }: any) {
  if (!config) return null;

  const activeMonitors = config.activeMonitors || config.active_monitors;
  const monitors = typeof activeMonitors === 'string'
    ? JSON.parse(activeMonitors)
    : (activeMonitors || []);

  const enabledJdbcStorage = config.enabledJdbcStorage || config.enabled_jdbc_storage;
  const enabledCloudStorage = config.enabledCloudStorage || config.enabled_cloud_storage;

  return (
    <div style={styles.configCard}>
      {monitors.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={styles.configLabel}>Active Monitors ({monitors.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {monitors.map((monitor: string, idx: number) => (
              <span key={idx} style={styles.monitorBadge}>{monitor}</span>
            ))}
          </div>
        </div>
      )}

      {enabledCloudStorage && (
        <div style={{ marginBottom: '12px' }}>
          <div style={styles.configLabel}>Cloud Storage</div>
          <div style={styles.enabledBadge}>
            <CheckCircle2 size={14} />
            <span>Enabled</span>
          </div>
        </div>
      )}

      {enabledJdbcStorage && (
        <div>
          <div style={styles.configLabel}>JDBC Storage</div>
          <div style={styles.configGrid}>
            <ConfigItem label="Provider" value={config.jdbcProvider || config.jdbc_provider} />
            <ConfigItem label="Database URI" value={config.jdbcDatabaseUri || config.jdbc_database_uri} fullWidth />
            <ConfigItem label="User" value={config.jdbcUser || config.jdbc_user} />
            <ConfigItem label="Auth Type" value={config.jdbcAuthType || config.jdbc_auth_type} />
          </div>
        </div>
      )}

      {!monitors.length && !enabledCloudStorage && !enabledJdbcStorage && (
        <div style={{ color: colors.gray500, fontSize: '13px', textAlign: 'center', padding: '20px' }}>
          No monitoring configuration found
        </div>
      )}
    </div>
  );
}

// VCS Tab Component
function VCSTab({ config }: { config: any }) {
  if (!config) {
    return (
      <div style={styles.emptyTab}>
        <GitBranch size={40} color={colors.gray400} />
        <p style={styles.emptyTabText}>No VCS configuration found</p>
      </div>
    );
  }

  return (
    <div style={styles.configCard}>
      <div style={styles.vcsHeader}>
        <GitBranch size={20} color={colors.accent} />
        <h3 style={styles.vcsTitle}>Version Control System</h3>
      </div>

      <div style={styles.configGrid}>
        <ConfigItem label="Type" value={config.type} />
        <ConfigItem label="Repository URL" value={config.url} fullWidth />
        <ConfigItem label="Branch" value={config.branch || 'Default'} />
        <ConfigItem label="User" value={config.user} />
        <ConfigItem label="Local Repository" value={config.localRepositoryHome || config.local_repository_home} fullWidth />
        <ConfigItem label="VQL Chunk Size (MB)" value={config.vqlChunkSizeInMb || config.vql_chunk_size_in_mb} />
        <ConfigItem label="Use Default Branch" value={config.useDefaultBranch || config.use_default_branch} isBoolean />
        <ConfigItem label="User Authentication" value={config.userAuthentication || config.user_authentication} isBoolean />
      </div>
    </div>
  );
}

// Monitoring Tab Component
function MonitoringTab({ config }: { config: any }) {
  if (!config) {
    return (
      <div style={styles.emptyTab}>
        <Activity size={40} color={colors.gray400} />
        <p style={styles.emptyTabText}>No global monitoring configuration found</p>
      </div>
    );
  }

  const activeMonitors = config.activeMonitors || config.active_monitors;
  const monitors = typeof activeMonitors === 'string'
    ? JSON.parse(activeMonitors)
    : (activeMonitors || []);

  const autostartGlobalMonitors = config.autostartGlobalMonitors !== undefined
    ? config.autostartGlobalMonitors
    : config.autostart_global_monitors;
  const autostartDisabled = autostartGlobalMonitors === false;

  const enabledJdbcStorage = config.enabledJdbcStorage || config.enabled_jdbc_storage;
  const enabledCloudStorage = config.enabledCloudStorage || config.enabled_cloud_storage;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Autostart Warning */}
      {autostartDisabled && (
        <div style={styles.warningCard}>
          <AlertTriangle size={20} color="#F59E0B" />
          <div>
            <div style={styles.warningTitle}>Autostart Global Monitors is Disabled</div>
            <div style={styles.warningText}>
              Global monitors will not start automatically. Manual intervention required.
            </div>
          </div>
        </div>
      )}

      {/* Active Monitors */}
      <div style={styles.configCard}>
        <h3 style={styles.configLabel}>Active Monitors ({monitors.length})</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
          {monitors.map((monitor: string, idx: number) => (
            <span key={idx} style={styles.monitorBadge}>{monitor}</span>
          ))}
        </div>
      </div>

      {/* Cloud Storage */}
      {enabledCloudStorage && (
        <div style={styles.configCard}>
          <h3 style={styles.configLabel}>Cloud Storage</h3>
          <div style={styles.enabledBadge}>
            <CheckCircle2 size={14} />
            <span>Enabled</span>
          </div>
        </div>
      )}

      {/* JDBC Storage */}
      {enabledJdbcStorage && (
        <div style={styles.configCard}>
          <h3 style={styles.configLabel}>JDBC Storage Configuration</h3>
          <div style={styles.configGrid}>
            <ConfigItem label="Provider" value={config.jdbcProvider || config.jdbc_provider} />
            <ConfigItem label="Database URI" value={config.jdbcDatabaseUri || config.jdbc_database_uri} fullWidth />
            <ConfigItem label="Driver Class" value={config.jdbcDriverClass || config.jdbc_driver_class} />
            <ConfigItem label="Auth Type" value={config.jdbcAuthType || config.jdbc_auth_type} />
            <ConfigItem label="User" value={config.jdbcUser || config.jdbc_user} />
          </div>
        </div>
      )}

      {/* Autostart Status (when enabled) */}
      {!autostartDisabled && (
        <div style={styles.configCard}>
          <h3 style={styles.configLabel}>Autostart Configuration</h3>
          <div style={styles.enabledBadge}>
            <CheckCircle2 size={14} />
            <span>Autostart Enabled</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Config Item Component
function ConfigItem({ label, value, isBoolean = false, fullWidth = false }: any) {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div style={{ ...styles.configItem, ...(fullWidth ? { gridColumn: '1 / -1' } : {}) }}>
      <div style={styles.configLabel}>{label}</div>
      <div style={styles.configValue}>
        {isBoolean ? (
          value ? (
            <div style={styles.enabledBadge}>
              <CheckCircle2 size={14} />
              <span>Enabled</span>
            </div>
          ) : (
            <div style={styles.disabledBadge}>
              <XCircle size={14} />
              <span>Disabled</span>
            </div>
          )
        ) : (
          value
        )}
      </div>
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#fafbfc',
    padding: '20px 16px'
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: colors.gray600,
    background: 'none',
    border: 'none',
    fontSize: '13px',
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    marginBottom: '16px',
    transition: 'color 0.2s ease'
  },
  header: {
    background: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.sm,
    border: `1px solid ${colors.gray200}`,
    padding: '16px 20px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerIcon: {
    width: '42px',
    height: '42px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    borderRadius: borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.sm
  },
  title: {
    fontSize: '20px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray900,
    margin: '0 0 2px 0',
    letterSpacing: '-0.01em'
  },
  subtitle: {
    fontSize: '13px',
    color: colors.gray500,
    margin: 0
  },
  uploadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: `${spacing.sm} ${spacing.lg}`,
    background: colors.accent,
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.md,
    fontSize: '13px',
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    transition: 'background 0.2s ease'
  },
  successMessage: {
    background: '#d1fae5',
    border: `1px solid #6ee7b7`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    color: '#065f46',
    fontSize: '13px'
  },
  errorMessage: {
    background: '#fee2e2',
    border: `1px solid #fca5a5`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    color: '#991b1b',
    fontSize: '13px'
  },
  closeButton: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 4px'
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '16px'
  },
  statCard: {
    background: colors.white,
    border: `1px solid ${colors.gray200}`,
    borderRadius: borderRadius.md,
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: shadows.sm
  },
  statIcon: {
    width: '40px',
    height: '40px',
    borderRadius: borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray900,
    lineHeight: 1
  },
  statLabel: {
    fontSize: '12px',
    color: colors.gray600,
    marginTop: '2px'
  },
  tabsContainer: {
    background: colors.white,
    border: `1px solid ${colors.gray200}`,
    borderRadius: borderRadius.md,
    padding: '4px',
    display: 'flex',
    gap: '4px',
    marginBottom: '16px'
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: `${spacing.sm} ${spacing.md}`,
    background: 'transparent',
    border: 'none',
    borderRadius: borderRadius.sm,
    fontSize: '13px',
    fontWeight: typography.fontWeight.medium,
    color: colors.gray600,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  tabActive: {
    background: colors.accent,
    color: colors.white,
    boxShadow: shadows.sm
  },
  content: {
    minHeight: '400px'
  },
  envCard: {
    background: colors.white,
    borderRadius: borderRadius.md,
    boxShadow: shadows.sm,
    border: `1px solid ${colors.gray200}`,
    overflow: 'hidden'
  },
  envHeader: {
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'background 0.2s ease'
  },
  envName: {
    fontSize: '15px',
    fontWeight: typography.fontWeight.semibold,
    marginBottom: '2px'
  },
  envDescription: {
    fontSize: '12px',
    color: colors.gray600
  },
  badge: {
    padding: '4px 10px',
    background: colors.gray200,
    color: colors.gray700,
    borderRadius: borderRadius.full,
    fontSize: '11px',
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase'
  },
  envContent: {
    padding: '16px',
    borderTop: `1px solid ${colors.gray200}`,
    background: colors.gray50
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray700,
    marginBottom: '10px',
    marginTop: 0
  },
  clusterCard: {
    background: colors.white,
    border: `1px solid ${colors.gray200}`,
    borderRadius: borderRadius.sm,
    marginBottom: '8px',
    overflow: 'hidden'
  },
  clusterHeader: {
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    background: colors.gray50
  },
  clusterName: {
    fontSize: '13px',
    fontWeight: typography.fontWeight.medium,
    color: colors.gray900
  },
  nodesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '10px',
    padding: '12px'
  },
  nodeCard: {
    background: colors.gray50,
    border: `1px solid ${colors.gray200}`,
    borderRadius: borderRadius.sm,
    padding: '10px'
  },
  nodeName: {
    fontSize: '13px',
    fontWeight: typography.fontWeight.medium,
    color: colors.gray900
  },
  nodeUrl: {
    fontSize: '11px',
    color: colors.gray600,
    fontFamily: 'monospace',
    background: colors.white,
    padding: '4px 6px',
    borderRadius: borderRadius.sm,
    marginTop: '6px'
  },
  nodeDetail: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: colors.gray600,
    marginTop: '4px'
  },
  configCard: {
    background: colors.white,
    border: `1px solid ${colors.gray200}`,
    borderRadius: borderRadius.md,
    padding: '16px',
    boxShadow: shadows.sm
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '12px'
  },
  configItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  configLabel: {
    fontSize: '12px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray700
  },
  configValue: {
    fontSize: '13px',
    color: colors.gray900
  },
  enabledBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: '#d1fae5',
    color: '#065f46',
    borderRadius: borderRadius.sm,
    fontSize: '12px',
    fontWeight: typography.fontWeight.medium
  },
  disabledBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: colors.gray200,
    color: colors.gray600,
    borderRadius: borderRadius.sm,
    fontSize: '12px',
    fontWeight: typography.fontWeight.medium
  },
  monitorBadge: {
    padding: '4px 8px',
    background: '#DBEAFE',
    color: '#1E40AF',
    borderRadius: borderRadius.sm,
    fontSize: '11px',
    fontWeight: typography.fontWeight.medium
  },
  vcsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px'
  },
  vcsTitle: {
    fontSize: '16px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray900,
    margin: 0
  },
  warningCard: {
    background: '#FEF3C7',
    border: `1px solid #FCD34D`,
    borderRadius: borderRadius.md,
    padding: '14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  },
  warningTitle: {
    fontSize: '14px',
    fontWeight: typography.fontWeight.semibold,
    color: '#92400E',
    marginBottom: '4px'
  },
  warningText: {
    fontSize: '13px',
    color: '#92400E'
  },
  emptyState: {
    background: colors.white,
    border: `1px solid ${colors.gray200}`,
    borderRadius: borderRadius.md,
    padding: '60px 20px',
    textAlign: 'center',
    boxShadow: shadows.sm
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray900,
    marginTop: '16px',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '13px',
    color: colors.gray600,
    margin: 0
  },
  emptyTab: {
    background: colors.white,
    border: `1px solid ${colors.gray200}`,
    borderRadius: borderRadius.md,
    padding: '40px 20px',
    textAlign: 'center'
  },
  emptyTabText: {
    fontSize: '13px',
    color: colors.gray600,
    marginTop: '12px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: `3px solid ${colors.gray200}`,
    borderTopColor: colors.accent,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '13px',
    color: colors.gray600,
    fontWeight: typography.fontWeight.medium
  },
  // New Tabbed Interface Styles
  environmentTabsContainer: {
    display: 'flex',
    gap: '4px',
    borderBottom: `1px solid ${colors.gray200}`,
    overflow: 'auto',
    backgroundColor: colors.white,
    borderRadius: `${borderRadius.lg} ${borderRadius.lg} 0 0`,
    padding: '4px',
  },
  environmentTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    border: 'none',
    borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`,
    fontSize: '13px',
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  envBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: borderRadius.full,
  },
  envInfoCard: {
    background: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.sm,
    border: `1px solid ${colors.gray200}`,
    padding: spacing.lg,
  },
  envInfoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  envInfoTitle: {
    fontSize: '18px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray900,
    margin: '0 0 4px 0',
  },
  envInfoDescription: {
    fontSize: '13px',
    color: colors.gray600,
    margin: 0,
  },
  infoBadge: {
    padding: '4px 12px',
    borderRadius: borderRadius.full,
    fontSize: '12px',
    fontWeight: typography.fontWeight.medium,
    backgroundColor: colors.gray100,
    color: colors.gray700,
  },
  clusterTabsContainer: {
    display: 'flex',
    gap: '2px',
    borderBottom: `1px solid ${colors.gray200}`,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: '4px',
    overflow: 'auto',
  },
  clusterTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    border: 'none',
    borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`,
    fontSize: '12px',
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  clusterBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: borderRadius.full,
  },
  tableCard: {
    background: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.sm,
    border: `1px solid ${colors.gray200}`,
    overflow: 'hidden',
  },
  tableTitle: {
    fontSize: '15px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray900,
    padding: `${spacing.md} ${spacing.lg}`,
    margin: 0,
    borderBottom: `1px solid ${colors.gray200}`,
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as 'collapse',
  },
  tableHeaderRow: {
    backgroundColor: colors.gray50,
  },
  tableHeader: {
    padding: '12px 16px',
    textAlign: 'left' as 'left',
    fontSize: '12px',
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray700,
    borderBottom: `1px solid ${colors.gray200}`,
    whiteSpace: 'nowrap' as 'nowrap',
  },
  tableRow: {
    transition: 'background-color 0.15s ease',
  },
  tableCell: {
    padding: '12px 16px',
    fontSize: '13px',
    color: colors.gray700,
    borderBottom: `1px solid ${colors.gray100}`,
  },
  nodeTypeBadge: {
    padding: '4px 10px',
    borderRadius: borderRadius.sm,
    fontSize: '11px',
    fontWeight: typography.fontWeight.medium,
    backgroundColor: colors.accent + '15',
    color: colors.accent,
  },
  codeText: {
    fontSize: '12px',
    fontFamily: 'monospace',
    backgroundColor: colors.gray100,
    padding: '4px 8px',
    borderRadius: borderRadius.sm,
    color: colors.gray700,
  },
  statusEnabled: {
    padding: '4px 10px',
    borderRadius: borderRadius.sm,
    fontSize: '11px',
    fontWeight: typography.fontWeight.medium,
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  statusDisabled: {
    padding: '4px 10px',
    borderRadius: borderRadius.sm,
    fontSize: '11px',
    fontWeight: typography.fontWeight.medium,
    backgroundColor: colors.gray100,
    color: colors.gray600,
  },
  configSection: {
    marginTop: spacing.md,
  },
};

