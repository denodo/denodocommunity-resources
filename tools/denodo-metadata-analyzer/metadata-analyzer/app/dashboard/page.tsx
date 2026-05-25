'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from '../../src/components/ui/Dashboard';
import { DuckDBClient } from '../../src/lib/database/duckdb-client';

export default function DashboardPage() {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAnalysisResults = async (client: DuckDBClient) => {
    // Try databases table first, fallback to views table distinct databases
    let databases;
    try {
      databases = await client.query('SELECT DISTINCT name as database FROM databases WHERE name IS NOT NULL AND name != \'\'');

      if (databases.length === 0) {
        databases = await client.query('SELECT DISTINCT database FROM views WHERE database IS NOT NULL AND database != \'\'');
      }
    } catch (error) {
      databases = await client.query('SELECT DISTINCT database FROM views WHERE database IS NOT NULL AND database != \'\'');
    }

    const views = await client.query('SELECT * FROM views');
    const datasourcesRaw = await client.query('SELECT * FROM datasources');
    const globalElements = await client.query('SELECT * FROM global_elements');
    const wrappers = await client.query('SELECT * FROM wrappers');

    // Deduplicate datasources
    const uniqueDataSources = new Map();
    const datasources = datasourcesRaw.filter((ds: any) => {
      const key = `${ds.database || 'null'}:${ds.type}:${ds.name}`;
      if (uniqueDataSources.has(key)) {
        return false;
      }
      uniqueDataSources.set(key, true);
      return true;
    });

    // Calculate statistics
    const totalViews = views.length;
    const totalBaseViews = views.filter((v: any) => v.kind === 'table').length;
    const totalDerivedViews = views.filter((v: any) => v.kind === 'view').length;
    const totalInterfaceViews = views.filter((v: any) => v.kind === 'interface view').length;

    let totalCachedViews = 0;
    try {
      const cacheData = await client.query('SELECT * FROM cache_data');
      totalCachedViews = cacheData.length;
    } catch (error) {
      console.log('cache_data table not available');
    }

    const associations = await client.query('SELECT * FROM associations');
    const totalAssociations = associations.length;

    let totalStatsEnabled = 0;
    try {
      const viewStats = await client.query('SELECT * FROM view_stats WHERE enabled = true');
      totalStatsEnabled = viewStats.length;
    } catch (error) {
      console.log('view_stats table not available');
    }

    // Build enriched databases array with metrics
    const enrichedDatabases = databases.map((d: any) => {
      const dbName = d.database;
      const dbViews = views.filter((v: any) => v.database === dbName);
      const dbDatasources = datasources.filter((ds: any) => ds.database === dbName);

      const baseViews = dbViews.filter((v: any) => v.kind === 'table').length;
      const derivedViews = dbViews.filter((v: any) => v.kind === 'view').length;
      const interfaceViews = dbViews.filter((v: any) => v.kind === 'interface view').length;

      return {
        name: dbName,
        dataSources: dbDatasources,
        metrics: {
          viewsByType: {
            base: baseViews,
            derived: derivedViews,
            interface: interfaceViews
          },
          totalViews: baseViews + derivedViews + interfaceViews,
          totalDatasources: dbDatasources.length
        }
      };
    });

    return {
      databases: enrichedDatabases,
      views,
      datasources,
      globalElements,
      wrappers,
      stats: {
        totalViews,
        totalBaseViews,
        totalDerivedViews,
        totalInterfaceViews,
        totalDatabases: databases.length,
        totalDataSources: datasources.length,
        totalDatasources: datasources.length,
        totalWrappers: wrappers.length,
        totalGlobalElements: globalElements.length,
        totalCachedViews,
        totalAssociations,
        totalStatsEnabled
      }
    };
  };

  const loadAnalysisData = useCallback(async () => {
    try {
      const client = new DuckDBClient();
      await client.initialize();

      // Check if there's data loaded
      const hasData = await client.loadFromParquet();

      if (!hasData) {
        // No data available, redirect to upload
        window.location.href = '/';
        return;
      }

      // Query all tables to get analysis data
      const analysisResults = await getAnalysisResults(client);
      setAnalysisData(analysisResults);
    } catch (error: any) {
      console.error('Failed to load analysis data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalysisData();
  }, [loadAnalysisData]);

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
          <p style={{ fontSize: '14px', color: '#666' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !analysisData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#1a1a1a',
            marginBottom: '12px'
          }}>No Analysis Data</h2>
          <p style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '24px'
          }}>
            No analysis data is available. Please upload a VQL file to get started.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#3498db',
              color: 'white',
              borderRadius: '6px',
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

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <Dashboard
        analysisData={analysisData}
        onDatabaseSelect={(database: string) => {
          window.location.href = `/databases/${encodeURIComponent(database)}`;
        }}
        onViewChange={(view: string) => {
          if (view === 'vdb-breakdown') {
            window.location.href = '/databases';
          } else if (view === 'server-config') {
            window.location.href = '/server-config';
          } else if (view === 'data-sources') {
            window.location.href = '/data-sources';
          } else if (view === 'duplicates') {
            window.location.href = '/duplicates';
          } else if (view === 'view-complexity') {
            window.location.href = '/view-complexity';
          } else if (view === 'global-stats') {
            window.location.href = '/global-stats';
          } else if (view === 'web-services') {
            window.location.href = '/web-services';
          }
        }}
      />
    </div>
  );
}
