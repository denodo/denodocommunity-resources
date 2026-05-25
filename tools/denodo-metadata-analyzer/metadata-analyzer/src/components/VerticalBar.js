import React from 'react';
import { colors, spacing, borderRadius } from '../styles/theme';

const VerticalBar = ({ data = [], maxHeight = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div style={verticalBarStyles.emptyState}>
        <p style={verticalBarStyles.emptyText}>No data available</p>
      </div>
    );
  }

  // Find the maximum value for scaling
  const maxValue = Math.max(...data.map(item => item.value || 0));
  
  return (
    <div style={verticalBarStyles.container}>
      <div style={verticalBarStyles.chartContainer}>
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? ((item.value || 0) / maxValue) * maxHeight : 0;
          const percentage = maxValue > 0 ? (((item.value || 0) / maxValue) * 100).toFixed(1) : 0;
          
          return (
            <div key={index} style={verticalBarStyles.barWrapper}>
              <div style={verticalBarStyles.barContainer}>
                <div style={verticalBarStyles.valueLabel}>
                  {(item.value || 0).toLocaleString()}
                </div>
                <div 
                  style={{
                    ...verticalBarStyles.bar,
                    height: `${Math.max(barHeight, 4)}px`, // Minimum height for visibility
                    backgroundColor: item.color || colors.primarySolid,
                    maxHeight: `${maxHeight}px`
                  }}
                >
                  <div style={verticalBarStyles.barGlow} />
                </div>
                <div style={verticalBarStyles.percentageLabel}>
                  {percentage}%
                </div>
              </div>
              <div style={verticalBarStyles.labelContainer}>
                <div style={verticalBarStyles.label}>
                  {item.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const verticalBarStyles = {
  container: {
    width: '100%',
    padding: spacing.sm // Reduced from md
  },
  
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '160px', // Reduced from 200px
    color: colors.gray500
  },
  
  emptyText: {
    fontSize: '13px', // Reduced from 14px
    fontStyle: 'italic',
    margin: 0
  },
  
  chartContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: spacing.xs, // Reduced from sm
    padding: `${spacing.md} ${spacing.xs}`, // Reduced from lg/sm
    minHeight: '200px' // Reduced from 240px
  },
  
  barWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    maxWidth: '70px' // Reduced from 80px
  },
  
  barContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative'
  },
  
  valueLabel: {
    fontSize: '11px', // Reduced from 12px
    fontWeight: 600,
    color: colors.gray700,
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  
  bar: {
    width: '28px', // Reduced from 32px
    borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`,
    position: 'relative',
    transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)', // Reduced shadow
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 3px 12px rgba(0, 0, 0, 0.12)' // Reduced hover shadow
    }
  },
  
  barGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.3), transparent)',
    borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`
  },
  
  percentageLabel: {
    fontSize: '9px', // Reduced from 10px
    fontWeight: 500,
    color: colors.gray500,
    marginTop: spacing.xs,
    textAlign: 'center'
  },
  
  labelContainer: {
    marginTop: spacing.sm, // Reduced from md
    width: '100%'
  },
  
  label: {
    fontSize: '10px', // Reduced from 11px
    fontWeight: 500,
    color: colors.gray800,
    textAlign: 'center',
    lineHeight: '1.2',
    wordWrap: 'break-word',
    hyphens: 'auto'
  }
};

export default VerticalBar;