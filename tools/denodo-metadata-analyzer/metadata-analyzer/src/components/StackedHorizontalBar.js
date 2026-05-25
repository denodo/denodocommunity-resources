import React from 'react';
import { colors, spacing, borderRadius } from '../styles/theme';

const StackedHorizontalBar = ({ data = [], maxBars = 10 }) => {
  if (!data || data.length === 0) {
    return (
      <div style={stackedBarStyles.emptyState}>
        <p style={stackedBarStyles.emptyText}>No data available</p>
      </div>
    );
  }

  // Sort by total views (descending) and take top N
  const sortedData = [...data]
    .sort((a, b) => b.total - a.total)
    .slice(0, maxBars);

  // Find the maximum total value for scaling
  const maxTotal = Math.max(...sortedData.map(item => item.total));

  return (
    <div style={stackedBarStyles.container}>
      {/* Legend at the top */}
      <div style={stackedBarStyles.legend}>
        <div style={stackedBarStyles.legendItem}>
          <div style={{...stackedBarStyles.legendColor, backgroundColor: colors.successLight}} />
          <span style={stackedBarStyles.legendLabel}>Base Views</span>
        </div>
        <div style={stackedBarStyles.legendItem}>
          <div style={{...stackedBarStyles.legendColor, backgroundColor: colors.accent}} />
          <span style={stackedBarStyles.legendLabel}>Derived Views</span>
        </div>
        <div style={stackedBarStyles.legendItem}>
          <div style={{...stackedBarStyles.legendColor, backgroundColor: colors.errorLight}} />
          <span style={stackedBarStyles.legendLabel}>Interface Views</span>
        </div>
      </div>
      
      <div style={stackedBarStyles.chartContainer}>
        {sortedData.map((item, index) => {
          // More aggressive scaling approach for better visual representation
          const linearPercentage = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
          const logPercentage = maxTotal > 0 && item.total > 0 ? 
            (Math.log(item.total + 1) / Math.log(maxTotal + 1)) * 100 : 0;
          
          // Use mostly logarithmic scaling with some linear for dramatic differences
          // First bar gets full width, others get more generous sizing
          let barWidth;
          if (index === 0) {
            barWidth = 100; // Top item always full width
          } else {
            // Use 80% log scaling + 20% linear, with generous minimum
            const blendedPercentage = (logPercentage * 0.8) + (linearPercentage * 0.2);
            barWidth = Math.max(blendedPercentage, 35); // Much higher minimum for visibility
          }
          
          // Calculate segment percentages with minimum widths for visibility
          const minSegmentWidth = 8; // Minimum width for any visible segment
          
          // Calculate natural proportions first
          const baseRatio = item.total > 0 ? item.base / item.total : 0;
          const derivedRatio = item.total > 0 ? item.derived / item.total : 0;
          const interfaceRatio = item.total > 0 ? item.interface / item.total : 0;
          
          // Apply minimum widths and adjust proportions
          let baseWidth = item.base > 0 ? Math.max(baseRatio * barWidth, minSegmentWidth) : 0;
          let derivedWidth = item.derived > 0 ? Math.max(derivedRatio * barWidth, minSegmentWidth) : 0;
          let interfaceWidth = item.interface > 0 ? Math.max(interfaceRatio * barWidth, minSegmentWidth) : 0;
          
          // If total exceeds bar width due to minimums, proportionally reduce while respecting minimums
          const totalSegmentWidth = baseWidth + derivedWidth + interfaceWidth;
          if (totalSegmentWidth > barWidth) {
            const availableWidth = barWidth - (
              (item.base > 0 ? minSegmentWidth : 0) + 
              (item.derived > 0 ? minSegmentWidth : 0) + 
              (item.interface > 0 ? minSegmentWidth : 0)
            );
            const totalExtraWidth = totalSegmentWidth - barWidth;
            
            if (availableWidth > 0) {
              const scaleFactor = availableWidth / (totalSegmentWidth - (
                (item.base > 0 ? minSegmentWidth : 0) + 
                (item.derived > 0 ? minSegmentWidth : 0) + 
                (item.interface > 0 ? minSegmentWidth : 0)
              ));
              
              baseWidth = item.base > 0 ? minSegmentWidth + (baseWidth - minSegmentWidth) * scaleFactor : 0;
              derivedWidth = item.derived > 0 ? minSegmentWidth + (derivedWidth - minSegmentWidth) * scaleFactor : 0;
              interfaceWidth = item.interface > 0 ? minSegmentWidth + (interfaceWidth - minSegmentWidth) * scaleFactor : 0;
            }
          }

          return (
            <div key={index} style={stackedBarStyles.barRow}>
              <div style={stackedBarStyles.labelSection}>
                <div style={stackedBarStyles.rankNumber}>
                  #{index + 1}
                </div>
                <div style={stackedBarStyles.labelInfo}>
                  <div style={stackedBarStyles.label} title={item.name}>
                    {item.name}
                  </div>
                  <div style={stackedBarStyles.totalValue}>
                    {item.total.toLocaleString()} total views
                  </div>
                </div>
              </div>
              
              <div style={stackedBarStyles.barSection}>
                <div style={stackedBarStyles.barContainer}>
                  <div style={stackedBarStyles.barBackground}>
                    <div 
                      style={{
                        ...stackedBarStyles.barWrapper,
                        width: `${barWidth}%`,
                      }}
                    >
                      {/* Base Views Segment */}
                      {item.base > 0 && (
                        <div
                          style={{
                            ...stackedBarStyles.barSegment,
                            width: `${baseWidth}%`,
                            backgroundColor: colors.successLight,
                          }}
                          title={`Base Views: ${item.base.toLocaleString()}`}
                        >
                          {baseWidth > 4 && ( // Only show text if segment is wide enough
                            <span style={stackedBarStyles.segmentText}>
                              {item.base}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Derived Views Segment */}
                      {item.derived > 0 && (
                        <div
                          style={{
                            ...stackedBarStyles.barSegment,
                            width: `${derivedWidth}%`,
                            backgroundColor: colors.accent,
                          }}
                          title={`Derived Views: ${item.derived.toLocaleString()}`}
                        >
                          {derivedWidth > 4 && ( // Only show text if segment is wide enough
                            <span style={stackedBarStyles.segmentText}>
                              {item.derived}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Interface Views Segment */}
                      {item.interface > 0 && (
                        <div
                          style={{
                            ...stackedBarStyles.barSegment,
                            width: `${interfaceWidth}%`,
                            backgroundColor: colors.errorLight,
                          }}
                          title={`Interface Views: ${item.interface.toLocaleString()}`}
                        >
                          {interfaceWidth > 4 && ( // Only show text if segment is wide enough
                            <span style={stackedBarStyles.segmentText}>
                              {item.interface}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const stackedBarStyles = {
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
    flexDirection: 'column',
    gap: spacing.sm, // Reduced from md
    marginBottom: spacing.md // Reduced from lg
  },
  
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm, // Reduced from md
    padding: spacing.xs, // Reduced from sm
    background: colors.white,
    borderRadius: borderRadius.sm, // Reduced from md
    border: `1px solid ${colors.gray100}`,
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: colors.gray50,
      borderColor: colors.gray200,
      transform: 'translateX(2px)'
    }
  },
  
  labelSection: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs, // Reduced from sm
    minWidth: '160px', // Reduced from 180px
    maxWidth: '160px' // Reduced from 180px
  },
  
  rankNumber: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px', // Reduced from 24px
    height: '20px', // Reduced from 24px
    backgroundColor: colors.primarySolid,
    color: colors.white,
    borderRadius: borderRadius.full,
    fontSize: '10px', // Reduced from 11px
    fontWeight: 600,
    flexShrink: 0
  },
  
  labelInfo: {
    flex: 1,
    minWidth: 0
  },
  
  label: {
    fontSize: '12px', // Reduced from 13px
    fontWeight: 600,
    color: colors.gray800,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  
  totalValue: {
    fontSize: '10px', // Reduced from 11px
    color: colors.gray600,
    fontWeight: 500,
    marginTop: '2px'
  },
  
  barSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  
  barContainer: {
    position: 'relative'
  },
  
  barBackground: {
    height: '24px', // Reduced from 28px
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.xs, // Reduced from sm
    overflow: 'hidden'
  },
  
  barWrapper: {
    display: 'flex',
    height: '100%',
    borderRadius: borderRadius.xs, // Reduced from sm
    overflow: 'hidden',
    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  barSegment: {
    height: '100%',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      filter: 'brightness(1.1)'
    }
  },
  
  segmentText: {
    color: colors.white,
    fontSize: '10px', // Reduced from 11px
    fontWeight: 600,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
    whiteSpace: 'nowrap',
    userSelect: 'none'
  },
  
  
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: spacing.md, // Reduced from lg
    padding: spacing.sm, // Reduced from md
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.sm, // Reduced from md
    border: `1px solid ${colors.gray200}`,
    marginBottom: spacing.sm // Added compact bottom margin
  },
  
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs
  },
  
  legendColor: {
    width: '10px', // Reduced from 12px
    height: '10px', // Reduced from 12px
    borderRadius: borderRadius.xs,
    flexShrink: 0
  },
  
  legendLabel: {
    fontSize: '11px', // Reduced from 12px
    fontWeight: 500,
    color: colors.gray700
  }
};

export default StackedHorizontalBar;