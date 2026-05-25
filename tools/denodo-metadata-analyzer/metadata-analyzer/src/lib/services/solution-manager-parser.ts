/**
 * Solution Manager JSON Parser Service
 * Parses Denodo Solution Manager export JSON and stores in DuckDB
 */

import { DuckDBClient } from '../database/duckdb-client';

export interface SolutionManagerData {
  environments: Environment[];
  vcsConfiguration?: VCSConfiguration;
  globalMonitoringConfiguration?: GlobalMonitoringConfiguration;
  version?: string;
}

export interface Environment {
  id: number;
  name: string;
  uuid?: string;
  description?: string;
  licenseAlias?: string;
  environmentType?: string;
  minimumUpdateMandatory?: boolean;
  clusters?: Cluster[];
  deploymentConfiguration?: DeploymentConfiguration;
  monitoringConfiguration?: MonitoringConfiguration;
}

export interface Cluster {
  id: number;
  name: string;
  uuid?: string;
  description?: string;
  order?: number;
  environmentId?: number;
  enabled?: boolean;
  environmentType?: string;
  nodes?: Node[];
}

export interface Node {
  id: number;
  name: string;
  uuid?: string;
  description?: string;
  typeNode?: string;
  urlIP?: string;
  urlPort?: number;
  clusterId?: number;
  useKerberos?: boolean;
  usePassThrough?: boolean;
  username?: string;
  enabled?: boolean;
  useDefaultLicenseAlias?: boolean;
}

export interface DeploymentConfiguration {
  deploymentsEnabled?: boolean;
  deploymentType?: string;
  sharedCache?: boolean;
  clusterStrategy?: string;
  serverStrategy?: string;
  configuredClusters?: number;
  rollbackEnabled?: boolean;
  backupEnabled?: boolean;
  dataCatalogSynchronizeEnabled?: boolean;
  sharedMetadata?: boolean;
  fastCloudDeployments?: boolean;
  queueDeploymentsEnabled?: boolean;
}

export interface MonitoringConfiguration {
  activeMonitors?: string[];
  enabledCloudStorage?: boolean;
  enabledJdbcStorage?: boolean;
  jdbcConfiguration?: {
    provider?: string;
    databaseURI?: string;
    driverClass?: string;
    authType?: string;
    userPasswordDto?: {
      user?: string;
    };
  };
}

export interface VCSConfiguration {
  type?: string;
  url?: string;
  useDefaultBranch?: boolean;
  branch?: string;
  userAuthentication?: boolean;
  user?: string;
  localRepositoryHome?: string;
  vqlChunkSizeInMB?: number;
}

export interface GlobalMonitoringConfiguration {
  activeMonitors?: string[];
  enabledCloudStorage?: boolean;
  enabledJdbcStorage?: boolean;
  jdbcConfiguration?: {
    provider?: string;
    databaseURI?: string;
    driverClass?: string;
    authType?: string;
    userPasswordDto?: {
      user?: string;
    };
  };
  autostartGlobalMonitors?: boolean;
}

export class SolutionManagerParser {
  private duckdb: DuckDBClient;

  constructor(duckdb: DuckDBClient) {
    this.duckdb = duckdb;
  }

  /**
   * Escape SQL string values
   */
  private escapeSql(value: string): string {
    if (value === null || value === undefined) return 'NULL';
    return `'${value.replace(/'/g, "''")}'`;
  }

