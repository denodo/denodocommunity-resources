import React from 'react';
import { ArrowRight } from 'lucide-react';
import { colors, spacing, borderRadius } from '../styles/theme';

const HorizontalBar = ({ label, value, total, color, hasArrow = false, subItems = [] }) => {
  const percentage = total > 0 ? ((value || 0) / total) * 100 : 0;
  const barWidth = Math.max(percentage, 2); // Minimum 2% for visibility
  
  return (
    <div style={horizontalBarStyles.container}>
      <div style={horizontalBarStyles.header}>
        <div style={horizontalBarStyles.labelContainer}>
          {hasArrow && (
            <ArrowRight size={16} style={horizontalBarStyles.arrow} />
          )}
          <span style={horizontalBarStyles.label}>{label}</span>
        </div>
        <span style={horizontalBarStyles.value}>
          {(value || 0).toLocaleString()}
        </span>
      </div>
      
      <div style={horizontalBarStyles.barContainer}>
        <div style={horizontalBarStyles.barBackground}>
          <div 
            style={{
              ...horizontalBarStyles.barFill,
              width: `${barWidth}%`,
              backgroundColor: color
            }}
          />
        </div>
        <span style={horizontalBarStyles.percentage}>
          {percentage.toFixed(1)}%
        </span>
      </div>
      
      {/* Sub-items for additional details */}
      {subItems.length > 0 && (
        <div style={horizontalBarStyles.subItems}>
          {subItems.map((item, index) => (
            <div key={index} style={horizontalBarStyles.subItem}>
              <ArrowRight size={12} style={horizontalBarStyles.subArrow} />
              <span style={horizontalBarStyles.subLabel}>{item.label}</span>
              <span style={horizontalBarStyles.subValue}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const horizontalBarStyles = {
  container: {
    marginBottom: spacing.sm, // Reduced from lg
    padding: spacing.sm, // Reduced from md
    background: colors.white,
    borderRadius: borderRadius.sm, // Reduced from md
    border: `1px solid ${colors.gray200}`,
    transition: 'all 0.2s ease'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs // Reduced from sm
  },
  
  labelContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs // Reduced from sm
  },
  
  arrow: {
    color: colors.accent,
    flexShrink: 0
  },
  
  label: {
    fontSize: '14px', // Reduced from 15px
    fontWeight: 600,
    color: colors.gray800
  },
  
  value: {
    fontSize: '15px', // Reduced from 16px
    fontWeight: 700,
    color: colors.gray900
  },
  
  barContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm // Reduced from md
  },
  
  barBackground: {
    flex: 1,
    height: '10px', // Reduced from 12px
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.full,
    overflow: 'hidden'
  },
  
  barFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    transition: 'width 0.8s ease-out',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)'
  },
  
  percentage: {
    fontSize: '11px', // Reduced from 12px
    fontWeight: 600,
    color: colors.gray600,
    minWidth: '40px', // Reduced from 45px
    textAlign: 'right'
  },
  
  subItems: {
    marginTop: spacing.xs, // Reduced from sm
    paddingLeft: spacing.md, // Reduced from lg
    borderLeft: `2px solid ${colors.gray200}`
  },
  
  subItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs, // Reduced from sm
    padding: `${spacing.xs} 0`,
    fontSize: '12px' // Reduced from 13px
  },
  
  subArrow: {
    color: colors.gray400,
    flexShrink: 0
  },
  
  subLabel: {
    flex: 1,
    color: colors.gray600,
    fontWeight: 500
  },
  
  subValue: {
    color: colors.gray700,
    fontWeight: 600,
    minWidth: '35px', // Reduced from 40px
    textAlign: 'right'
  }
};

export default HorizontalBar;