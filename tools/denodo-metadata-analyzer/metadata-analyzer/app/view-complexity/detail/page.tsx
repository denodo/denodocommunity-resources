"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Database, BarChart3, GitBranch, Code, Layers, AlertTriangle } from 'lucide-react';
import { duckdb } from '@/lib/database/duckdb-client';
import { useComplexity } from '@/contexts/ComplexityContext';

function ViewComplexityDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { complexityResults } = useComplexity();

  const viewName = searchParams.get('name');
  const database = searchParams.get('database');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewData, setViewData] = useState<any>(null);
  const [complexityData, setComplexityData] = useState<any>(null);

  useEffect(() => {
    const loadViewData = async () => {
      if (!viewName || !database) {
        setError('Missing view name or database');
        setLoading(false);
        return;
      }

      try {
        await duckdb.waitForInitialization();

        // Get view data from DuckDB
        const views = await duckdb.query(
          `SELECT name, database, kind, select_body as selectBody
           FROM views
           WHERE name = ? AND database = ?`,
          [viewName, database]
        );

        if (views.length === 0) {
          setError('View not found');
          setLoading(false);
          return;
        }

        setViewData(views[0]);

        // Try to find complexity data in context first (React pattern - avoid re-analysis)
        if (complexityResults && complexityResults.top_views) {
          const existingComplexity = complexityResults.top_views.find(
            (v: any) => v.name === viewName && v.database === database
          );

          if (existingComplexity) {
            console.log('[ViewDetail] Using complexity data from context (parent state)');
            setComplexityData(existingComplexity);
            setLoading(false);
            return;
          }
        }

        // Fallback: Re-analyze this single view if not found in context
        console.log('[ViewDetail] Complexity data not in context - re-analyzing view');
        if (views[0].selectBody) {
          const resp = await fetch('/analyze-complexity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              views: [{ name: viewName, database, kind: views[0].kind, selectBody: views[0].selectBody }],
              dialect: 'ansi',
              topCount: 1
            })
          });

          const result = await resp.json();
          if (result.success && result.top_views && result.top_views.length > 0) {
            setComplexityData(result.top_views[0]);
          }
        }

        setLoading(false);
      } catch (e: any) {
        console.error('Failed to load view details:', e);
        setError(e?.message || 'Failed to load view');
        setLoading(false);
      }
    };

    loadViewData();
  }, [viewName, database, complexityResults]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Loading view details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', marginBottom: 16 }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
        <button
          onClick={() => router.back()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
      </div>
    );
  }

  const tierColors: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    veryHigh: '#ef4444'
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer',
            marginBottom: 12
          }}
        >
          <ArrowLeft size={16} />
          Back to Analysis
        </button>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{viewName}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 14, marginTop: 4 }}>
                <Database size={14} />
                {database}
              </div>
            </div>
            {complexityData && (
              <div
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: tierColors[complexityData.tier] || '#6b7280',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                {complexityData.tier === 'veryHigh' ? 'Very High' : complexityData.tier?.charAt(0).toUpperCase() + complexityData.tier?.slice(1)}
              </div>
            )}
          </div>

          {complexityData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: tierColors[complexityData.tier] }}>
                  {complexityData.score}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Complexity Score</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats - Top 4 most important metrics */}
      {complexityData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <MetricCard icon={<Database size={20} />} label="Tables Used" value={complexityData.tables || 0} color="#3b82f6" />
          <MetricCard icon={<GitBranch size={20} />} label="Total Joins" value={complexityData.joinsTotal || 0} color="#8b5cf6" />
          <MetricCard icon={<Code size={20} />} label="Functions Called" value={complexityData.fnCalls || 0} color="#10b981" />
          <MetricCard icon={<Layers size={20} />} label="CTEs (WITH)" value={complexityData.ctes || 0} color="#f59e0b" />
        </div>
      )}

      {/* Detailed Breakdown Sections */}
      {complexityData && (
        <>
          {/* Join Types Breakdown */}
          {complexityData.joinsByType && Object.keys(complexityData.joinsByType).length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={18} style={{ color: '#8b5cf6' }} />
                Join Types ({complexityData.joinsTotal || 0} total)
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {Object.entries(complexityData.joinsByType).map(([type, count]: [string, any]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>{type}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Set Operations Breakdown */}
          {complexityData.setOps && Object.values(complexityData.setOps).some((v: any) => v > 0) && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} style={{ color: '#f59e0b' }} />
                Set Operations
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {Object.entries(complexityData.setOps)
                  .filter(([_, count]: [string, any]) => count > 0)
                  .map(([type, count]: [string, any]) => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>{type}</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tables Used */}
          {complexityData.tableNames && complexityData.tableNames.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={18} style={{ color: '#3b82f6' }} />
                Tables Used ({complexityData.tables || 0})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {complexityData.tableNames.map((table: string, idx: number) => (
                  <div key={idx} style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, fontSize: 13, fontFamily: 'monospace', color: '#1e40af' }}>
                    {table}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Functions Called */}
          {complexityData.functionNames && complexityData.functionNames.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Code size={18} style={{ color: '#10b981' }} />
                Functions Called ({complexityData.fnCalls || 0})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {complexityData.functionNames.map((func: string, idx: number) => (
                  <div key={idx} style={{ padding: '8px 12px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 4, fontSize: 13, fontFamily: 'monospace', color: '#065f46' }}>
                    {func}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Complexity Metrics */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>Additional Complexity Metrics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {complexityData.subqueryDepth > 0 && (
                <SimpleMetric label="Subquery Depth" value={complexityData.subqueryDepth} color="#6366f1" />
              )}
              {complexityData.scalarSubqueries > 0 && (
                <SimpleMetric label="Scalar Subqueries" value={complexityData.scalarSubqueries} color="#6366f1" />
              )}
              {complexityData.caseExprs > 0 && (
                <SimpleMetric label="CASE Expressions" value={complexityData.caseExprs} color="#ec4899" />
              )}
              {complexityData.windows > 0 && (
                <SimpleMetric label="Window Functions" value={complexityData.windows} color="#8b5cf6" />
              )}
              {complexityData.analyticFns > 0 && (
                <SimpleMetric label="Analytic Functions" value={complexityData.analyticFns} color="#a855f7" />
              )}
              {complexityData.aggFns > 0 && (
                <SimpleMetric label="Aggregate Functions" value={complexityData.aggFns} color="#06b6d4" />
              )}
              {complexityData.hasDistinct && (
                <SimpleMetric label="DISTINCT" value="Yes" color="#10b981" />
              )}
              {complexityData.groupBy && (
                <SimpleMetric label="GROUP BY" value="Yes" color="#10b981" />
              )}
              {complexityData.having && (
                <SimpleMetric label="HAVING" value="Yes" color="#10b981" />
              )}
            </div>
          </div>
        </>
      )}

      {/* SQL Body */}
      {viewData?.selectBody && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>SELECT Statement</h2>
          <pre
            style={{
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: 12,
              fontSize: 13,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              maxHeight: 500,
              overflow: 'auto',
              margin: 0
            }}
          >
            {viewData.selectBody}
          </pre>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ background: color ? `${color}15` : '#f1f5f9', borderRadius: 6, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: color || '#6b7280' }}>{icon}</div>
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0f172a', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function SimpleMetric({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: color || '#0f172a' }}>{value}</span>
    </div>
  );
}

export default function ViewComplexityDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Loading...</div>}>
      <ViewComplexityDetailContent />
    </Suspense>
  );
}