  /**
   * Parse Solution Manager JSON and store in DuckDB
   */
  async parseSolutionManagerJSON(jsonData: any): Promise<{ success: boolean; message: string }> {
    try {
      // Validate JSON structure
      if (!jsonData || !jsonData.environments || !Array.isArray(jsonData.environments)) {
        throw new Error('Invalid Solution Manager JSON format: missing environments array');
      }

      // Clear existing solution manager data
      await this.clearSolutionManagerData();

      // Parse and store environments
      for (const env of jsonData.environments) {
        await this.storeEnvironment(env);
      }

      // Store VCS configuration
      if (jsonData.vcsConfiguration) {
        await this.storeVCSConfiguration(jsonData.vcsConfiguration);
      }

      // Store global monitoring configuration
      if (jsonData.globalMonitoringConfiguration) {
        await this.storeGlobalMonitoring(jsonData.globalMonitoringConfiguration);
      }

      // Store version
      if (jsonData.version) {
        await this.storeVersion(jsonData.version);
      }

      // Save to parquet file to persist the data
      console.log('Saving solution manager data to parquet...');
      await this.duckdb.saveToParquet();
      console.log('✅ Solution manager data saved to parquet');

      return {
        success: true,
        message: `Successfully processed ${jsonData.environments.length} environment(s)`
      };
    } catch (error: any) {
      console.error('Error parsing Solution Manager JSON:', error);
      return {
        success: false,
        message: error.message || 'Failed to parse Solution Manager JSON'
      };
    }
  }

  /**
   * Clear all solution manager data from DuckDB
   */
  private async clearSolutionManagerData(): Promise<void> {
    await this.duckdb.execute('DELETE FROM sm_nodes');
    await this.duckdb.execute('DELETE FROM sm_deployment_config');
    await this.duckdb.execute('DELETE FROM sm_monitoring_config');
    await this.duckdb.execute('DELETE FROM sm_clusters');
    await this.duckdb.execute('DELETE FROM sm_environments');
    await this.duckdb.execute('DELETE FROM sm_vcs_config');
    await this.duckdb.execute('DELETE FROM sm_global_monitoring');
    await this.duckdb.execute('DELETE FROM sm_metadata');
  }

  /**
   * Store environment data
   */
  private async storeEnvironment(env: any): Promise<void> {
    // Insert environment - DuckDB WASM doesn't support parameterized queries, so we build the SQL
    const envId = env.id;
    const name = this.escapeSql(env.name || '');
    const uuid = env.uuid ? this.escapeSql(env.uuid) : 'NULL';
    const description = env.description ? this.escapeSql(env.description) : 'NULL';
    const licenseAlias = env.licenseAlias ? this.escapeSql(env.licenseAlias) : 'NULL';
    const environmentType = env.environmentType ? this.escapeSql(env.environmentType) : 'NULL';
    const minimumUpdateMandatory = env.minimumUpdateMandatory !== undefined ? env.minimumUpdateMandatory : false;

    await this.duckdb.execute(`
      INSERT INTO sm_environments (env_id, name, uuid, description, license_alias, environment_type, minimum_update_mandatory)
      VALUES (${envId}, ${name}, ${uuid}, ${description}, ${licenseAlias}, ${environmentType}, ${minimumUpdateMandatory})
    `);

    // Store clusters
    if (env.clusters && Array.isArray(env.clusters)) {
      for (const cluster of env.clusters) {
        await this.storeCluster(cluster, env.id);
      }
    }

    // Store deployment configuration
    if (env.deploymentConfiguration) {
      await this.storeDeploymentConfig(env.deploymentConfiguration, env.id);
    }

    // Store monitoring configuration
    if (env.monitoringConfiguration) {
      await this.storeMonitoringConfig(env.monitoringConfiguration, env.id);
    }
  }

  /**
   * Store cluster data
   */
  private async storeCluster(cluster: any, envId: number): Promise<void> {
    const clusterId = cluster.id;
    const name = this.escapeSql(cluster.name || '');
    const uuid = cluster.uuid ? this.escapeSql(cluster.uuid) : 'NULL';
    const description = cluster.description ? this.escapeSql(cluster.description) : 'NULL';
    const order = cluster.order || 0;
    const enabled = cluster.enabled !== false;
    const environmentType = cluster.environmentType ? this.escapeSql(cluster.environmentType) : 'NULL';

    await this.duckdb.execute(`
      INSERT INTO sm_clusters (cluster_id, env_id, name, uuid, description, cluster_order, enabled, environment_type)
      VALUES (${clusterId}, ${envId}, ${name}, ${uuid}, ${description}, ${order}, ${enabled}, ${environmentType})
    `);

    // Store nodes
    if (cluster.nodes && Array.isArray(cluster.nodes)) {
      for (const node of cluster.nodes) {
        await this.storeNode(node, cluster.id);
      }
    }
  }

