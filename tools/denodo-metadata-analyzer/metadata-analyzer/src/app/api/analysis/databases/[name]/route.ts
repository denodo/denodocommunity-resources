import { NextResponse } from 'next/server';
import { duckdb } from '@/lib/database/duckdb-client';

export async function GET(request: Request, { params }: { params: { name: string } }) {
  try {
    const databaseName = decodeURIComponent(params.name);

    // EXACT REACT LOGIC: Get database metrics using correct 'kind' mapping
    const metricsQuery = `
      SELECT
        COUNT(DISTINCT ds.id) as dataSources,
        COUNT(DISTINCT v.id) as totalViews,
        COUNT(DISTINCT CASE WHEN v.kind = 'table' THEN v.id END) as baseViews,
        COUNT(DISTINCT CASE WHEN v.kind = 'view' THEN v.id END) as derivedViews,
        COUNT(DISTINCT CASE WHEN v.kind = 'interface' THEN v.id END) as interfaceViews,
        COUNT(DISTINCT c.id) as cachedViews,
        COUNT(DISTINCT a.id) as associations
      FROM databases d
      LEFT JOIN datasources ds ON ds.database = d.name
      LEFT JOIN views v ON v.database = d.name
      LEFT JOIN cache_data c ON c.database = d.name
      LEFT JOIN associations a ON a.database = d.name
      WHERE d.name = ?
      GROUP BY d.name
    `;

    const metricsResult = await duckdb.query(metricsQuery, [databaseName]);
    const metrics = metricsResult[0] || {
      dataSources: 0,
      totalViews: 0,
      baseViews: 0,
      derivedViews: 0,
      interfaceViews: 0,
      cachedViews: 0,
      associations: 0
    };

    // Get data sources for this database
    const dataSources = await duckdb.query(
      'SELECT name, type, folder FROM datasources WHERE database = ? ORDER BY name',
      [databaseName]
    );

    // Get views for this database
    const views = await duckdb.query(
      'SELECT name, kind, folder FROM views WHERE database = ? ORDER BY name',
      [databaseName]
    );

    // Get cached views for this database
    const cachedViews = await duckdb.query(
      'SELECT name, cache_status, cache_type FROM cache_data WHERE database = ? ORDER BY name',
      [databaseName]
    );

    // Get associations for this database
    const associations = await duckdb.query(
      'SELECT name, kind, endpoints FROM associations WHERE database = ? ORDER BY name',
      [databaseName]
    );

    const databaseDetail = {
      name: databaseName,
      metrics: {
        dataSources: metrics.dataSources || 0,
        baseViews: metrics.baseViews || 0,
        derivedViews: metrics.derivedViews || 0,
        interfaceViews: metrics.interfaceViews || 0,
        cachedViews: metrics.cachedViews || 0,
        associations: metrics.associations || 0,
        totalViews: metrics.totalViews || 0
      },
      dataSources,
      views,
      cachedViews,
      associations
    };

    return NextResponse.json({
      success: true,
      database: databaseDetail
    });

  } catch (error: any) {
    console.error('Error fetching database details:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
