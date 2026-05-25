import { NextResponse } from 'next/server';
import { duckdb } from '@/lib/database/duckdb-client';

export async function GET() {
  try {

    // EXACT REACT LOGIC: Query databases with metrics using 'kind' field matching
    // React uses: kind='table' for base, kind='view' for derived, kind='interface' for interface views
    const databasesQuery = `
      SELECT
        d.name,
        d.type,
        d.isSystemDatabase,
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
      GROUP BY d.name, d.type, d.isSystemDatabase
      ORDER BY d.name
    `;

    const databases = await duckdb.query(databasesQuery);

    // EXACT REACT LOGIC: Calculate cache percentage from AnalysisService.js line 347-353
    const databasesWithMetrics = databases.map((db: any) => {
      const totalViews = db.totalViews || 0;
      const cachedViews = db.cachedViews || 0;

      // React logic: Show "<1" when there are cached views but percentage rounds to 0
      let cachePercentage: number | string = 0;
      if (totalViews > 0) {
        const exactPercentage = (cachedViews / totalViews) * 100;
        cachePercentage = cachedViews > 0 && exactPercentage < 0.5 ? '<1' : Math.round(exactPercentage);
      }

      return {
        name: db.name,
        isSystemDatabase: db.isSystemDatabase || db.type === 'system',
        metrics: {
          views: totalViews,
          dataSources: db.dataSources || 0,
          baseViews: db.baseViews || 0,
          derivedViews: db.derivedViews || 0,
          interfaceViews: db.interfaceViews || 0,
          cachedViews: cachedViews,
          associations: db.associations || 0,
          cachePercentage: cachePercentage
        }
      };
    });

    return NextResponse.json({
      success: true,
      databases: databasesWithMetrics,
      total: databasesWithMetrics.length
    });

  } catch (error: any) {
    console.error('Error fetching databases:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