  /**
   * Store node data
   */
  private async storeNode(node: any, clusterId: number): Promise<void> {
    const nodeId = node.id;
    const name = this.escapeSql(node.name || '');
    const uuid = node.uuid ? this.escapeSql(node.uuid) : 'NULL';
    const description = node.description ? this.escapeSql(node.description) : 'NULL';
    const typeNode = node.typeNode ? this.escapeSql(node.typeNode) : 'NULL';
    const urlIP = node.urlIP ? this.escapeSql(node.urlIP) : 'NULL';
    const urlPort = node.urlPort || 0;
    const useKerberos = node.useKerberos || false;
    const usePassThrough = node.usePassThrough || false;
    const username = node.username ? this.escapeSql(node.username) : 'NULL';
    const enabled = node.enabled !== false;
    const useDefaultLicenseAlias = node.useDefaultLicenseAlias || false;

    await this.duckdb.execute(`
      INSERT INTO sm_nodes (node_id, cluster_id, name, uuid, description, type_node, url_ip, url_port, use_kerberos, use_pass_through, username, enabled, use_default_license_alias)
      VALUES (${nodeId}, ${clusterId}, ${name}, ${uuid}, ${description}, ${typeNode}, ${urlIP}, ${urlPort}, ${useKerberos}, ${usePassThrough}, ${username}, ${enabled}, ${useDefaultLicenseAlias})
    `);
  }

  /**
   * Store deployment configuration
   */
  private async storeDeploymentConfig(config: any, envId: number): Promise<void> {
    const deploymentsEnabled = config.deploymentsEnabled || false;
    const deploymentType = config.deploymentType ? this.escapeSql(config.deploymentType) : 'NULL';
    const sharedCache = config.sharedCache || false;
    const clusterStrategy = config.clusterStrategy ? this.escapeSql(config.clusterStrategy) : 'NULL';
    const serverStrategy = config.serverStrategy ? this.escapeSql(config.serverStrategy) : 'NULL';
    const configuredClusters = config.configuredClusters || 0;
    const rollbackEnabled = config.rollbackEnabled || false;
    const backupEnabled = config.backupEnabled || false;
    const dataCatalogSynchronizeEnabled = config.dataCatalogSynchronizeEnabled || false;
    const sharedMetadata = config.sharedMetadata || false;
    const fastCloudDeployments = config.fastCloudDeployments || false;
    const queueDeploymentsEnabled = config.queueDeploymentsEnabled || false;

    await this.duckdb.execute(`
      INSERT INTO sm_deployment_config (
        env_id, deployments_enabled, deployment_type, shared_cache, cluster_strategy,
        server_strategy, configured_clusters, rollback_enabled, backup_enabled,
        data_catalog_synchronize_enabled, shared_metadata, fast_cloud_deployments, queue_deployments_enabled
      )
      VALUES (${envId}, ${deploymentsEnabled}, ${deploymentType}, ${sharedCache}, ${clusterStrategy}, ${serverStrategy}, ${configuredClusters}, ${rollbackEnabled}, ${backupEnabled}, ${dataCatalogSynchronizeEnabled}, ${sharedMetadata}, ${fastCloudDeployments}, ${queueDeploymentsEnabled})
    `);
  }

  /**
   * Store monitoring configuration
   */
  private async storeMonitoringConfig(config: any, envId: number): Promise<void> {
    const activeMonitors = this.escapeSql(JSON.stringify(config.activeMonitors || []));
    const enabledCloudStorage = config.enabledCloudStorage || false;
    const enabledJdbcStorage = config.enabledJdbcStorage || false;
    const jdbcProvider = config.jdbcConfiguration?.provider ? this.escapeSql(config.jdbcConfiguration.provider) : 'NULL';
    const jdbcDatabaseUri = config.jdbcConfiguration?.databaseURI ? this.escapeSql(config.jdbcConfiguration.databaseURI) : 'NULL';
    const jdbcDriverClass = config.jdbcConfiguration?.driverClass ? this.escapeSql(config.jdbcConfiguration.driverClass) : 'NULL';
    const jdbcAuthType = config.jdbcConfiguration?.authType ? this.escapeSql(config.jdbcConfiguration.authType) : 'NULL';
    const jdbcUser = config.jdbcConfiguration?.userPasswordDto?.user ? this.escapeSql(config.jdbcConfiguration.userPasswordDto.user) : 'NULL';

    await this.duckdb.execute(`
      INSERT INTO sm_monitoring_config (
        env_id, active_monitors, enabled_cloud_storage, enabled_jdbc_storage,
        jdbc_provider, jdbc_database_uri, jdbc_driver_class, jdbc_auth_type, jdbc_user
      )
      VALUES (${envId}, ${activeMonitors}, ${enabledCloudStorage}, ${enabledJdbcStorage}, ${jdbcProvider}, ${jdbcDatabaseUri}, ${jdbcDriverClass}, ${jdbcAuthType}, ${jdbcUser})
    `);
  }

