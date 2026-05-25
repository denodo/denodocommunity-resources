import React from 'react';
import { CheckCircle2, XCircle, Circle } from 'lucide-react';
import { colors, spacing, borderRadius, shadows } from '../lib/theme';

interface ExcelWrapperStatsCardProps {
  totalExcelWrappers: number;
  streamTuplesEnabled: number;
  streamTuplesDisabled: number;
  streamTuplesUnconfigured: number;
  onFilterChange?: (filter: 'all' | 'enabled' | 'disabled') => void;
  currentFilter?: 'all' | 'enabled' | 'disabled';
}

/**
 * ExcelWrapperStatsCard Component
 * Displays Excel wrapper stream tuples statistics in a summary card
 * Shown above the Excel Wrappers table in Data Sources → Custom → Excel Wrappers
 */
export const ExcelWrapperStatsCard: React.FC<ExcelWrapperStatsCardProps> = ({
  totalExcelWrappers,
  streamTuplesEnabled,
  streamTuplesDisabled,
  streamTuplesUnconfigured,
  onFilterChange,
  currentFilter = 'all'
}) => {
  // Calculate percentages
  const enabledPercentage = totalExcelWrappers > 0
    ? Math.round((streamTuplesEnabled / totalExcelWrappers) * 100)
    : 0;
  const disabledPercentage = totalExcelWrappers > 0
    ? Math.round((streamTuplesDisabled / totalExcelWrappers) * 100)
    : 0;

  return (
    <div style={{
      background: colors.white,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      border: `1px solid ${colors.gray200}`,
      boxShadow: shadows.sm
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: colors.gray900,
        marginBottom: spacing.md,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm
      }}>
        📊 Excel Wrapper Stream Tuples Analysis
      </h3>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.lg
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: spacing.md,
          flex: 1
        }}>
          {/* Total Excel Wrappers */}
          <div style={{
            background: colors.gray50,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            border: `1px solid ${colors.gray200}`
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: colors.gray600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: spacing.xs
            }}>
              Total Excel Wrappers
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: colors.gray900
            }}>
              {totalExcelWrappers}
            </div>
          </div>

          {/* Stream Tuples Enabled */}
          <div style={{
            background: `${colors.success}10`,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            border: `1px solid ${colors.success}30`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              fontSize: '11px',
              fontWeight: 600,
              color: colors.gray600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: spacing.xs
            }}>
              <CheckCircle2 size={14} style={{ color: colors.success }} />
              Stream Tuples Enabled
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: colors.success,
              display: 'flex',
              alignItems: 'baseline',
              gap: spacing.xs
            }}>
              {streamTuplesEnabled}
              <span style={{
                fontSize: '14px',
                fontWeight: 500,
                color: colors.gray600
              }}>
                ({enabledPercentage}%)
              </span>
            </div>
          </div>

          {/* Stream Tuples Disabled */}
          <div style={{
            background: `${colors.error}10`,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            border: `1px solid ${colors.error}30`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              fontSize: '11px',
              fontWeight: 600,
              color: colors.gray600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: spacing.xs
            }}>
              <XCircle size={14} style={{ color: colors.error }} />
              Stream Tuples Disabled
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: colors.error,
              display: 'flex',
              alignItems: 'baseline',
              gap: spacing.xs
            }}>
              {streamTuplesDisabled}
              <span style={{
                fontSize: '14px',
                fontWeight: 500,
                color: colors.gray600
              }}>
                ({disabledPercentage}%)
              </span>
            </div>
          </div>
        </div>

        {/* Filter Dropdown */}
        {onFilterChange && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.xs
          }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              color: colors.gray600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Filter by Status
            </label>
            <select
              value={currentFilter}
              onChange={(e) => onFilterChange(e.target.value as 'all' | 'enabled' | 'disabled')}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                fontSize: '14px',
                fontWeight: 500,
                color: colors.gray900,
                background: colors.white,
                border: `1px solid ${colors.gray300}`,
                borderRadius: borderRadius.md,
                cursor: 'pointer',
                outline: 'none',
                minWidth: '160px'
              }}
            >
              <option value="all">All Wrappers</option>
              <option value="enabled">Enabled Only</option>
              <option value="disabled">Disabled Only</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
