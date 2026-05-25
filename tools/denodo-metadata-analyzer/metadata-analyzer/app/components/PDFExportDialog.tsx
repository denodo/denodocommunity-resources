'use client';

import React, { useState } from 'react';
import { X, Download, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/lib/theme';

interface PDFExportOptions {
  includeSummary: boolean;
  includeVDBBreakdown: boolean;
  vdbColumns: string[];
  includeViewComplexity: boolean;
  viewComplexityTop: number;
  includeServerConfig: boolean;
}

interface PDFExportDialogProps {
  onClose: () => void;
  onExport: (options: PDFExportOptions) => void;
  analysisData: any;
}

const VDB_COLUMN_OPTIONS = [
  { id: 'name', label: 'Database Name', default: true },
  { id: 'viewCount', label: 'View Count', default: true },
  { id: 'dataSourceCount', label: 'Data Source Count', default: true },
  { id: 'cacheStatus', label: 'Cache Status', default: false },
  { id: 'denodoVersion', label: 'Denodo Version', default: false },
];

const VIEW_COMPLEXITY_OPTIONS = [5, 10, 15, 20];

export default function PDFExportDialog({ onClose, onExport, analysisData }: PDFExportDialogProps) {
  const [options, setOptions] = useState<PDFExportOptions>({
    includeSummary: true,
    includeVDBBreakdown: true,
    vdbColumns: VDB_COLUMN_OPTIONS.filter(col => col.default).map(col => col.id),
    includeViewComplexity: true,
    viewComplexityTop: 10,
    includeServerConfig: true,
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const toggleVDBColumn = (columnId: string) => {
    const newColumns = options.vdbColumns.includes(columnId)
      ? options.vdbColumns.filter(id => id !== columnId)
      : [...options.vdbColumns, columnId];
    setOptions({ ...options, vdbColumns: newColumns });
  };

  const handleExport = () => {
    onExport(options);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: spacing.md
    }}>
      <div style={{
        background: colors.white,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.xl,
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.gray200}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: typography.fontWeight.semibold,
              color: colors.gray900,
              margin: 0
            }}>Export PDF Report</h2>
            <p style={{
              fontSize: '13px',
              color: colors.gray500,
              margin: '4px 0 0 0'
            }}>Customize what to include in your report</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: spacing.sm,
              cursor: 'pointer',
              color: colors.gray400,
              display: 'flex',
              alignItems: 'center',
              borderRadius: borderRadius.md
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.gray100}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: spacing.lg,
          overflowY: 'auto',
          flex: 1
        }}>
          {/* Summary Section */}
          <SectionOption
            title="Summary Statistics"
            description="Overview of databases, views, and data sources"
            checked={options.includeSummary}
            onChange={(checked) => setOptions({ ...options, includeSummary: checked })}
            expanded={expandedSections.has('summary')}
            onToggleExpand={() => toggleSection('summary')}
          >
            <div style={{ fontSize: '13px', color: colors.gray600, marginTop: spacing.sm }}>
              Includes total counts, type distributions, and key metrics in a clean tabular format.
            </div>
          </SectionOption>

          {/* VDB Breakdown */}
          <SectionOption
            title="VDB Breakdown"
            description="Database-level details and statistics"
            checked={options.includeVDBBreakdown}
            onChange={(checked) => setOptions({ ...options, includeVDBBreakdown: checked })}
            expanded={expandedSections.has('vdb')}
            onToggleExpand={() => toggleSection('vdb')}
          >
            <div style={{ marginTop: spacing.sm }}>
              <label style={{
                fontSize: '12px',
                fontWeight: typography.fontWeight.medium,
                color: colors.gray700,
                display: 'block',
                marginBottom: spacing.xs
              }}>Select Columns to Include:</label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {VDB_COLUMN_OPTIONS.map(column => (
                  <label
                    key={column.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      cursor: 'pointer',
                      padding: spacing.sm,
                      borderRadius: borderRadius.md,
                      background: options.vdbColumns.includes(column.id) ? colors.gray100 : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!options.vdbColumns.includes(column.id)) {
                        e.currentTarget.style.background = colors.gray50;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!options.vdbColumns.includes(column.id)) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={options.vdbColumns.includes(column.id)}
                      onChange={() => toggleVDBColumn(column.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{
                      fontSize: '13px',
                      color: colors.gray700,
                      fontWeight: options.vdbColumns.includes(column.id) ? typography.fontWeight.medium : typography.fontWeight.normal
                    }}>
                      {column.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </SectionOption>

          {/* View Complexity */}
          <SectionOption
            title="View Complexity Analysis"
            description="Most complex views with detailed metrics"
            checked={options.includeViewComplexity}
            onChange={(checked) => setOptions({ ...options, includeViewComplexity: checked })}
            expanded={expandedSections.has('complexity')}
            onToggleExpand={() => toggleSection('complexity')}
          >
            <div style={{ marginTop: spacing.sm }}>
              <label style={{
                fontSize: '12px',
                fontWeight: typography.fontWeight.medium,
                color: colors.gray700,
                display: 'block',
                marginBottom: spacing.xs
              }}>Number of Views to Include:</label>

              <select
                value={options.viewComplexityTop}
                onChange={(e) => setOptions({ ...options, viewComplexityTop: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: `${spacing.sm} ${spacing.md}`,
                  fontSize: '13px',
                  border: `1px solid ${colors.gray300}`,
                  borderRadius: borderRadius.md,
                  background: colors.white,
                  color: colors.gray900,
                  cursor: 'pointer'
                }}
              >
                {VIEW_COMPLEXITY_OPTIONS.map(num => (
                  <option key={num} value={num}>Top {num} Most Complex Views</option>
                ))}
              </select>
            </div>
          </SectionOption>

          {/* Server Configuration */}
          <SectionOption
            title="Server Configuration"
            description="System settings, security, and optimization flags"
            checked={options.includeServerConfig}
            onChange={(checked) => setOptions({ ...options, includeServerConfig: checked })}
            expanded={expandedSections.has('config')}
            onToggleExpand={() => toggleSection('config')}
          >
            <div style={{ fontSize: '13px', color: colors.gray600, marginTop: spacing.sm }}>
              Includes cache settings, security configurations, query optimization, and web container details.
            </div>
          </SectionOption>
        </div>

        {/* Footer */}
        <div style={{
          padding: spacing.lg,
          borderTop: `1px solid ${colors.gray200}`,
          display: 'flex',
          gap: spacing.md,
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: `${spacing.sm} ${spacing.lg}`,
              fontSize: '13px',
              fontWeight: typography.fontWeight.medium,
              color: colors.gray700,
              background: colors.white,
              border: `1px solid ${colors.gray300}`,
              borderRadius: borderRadius.md,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.gray50}
            onMouseLeave={(e) => e.currentTarget.style.background = colors.white}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: `${spacing.sm} ${spacing.lg}`,
              fontSize: '13px',
              fontWeight: typography.fontWeight.medium,
              color: colors.white,
              background: colors.accent,
              border: 'none',
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.accentHover}
            onMouseLeave={(e) => e.currentTarget.style.background = colors.accent}
          >
            <Download size={16} />
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
}

interface SectionOptionProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  children?: React.ReactNode;
}

function SectionOption({ title, description, checked, onChange, expanded, onToggleExpand, children }: SectionOptionProps) {
  return (
    <div style={{
      marginBottom: spacing.md,
      border: `1px solid ${colors.gray200}`,
      borderRadius: borderRadius.md,
      overflow: 'hidden'
    }}>
      <div
        style={{
          padding: spacing.md,
          background: checked ? colors.gray100 : colors.white,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing.sm
        }}
        onClick={() => onChange(!checked)}
      >
        <div style={{ paddingTop: '2px' }}>
          {checked ? (
            <CheckSquare size={20} color={colors.accent} />
          ) : (
            <Square size={20} color={colors.gray400} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: typography.fontWeight.semibold,
            color: colors.gray900,
            marginBottom: '2px'
          }}>
            {title}
          </div>
          <div style={{
            fontSize: '12px',
            color: colors.gray600
          }}>
            {description}
          </div>
        </div>
        {children && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: spacing.xs,
              cursor: 'pointer',
              color: colors.gray500,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {checked && expanded && children && (
        <div style={{
          padding: spacing.md,
          background: colors.gray50,
          borderTop: `1px solid ${colors.gray200}`
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