  /**
   * Store VCS configuration
   */
  private async storeVCSConfiguration(config: any): Promise<void> {
    const type = config.type ? this.escapeSql(config.type) : 'NULL';
    const url = config.url ? this.escapeSql(config.url) : 'NULL';
    const useDefaultBranch = config.useDefaultBranch || false;
    const branch = config.branch ? this.escapeSql(config.branch) : 'NULL';
    const userAuthentication = config.userAuthentication || false;
    const user = config.user ? this.escapeSql(config.user) : 'NULL';
    const localRepositoryHome = config.localRepositoryHome ? this.escapeSql(config.localRepositoryHome) : 'NULL';
    const vqlChunkSizeInMB = config.vqlChunkSizeInMB || 0;

    await this.duckdb.execute(`
      INSERT INTO sm_vcs_config (type, url, use_default_branch, branch, user_authentication, user, local_repository_home, vql_chunk_size_in_mb)
      VALUES (${type}, ${url}, ${useDefaultBranch}, ${branch}, ${userAuthentication}, ${user}, ${localRepositoryHome}, ${vqlChunkSizeInMB})
    `);
  }

  /**
   * Store global monitoring configuration
   */
  private async storeGlobalMonitoring(config: any): Promise<void> {
    const activeMonitors = this.escapeSql(JSON.stringify(config.activeMonitors || []));
    const enabledCloudStorage = config.enabledCloudStorage || false;
    const enabledJdbcStorage = config.enabledJdbcStorage || false;
    const jdbcProvider = config.jdbcConfiguration?.provider ? this.escapeSql(config.jdbcConfiguration.provider) : 'NULL';
    const jdbcDatabaseUri = config.jdbcConfiguration?.databaseURI ? this.escapeSql(config.jdbcConfiguration.databaseURI) : 'NULL';
    const jdbcDriverClass = config.jdbcConfiguration?.driverClass ? this.escapeSql(config.jdbcConfiguration.driverClass) : 'NULL';
    const jdbcAuthType = config.jdbcConfiguration?.authType ? this.escapeSql(config.jdbcConfiguration.authType) : 'NULL';
    const jdbcUser = config.jdbcConfiguration?.userPasswordDto?.user ? this.escapeSql(config.jdbcConfiguration.userPasswordDto.user) : 'NULL';
    const autostartGlobalMonitors = config.autostartGlobalMonitors !== false;

    await this.duckdb.execute(`
      INSERT INTO sm_global_monitoring (
        active_monitors, enabled_cloud_storage, enabled_jdbc_storage,
        jdbc_provider, jdbc_database_uri, jdbc_driver_class, jdbc_auth_type, jdbc_user, autostart_global_monitors
      )
      VALUES (${activeMonitors}, ${enabledCloudStorage}, ${enabledJdbcStorage}, ${jdbcProvider}, ${jdbcDatabaseUri}, ${jdbcDriverClass}, ${jdbcAuthType}, ${jdbcUser}, ${autostartGlobalMonitors})
    `);
  }

  /**
   * Store version metadata
   */
  private async storeVersion(version: string): Promise<void> {
    const versionEscaped = this.escapeSql(version);
    await this.duckdb.execute(`
      INSERT INTO sm_metadata (id, version)
      VALUES (1, ${versionEscaped})
    `);
  }
}
