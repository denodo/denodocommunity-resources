"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { BarChart3, AlertTriangle, CheckCircle, TrendingUp, Search, Database, Eye, Download, ExternalLink, ArrowLeft } from 'lucide-react';
import { duckdb } from '@/lib/database/duckdb-client';
import { useRouter } from 'next/navigation';
import { useComplexity } from '@/contexts/ComplexityContext';
import { colors, spacing, borderRadius, shadows, typography } from '@/lib/theme';

type ViewRow = { name: string; database: string; kind?: string; selectBody?: string };
type ComplexityItem = {
  name: string;
  database: string;
  score: number;
  tier?: string;
  tables?: number;
  unions?: number;
  unions_all?: number;
  left_joins?: number;
  inner_joins?: number;
  [key: string]: any; // For additional metrics from Python backend
};

export default function ViewComplexityPage() {
  const router = useRouter();
  const { complexityResults, setComplexityResults, clearComplexityResults, analysisTimestamp, updateAnalysisTimestamp } = useComplexity();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState<ViewRow[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const MAX_UI_ITEMS = 100;

  // Track analysis timestamp to detect new file uploads (React pattern)
  const analysisTimestampRef = useRef<number | null>(null);

  // Load views from DuckDB on mount
  useEffect(() => {
    const run = async () => {
      try {
        await duckdb.waitForInitialization();

        // Get total count of actual views (excluding tables)
        const totalResult = await duckdb.query<{ count: number }>(
          `SELECT COUNT(*) as count FROM views WHERE kind = 'view' OR kind = 'interface view'`
        );
        const total = Number(totalResult?.[0]?.count || 0);
        setTotalViews(total);

        // Query DuckDB using snake_case column names (schema definition)
        // DuckDB client will auto-convert results to camelCase
        const rows = await duckdb.query<ViewRow>(
          `SELECT
            name,
            database,
            kind,
            select_body as selectBody
          FROM views
          WHERE
            select_body IS NOT NULL
            AND LENGTH(TRIM(select_body)) > 0
            AND (kind = 'view' OR kind = 'interface view')`
        );

        console.log('🔍 ViewComplexity: Total views from DuckDB:', total);
        console.log('🔍 ViewComplexity: Analyzable views with SELECT:', rows?.length || 0);
        console.log('🔍 ViewComplexity: Sample view data:', rows?.slice(0, 2));

        setViews(rows || []);

        // Get the analysis timestamp from context (set during VQL upload)
        // Only clear complexity results if analysis timestamp changed (new file uploaded)
        if (analysisTimestampRef.current === null) {
          // First load - initialize with context timestamp
          analysisTimestampRef.current = analysisTimestamp;
        } else if (analysisTimestamp && analysisTimestamp !== analysisTimestampRef.current) {
          // New file detected (timestamp changed) - clear complexity results
          console.log('[ViewComplexity] New analysis detected - clearing old complexity results');
          analysisTimestampRef.current = analysisTimestamp;
          clearComplexityResults();
          setSearchTerm('');
          setCurrentPage(1);
        }
        // If timestamps match or no new timestamp, keep existing complexity results
      } catch (e: any) {
        console.error('Failed to load views from DuckDB:', e);
        setError(e?.message || 'Failed to load views');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [clearComplexityResults, updateAnalysisTimestamp]);

  const analyzableCount = views.length;

  // Extract results array from context
  const results = complexityResults?.top_views || null;
  const csvData = complexityResults?.csv_data || null;

  const filteredResults = useMemo(() => {
    if (!results) return [] as ComplexityItem[];

    // Sort by score descending and take top 100
    const top100 = [...results].sort((a, b) => b.score - a.score).slice(0, MAX_UI_ITEMS);

    // Apply search filter
    if (!searchTerm) return top100;
    const q = searchTerm.toLowerCase();
    return top100.filter(r => r.name.toLowerCase().includes(q) || r.database.toLowerCase().includes(q));
  }, [results, searchTerm]);

  // Paginated results
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredResults.slice(startIndex, endIndex);
  }, [filteredResults, currentPage]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);

  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      const payload = {
        views: views.map(v => ({ name: v.name, database: v.database, kind: v.kind || 'view', selectBody: v.selectBody })),
        dialect: 'ansi',
        topCount: 5000, // Analyze ALL views, not just top 100
      };
      const resp = await fetch('/analyze-complexity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await resp.json();
      if (!resp.ok || data.success === false) {
        throw new Error(data.message || 'Analysis failed');
      }
      const top = (data.top_views || []) as any[];
      const mapped: ComplexityItem[] = top.map((it: any) => ({
        ...it, // Keep all fields from backend
        name: it.name,
        database: it.database,
        score: Number(it.score ?? 0),
        tier: it.tier,
        tables: Number(it.tables ?? it.tables_used ?? 0),
        unions: Number(it.union_count ?? 0),
        unions_all: Number(it.union_all_count ?? it.unions_all ?? 0),
        left_joins: Number(it.left_join_count ?? 0),
        inner_joins: Number(it.inner_join_count ?? 0),
      }));
      mapped.sort((a, b) => b.score - a.score);

      // Store results in context (React pattern - parent state management)
      // This persists results across navigation to detail page and back
      setComplexityResults({
        success: data.success,
        analyzed_successfully: data.analyzed_successfully || mapped.length,
        csv_data: data.csv_data,
        top_views: mapped,
        timestamp: Date.now()
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!csvData) return;

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `view-complexity-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleViewDetail = (view: ComplexityItem) => {
    // Navigate to detail page with query params
    router.push(`/view-complexity/detail?name=${encodeURIComponent(view.name)}&database=${encodeURIComponent(view.database)}`);
  };

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
          <p style={{ fontSize: '14px', color: colors.gray600 }}>Loading views...</p>
        </div>
      </div>
    );
  }

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
              background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentLight} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white
            }}>
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: colors.gray900,
                margin: 0,
                lineHeight: 1.2
              }}>View Complexity Analysis</h1>
              <p style={{
                fontSize: '14px',
                color: colors.gray600,
                margin: `${spacing.xs} 0 0 0`
              }}>
                Analyze SQL complexity of views using Python-based parsing
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            background: '#fef2f2',
            color: '#991b1b',
            border: `1px solid #fecaca`,
            padding: spacing.md,
            borderRadius: borderRadius.md,
            marginBottom: spacing.lg,
            fontSize: '14px'
          }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing.md,
          marginBottom: spacing.lg
        }}>
          <Stat icon={<Eye size={28} />} label="Total Views" value={totalViews} note="Excluding tables" color={colors.accent} />
          <Stat icon={<BarChart3 size={28} />} label="Analyzable Views" value={analyzableCount} note="With SELECT" color={colors.success} />
          {results && (
            <>
              <Stat icon={<CheckCircle size={28} />} label="Analyzed" value={results.length} color={colors.info} />
              <Stat icon={<TrendingUp size={28} />} label="Highest Score" value={results[0]?.score ?? 0} note={results[0]?.tier} color={colors.warning} />
            </>
          )}
        </div>

        {/* Action Bar */}
        <div style={{
          background: colors.white,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
          boxShadow: shadows.sm,
          border: `1px solid ${colors.gray200}`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md
        }}>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || analyzableCount === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.md}`,
              background: isAnalyzing || analyzableCount === 0 ? colors.gray400 : colors.accent,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: '14px',
              fontWeight: 600,
              cursor: isAnalyzing || analyzableCount === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <BarChart3 size={18} /> {isAnalyzing ? 'Analyzing...' : 'Analyze Complexity'}
          </button>
          {csvData && (
            <button
              onClick={handleDownloadCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: `${spacing.sm} ${spacing.md}`,
                background: colors.success,
                color: colors.white,
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Download size={18} /> Download CSV
            </button>
          )}
          <div style={{ marginLeft: 'auto', position: 'relative', minWidth: '300px', flex: 1, maxWidth: '400px' }}>
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
              placeholder="Search views..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
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
        </div>

        {/* Results Section */}
        {results && results.length > 0 && (
          <>
            {/* Info banner */}
            {results.length > MAX_UI_ITEMS && (
              <div style={{
                background: '#eff6ff',
                border: `1px solid #bfdbfe`,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
                fontSize: '14px',
                color: '#1e40af'
              }}>
                <strong>Note:</strong> Showing top {MAX_UI_ITEMS} views by complexity score. Full results ({results.length} views) available in CSV download.
              </div>
            )}

            <div style={{
              background: colors.white,
              border: `1px solid ${colors.gray200}`,
              borderRadius: borderRadius.lg,
              boxShadow: shadows.sm,
              overflow: 'hidden',
              marginBottom: spacing.lg
            }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: colors.gray100, borderBottom: `1px solid ${colors.gray200}` }}>
                    <Th>Rank</Th>
                    <Th>View</Th>
                    <Th>Database</Th>
                    <Th align="right">Score</Th>
                    <Th align="right">Tables</Th>
                    <Th align="right">Joins</Th>
                    <Th align="right">Union All</Th>
                    <Th align="right">Functions</Th>
                    <Th align="right">Subqueries</Th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.map((r, idx) => {
                    const rank = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                    return (
                      <tr
                        key={r.database + ':' + r.name}
                        onClick={() => handleViewDetail(r)}
                        style={{
                          borderTop: `1px solid ${colors.gray200}`,
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = colors.gray50}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Td>
                          <span style={{ fontWeight: 600, color: colors.gray600 }}>#{rank}</span>
                        </Td>
                        <Td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, fontWeight: 600 }}>
                            {r.name}
                            <ExternalLink size={14} style={{ color: colors.gray400 }} />
                          </span>
                        </Td>
                        <Td><span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}><Database size={14} color={colors.accent} />{r.database}</span></Td>
                        <Td align="right"><ScoreBadge score={r.score} /></Td>
                        <Td align="right">{r.tables ?? 0}</Td>
                        <Td align="right">{r.joinsTotal ?? 0}</Td>
                        <Td align="right">{r.setOps?.unionAll ?? 0}</Td>
                        <Td align="right">{r.fnCalls ?? 0}</Td>
                        <Td align="right">{r.subqueryDepth ?? 0}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: spacing.md,
                background: colors.white,
                borderRadius: borderRadius.lg,
                boxShadow: shadows.sm,
                border: `1px solid ${colors.gray200}`
              }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                  Previous
                </button>

                <div style={{
                  fontSize: '13px',
                  color: colors.gray600,
                  fontWeight: 500
                }}>
                  Page {currentPage} of {totalPages} • Showing {filteredResults.length} view{filteredResults.length !== 1 ? 's' : ''}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ textAlign: align || 'left', padding: '10px 12px', fontSize: 12, color: '#475569', borderBottom: '1px solid #e5e7eb' }}>{children}</th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ textAlign: align || 'left', padding: '10px 12px', fontSize: 13, color: '#0f172a' }}>{children}</td>
  );
}

type StatProps = {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  note?: string;
  color?: string; // <- allow color
};

function Stat({ icon, label, value, note, color }: StatProps) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${color ?? '#e5e7eb'}`,
      borderRadius: 6,
      padding: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }}>
      <div style={{
        background: '#f1f5f9',
        borderRadius: 6,
        padding: 6,
        color: color ?? '#0f172a' // tint icon if color provided
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: color ?? '#0f172a' }}>{value}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
        {note && <div style={{ fontSize: 11, color: '#94a3b8' }}>{note}</div>}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let bg = '#dcfce7';
  let color = '#166534';
  if (score >= 80) { bg = '#fee2e2'; color = '#991b1b'; }
  else if (score >= 60) { bg = '#ffedd5'; color = '#9a3412'; }
  else if (score >= 40) { bg = '#fef9c3'; color = '#854d0e'; }
  return (
    <span style={{ background: bg, color, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>{score}</span>
  );
}
