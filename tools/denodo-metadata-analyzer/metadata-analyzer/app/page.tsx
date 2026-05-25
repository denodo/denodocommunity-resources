'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Database, Shield, AlertTriangle } from 'lucide-react';
import { DuckDBClient } from '../src/lib/database/duckdb-client';
import { ParserRegistry } from '../src/lib/parsers/parser-registry';
import { colors, spacing, borderRadius, shadows, typography } from '../src/lib/theme';
import { DuplicateDetectionService } from '../src/lib/services/duplicate-detection-service';
import { useComplexity } from '@/contexts/ComplexityContext';

// Import modern UI components
import FileUploader from '../src/components/ui/FileUploader';
// Import modern analysis progress (from analysis subdirectory to avoid conflict)
import AnalysisProgress from '../src/components/analysis/AnalysisProgress';

// Force dynamic rendering - prevent static generation at build time
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function HomePage() {
  // Complexity context to track analysis timestamp
  const { updateAnalysisTimestamp, clearComplexityResults } = useComplexity();

  // State management
  const [currentView, setCurrentView] = useState('upload');
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<any>(null);
  const [duckdbClient, setDuckdbClient] = useState<DuckDBClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize DuckDB client
  useEffect(() => {
    const initDuckDB = async () => {
      try {
        const client = new DuckDBClient();
        await client.initialize();
        setDuckdbClient(client);
        console.log('[HomePage] DuckDB WASM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize DuckDB:', error);
        setError('Failed to initialize database. Please refresh the page.');
      }
    };

    initDuckDB();
  }, []);

  // Handle file upload and analysis
  const handleFileUpload = useCallback(async (files: { vql?: File; properties?: File }) => {
    if (!files.vql || !duckdbClient) {
      setError('Please select a VQL file and ensure database is initialized.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress({ stage: 'Clearing previous data...', progress: 0 });
    // Ensure initial 0% renders before any heavy work
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    try {
      // CRITICAL: Clear saved data BEFORE parsing (like React does)
      // This ensures fresh analysis for each upload
      await duckdbClient.clearSavedData();
      console.log('[HomePage] Cleared previous analysis data');

      // Clear old complexity results from previous analysis
      clearComplexityResults();
      console.log('[HomePage] Cleared previous complexity results');

      // Nudge UI after clearing to reflect continued progress
      await new Promise((r) => setTimeout(r, 0));

      setAnalysisProgress({ stage: 'Reading file...', progress: 5 });
      // Yield to the browser to render 5%
      await new Promise((r) => setTimeout(r, 0));

      // Read VQL file content in chunks to avoid memory overflow (support 169MB-500MB+ files)
      const analysisId = `analysis_${Date.now()}`;
      let content = '';

      // For large files (>10MB), read in 2MB chunks to prevent browser crash
      if (files.vql.size > 10 * 1024 * 1024) {
        const chunkSize = 2 * 1024 * 1024; // 2MB chunks
        const totalChunks = Math.ceil(files.vql.size / chunkSize);

        console.log(`[HomePage] Large file detected: ${(files.vql.size / 1024 / 1024).toFixed(2)}MB, reading in ${totalChunks} chunks`);

        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, files.vql.size);
          const chunk = files.vql.slice(start, end);
          const chunkText = await chunk.text();
          content += chunkText;

          // Update progress for reading (5% to 10% total)
          const readProgress = 5 + Math.floor((i / totalChunks) * 5);
          setAnalysisProgress({
            stage: `Reading file... ${(end / 1024 / 1024).toFixed(1)}MB / ${(files.vql.size / 1024 / 1024).toFixed(1)}MB`,
            progress: readProgress
          });

          // Yield to browser every 5 chunks to prevent freeze
          if (i % 5 === 0) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }

        console.log(`[HomePage] File read complete: ${content.length} characters`);
      } else {
        // Small files can be read directly
        content = await files.vql.text();
      }

      setAnalysisProgress({ stage: 'Starting parser (background)...', progress: 10 });
      // Yield to the browser to render 10%
      await new Promise((r) => setTimeout(r, 0));

      // (Cleanup) Removed phased main-thread parsing helper; rely on worker or simple fallback

      // Use Web Worker (module) for parsing to keep UI responsive
      // Important: type: 'module' ensures ESM imports in the worker work in Next.js
      const worker = new Worker(
        new URL('../src/workers/vql-parser.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // (Cleanup) Removed interim progress ticker

      // CRITICAL: Set up message handler BEFORE posting message to avoid race condition
      worker.onmessage = (e) => {
        const message = e.data;

        if (message.type === 'progress') {
          // Force immediate state update with unique reference to trigger re-render
          const progressUpdate = {
            stage: message.stage,
            progress: message.progress,
            _timestamp: Date.now() // Force new object reference
          };
          setAnalysisProgress(progressUpdate);
          // Progress updated
        } else if (message.type === 'result') {
          // Result received; proceed to store and finalize
          // Handle result asynchronously
          (async () => {
          if (message.success) {
            // Debug: Log interface view implementation info
            if (message.results._debug) {
              console.log('🔍 [Worker Debug]', message.results._debug);
            }

            setAnalysisProgress({ stage: 'Storing data in DuckDB...', progress: 82 });

            // Insert parsed data to DuckDB (parallel bulk inserts)
            const insertStart = performance.now();
            const dataByTable = message.results;

            // Filter out debug info before inserting
            const { _debug, ...dataToInsert } = dataByTable;

            console.log('[HomePage] Tables to insert:', Object.keys(dataToInsert));
            console.log('[HomePage] server_configuration data:', dataToInsert.server_configuration);

            await Promise.all(
              Object.entries(dataToInsert).map(([tableName, items]) => {
                const itemsArray = items as any[];
                console.log(`[HomePage] Inserting ${itemsArray.length} rows into ${tableName}`);
                return duckdbClient.batchInsert(tableName, itemsArray);
              })
            );

            const insertTime = performance.now() - insertStart;
            console.log(`✅ All data inserted in ${insertTime.toFixed(2)}ms`);

            setAnalysisProgress({ stage: 'Building database statistics...', progress: 87 });
            // Small delay to allow UI to update
            await new Promise(resolve => setTimeout(resolve, 50));

            // Rebuild materialized stats for instant VDB Breakdown page loading
            await duckdbClient.rebuildDatabaseStats();

            setAnalysisProgress({ stage: 'Analyzing duplicate connections...', progress: 91 });
            await new Promise(resolve => setTimeout(resolve, 50));

            // Compute and persist duplicate connections (JDBC) using properties if provided
            try {

              // Load datasources from DuckDB
              const allDataSources = await duckdbClient.query('SELECT * FROM datasources');

              // Parse properties file if provided
              let properties: Record<string, any> = {};
              if (files.properties) {
                const content = await files.properties.text();
                properties = parseProperties(content);

                // Save properties to localStorage for server config page to resolve references
                try {
                  localStorage.setItem('uploaded_properties', JSON.stringify(properties));
                  console.log('[HomePage] Saved properties to localStorage for server config resolution');
                } catch (error) {
                  console.warn('[HomePage] Failed to save properties to localStorage:', error);
                }
              }

              const dupSvc = new DuplicateDetectionService();

              // Create synthetic props from direct values (URL) to match React logic
              const adaptedForSynthetic = (allDataSources || []).map((ds: any) => ({
                name: ds.name,
                database: ds.database,
                type: ds.type,
                username: ds.username,
                databaseUri: ds.url,
                routeConnection: ds.routeConnection || ds.url,
                routeType: ds.routeType
              }));
              const synthetic = dupSvc.convertDataSourcesToProperties(adaptedForSynthetic);
              const mergedProperties = { ...synthetic, ...properties };

              // Analyze duplicates from properties
              const result = dupSvc.analyzeDuplicateConnections(mergedProperties);
              const jdbc = (result.duplicates || []).filter((d: any) => d.type === 'jdbc');
              const json = (result.duplicates || []).filter((d: any) => d.type === 'json');

              // Clear previous duplicates and insert fresh
              await duckdbClient.execute('DELETE FROM duplicates');
              for (const dup of [...jdbc, ...json]) {
                const connStr = (dup as any).connectionString || dup.normalizedUri || dup.uri || '';
                await duckdbClient.query(
                  `INSERT INTO duplicates (type, connection_string, count, sources, similarity, analysis_id)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    dup.type,
                    connStr,
                    dup.count,
                    JSON.stringify(dup.connections || []),
                    null,
                    analysisId,
                  ]
                );
              }
            } catch (dupErr) {
              console.warn('[HomePage] Duplicate analysis skipped:', dupErr);
            }

            setAnalysisProgress({ stage: 'Saving to browser storage...', progress: 94 });
            await new Promise(resolve => setTimeout(resolve, 50));

            // Save all data to Parquet file in OPFS for persistence (includes duplicates)
            await duckdbClient.saveToParquet();

            setAnalysisProgress({ stage: 'Preparing dashboard...', progress: 97 });
            await new Promise(resolve => setTimeout(resolve, 50));

            // Query all tables to get analysis data
            const analysisResults = await getAnalysisResults(duckdbClient);

            setAnalysisProgress({ stage: 'Complete!', progress: 100 });
            await new Promise(resolve => setTimeout(resolve, 300)); // Show 100% briefly

            setAnalysisData(analysisResults);

            // Update analysis timestamp in ComplexityContext (from analysisId which contains timestamp)
            const timestamp = parseInt(analysisId.replace('analysis_', ''), 10);
            updateAnalysisTimestamp(timestamp);
            console.log('[HomePage] Updated analysis timestamp:', timestamp);

            // Redirect to dashboard page
            window.location.href = '/dashboard';
          } else {
            throw new Error(message.error || 'Parsing failed');
          }

          worker.terminate();
          setIsAnalyzing(false);
          setTimeout(() => setAnalysisProgress(null), 2000);
          })(); // Close async IIFE
        }
      };

      // (Cleanup) Removed worker.onmessageerror debug handler

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        setError('Parsing worker failed. Falling back to main thread...');
        worker.terminate();

        // Fallback to main thread parsing
        (async () => {
          try {
            // Show explicit fallback stage before heavy parsing blocks the UI
            setAnalysisProgress({ stage: 'Parsing VQL on main thread...', progress: 35, parser: 'main-thread' });
            await new Promise((r) => setTimeout(r, 0));
            const parserRegistry = new ParserRegistry(duckdbClient);
            await parserRegistry.parseContent(content, analysisId);
            const analysisResults = await getAnalysisResults(duckdbClient);
            setAnalysisData(analysisResults);

            // Redirect to dashboard page
            window.location.href = '/dashboard';
          } catch (fallbackError: any) {
            setError(`Analysis failed: ${fallbackError.message}`);
          } finally {
            setIsAnalyzing(false);
            setTimeout(() => setAnalysisProgress(null), 2000);
          }
        })();
      };

      // (Cleanup) Removed watchdog fallback; rely on worker or onerror fallback

      // NOW send the parsing request to worker (after handlers are set up)
      worker.postMessage({
        type: 'parse',
        content,
        analysisId
      });

    } catch (error: any) {
      console.error('Analysis failed:', error);
      setError(`Analysis failed: ${error.message}`);
      setIsAnalyzing(false);
      setTimeout(() => setAnalysisProgress(null), 2000);
    }
  }, [duckdbClient]);

  // Minimal .properties parser (same behavior as lib analysis-service)
  const parseProperties = (content: string): Record<string, any> => {
    const properties: Record<string, any> = {};
    const lines = content.split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        const cleanKey = key.trim();
        const cleanValue = value
          .trim()
          .replace(/\\:/g, ':')
          .replace(/\\\\/g, '\\')
          .replace(/\\=/g, '=');
        properties[cleanKey] = cleanValue;
      }
    });
    return properties;
  };

  // Get analysis results from DuckDB
  const getAnalysisResults = async (client: DuckDBClient) => {
    // Try databases table first, fallback to views table distinct databases
    let databases;
    try {
      databases = await client.query('SELECT DISTINCT name as database FROM databases WHERE name IS NOT NULL AND name != \'\'');
      console.log('[getAnalysisResults] databases from databases table:', databases);

      if (databases.length === 0) {
        // Fallback to getting databases from views table
        databases = await client.query('SELECT DISTINCT database FROM views WHERE database IS NOT NULL AND database != \'\'');
        console.log('[getAnalysisResults] databases from views table (fallback):', databases);
      }
    } catch (error) {
      console.log('[getAnalysisResults] databases table not found, using views table:', error);
      databases = await client.query('SELECT DISTINCT database FROM views WHERE database IS NOT NULL AND database != \'\'');
    }

    const views = await client.query('SELECT * FROM views');
    const datasourcesRaw = await client.query('SELECT * FROM datasources');
    const globalElements = await client.query('SELECT * FROM global_elements');
    const wrappers = await client.query('SELECT * FROM wrappers');

    // Deduplicate datasources (React approach)
    // Use database || 'null' to handle null/undefined database values properly
    const uniqueDataSources = new Map();
    const datasources = datasourcesRaw.filter((ds: any) => {
      const key = `${ds.database || 'null'}:${ds.type}:${ds.name}`;
      if (uniqueDataSources.has(key)) {
        return false;
      }
      uniqueDataSources.set(key, true);
      return true;
    });

    // Debug: Check what database values we have
    console.log('[DEBUG] Sample view:', views[0]);
    console.log('[DEBUG] Sample datasource:', datasources[0]);
    console.log('[DEBUG] Unique databases from views:', [...new Set(views.map((v: any) => v.database).filter(Boolean))]);
    console.log('[DEBUG] Unique databases from datasources:', [...new Set(datasources.map((d: any) => d.database).filter(Boolean))]);

    // Debug: Check datasource types distribution
    const typeCount: { [key: string]: number } = {};
    datasources.forEach((ds: any) => {
      typeCount[ds.type] = (typeCount[ds.type] || 0) + 1;
    });
    console.log('[DEBUG] Datasource types after deduplication:', typeCount);

    // Calculate statistics using correct React logic
    const totalViews = views.length;
    const totalBaseViews = views.filter((v: any) => v.kind === 'table').length; // Tables are base views
    const totalDerivedViews = views.filter((v: any) => v.kind === 'view').length; // Views are derived views
    const totalInterfaceViews = views.filter((v: any) => v.kind === 'interface view').length;

    // Calculate cached views from cache_data table (React logic)
    let totalCachedViews = 0;
    try {
      const cacheData = await client.query('SELECT * FROM cache_data');
      console.log(`[getAnalysisResults] Cached views from cache_data table: ${cacheData.length}`);
      totalCachedViews = cacheData.length;
    } catch (error) {
      console.log('[getAnalysisResults] cache_data table error:', error);
      console.log('[getAnalysisResults] cache_data table not available, defaulting to 0');
    }

    // Calculate associations
    const associations = await client.query('SELECT * FROM associations');
    console.log(`[getAnalysisResults] Associations: ${associations.length}`);
    const totalAssociations = associations.length;

    // Calculate stats enabled views from view_stats table
    let totalStatsEnabled = 0;
    try {
      const viewStats = await client.query('SELECT * FROM view_stats WHERE enabled = true');
      console.log(`[getAnalysisResults] Stats enabled views: ${viewStats.length}`);
      totalStatsEnabled = viewStats.length;
    } catch (error) {
      console.log('[getAnalysisResults] view_stats table error:', error);
      console.log('[getAnalysisResults] view_stats table not available, defaulting to 0');
    }

    // Build enriched databases array with metrics
    console.log('[getAnalysisResults] databases array:', databases);
    console.log('[getAnalysisResults] Sample view:', views[0]);
    console.log('[getAnalysisResults] View database values:', [...new Set(views.map((v: any) => v.database))]);

    const enrichedDatabases = databases.map((d: any) => {
      const dbName = d.database; // Query aliases 'name as database'
      const dbViews = views.filter((v: any) => v.database === dbName);
      const dbDatasources = datasources.filter((ds: any) => ds.database === dbName);

      if (dbName === 'common' || dbName === 'pim_rest') {
        console.log(`[DEBUG] Checking database ${dbName}:`, {
          totalViewsInDB: views.length,
          viewsWithThisDB: dbViews.length,
          sampleMatchingView: dbViews[0]
        });
      }

      const baseViews = dbViews.filter((v: any) => v.kind === 'table').length; // Tables are base views
      const derivedViews = dbViews.filter((v: any) => v.kind === 'view').length; // Views are derived views
      const interfaceViews = dbViews.filter((v: any) => v.kind === 'interface view').length;

      console.log(`[getAnalysisResults] Database ${dbName}: ${baseViews} base, ${derivedViews} derived, ${interfaceViews} interface`);

      return {
        name: dbName,
        dataSources: dbDatasources, // Required by DataSourceAnalyticsService
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

    console.log('[getAnalysisResults] enrichedDatabases:', enrichedDatabases);
    console.log('[getAnalysisResults] Sample database with dataSources:', enrichedDatabases[0]);
    console.log('[getAnalysisResults] Total datasources in first database:', enrichedDatabases[0]?.dataSources?.length);

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
        totalDatasources: datasources.length, // Keep both for compatibility
        totalWrappers: wrappers.length,
        totalGlobalElements: globalElements.length,
        totalCachedViews,
        totalAssociations,
        totalStatsEnabled
      }
    };
  };

  // Handle navigation
  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setSelectedDatabase(null);
    setSelectedView(null);
  };

  const handleDatabaseSelect = (database: string) => {
    setSelectedDatabase(database);
    setCurrentView('database-detail');
  };

  const handleNewAnalysis = async () => {
    setCurrentView('upload');
    setAnalysisData(null);
    setSelectedDatabase(null);
    setSelectedView(null);
    setError(null);

    // Clear saved OPFS data for fresh analysis (like React's clearAnalysisData)
    if (duckdbClient) {
      try {
        await duckdbClient.clearSavedData();
        console.log('[HomePage] Cleared OPFS data for new analysis');
      } catch (error) {
        console.log('[HomePage] Error clearing OPFS data:', error);
      }
    }

    // Clear view complexity results from localStorage
    try {
      localStorage.removeItem('view_complexity_results');
      localStorage.removeItem('view_complexity_csv');
      console.log('[HomePage] Cleared view complexity results from localStorage');
    } catch (error) {
      console.log('[HomePage] Error clearing localStorage:', error);
    }
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Render main content based on current view
  const renderMainContent = () => {
    if (currentView === 'upload') {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{ maxWidth: '1000px', width: '100%' }}>
            {/* Logo and branding */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Database size={40} style={{ color: colors.primarySolid }} />
                <h1 style={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  marginLeft: '12px',
                  color: colors.gray900,
                  margin: '0 0 0 12px'
                }}>
                  VQL Metadata Analyzer
                </h1>
              </div>
              <p style={{ fontSize: '1.125rem', color: colors.gray600, margin: '0 0 8px 0' }}>
                Advanced analytics for Denodo Virtual DataPort metadata
              </p>
              <div style={{ fontSize: '0.875rem', color: colors.gray500, margin: 0 }}>
                Powered by DuckDB WASM • Next.js 14 • Modern TypeScript
              </div>
            </div>

            {/* File uploader component */}
            <FileUploader
              onFileUpload={handleFileUpload}
              isAnalyzing={isAnalyzing}
              hasExistingAnalysis={!!analysisData}
              error={error}
            />

            {/* Analysis progress - Modern overlay modal */}
            {analysisProgress && (
              <AnalysisProgress
                stage={analysisProgress.stage}
                progress={analysisProgress.progress}
                parser={analysisProgress.parser}
              />
            )}
          </div>
        </div>
      );
    }

    if (currentView === 'dashboard' && analysisData) {
      // Navigate to Next.js route for Dashboard
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
      return null;
    }

    if (currentView === 'vdb-breakdown' && analysisData) {
      // Navigate to Next.js route for VDB Breakdown
      if (typeof window !== 'undefined') {
        window.location.href = '/databases';
      }
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '16px',
              color: colors.gray800
            }}>Loading VDB Breakdown...</h2>
          </div>
        </div>
      );
    }

    // TODO: Add other views like database-detail, global-stats, etc.
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '16px',
            color: colors.gray700
          }}>
            {currentView}
          </h2>
          <p style={{ color: colors.gray500, margin: 0 }}>
            This view is coming soon!
          </p>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      overflow: 'hidden',
      backgroundColor: colors.gray50
    }}>
      {/* Main content - no sidebar on upload page */}
      <main style={{
        flex: 1,
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {renderMainContent()}
      </main>
    </div>
  );
}
