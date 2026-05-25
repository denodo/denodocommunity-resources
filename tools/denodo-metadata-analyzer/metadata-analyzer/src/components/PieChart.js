import React from 'react';
import { colors } from '../styles/theme';

const PieChart = ({ data, size = 200, strokeWidth = 2 }) => {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  
  let currentAngle = -90; // Start at top

  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const sliceAngle = (item.value / total) * 360;
    
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    
    currentAngle = endAngle;
    
    // Convert angles to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Calculate arc coordinates
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    // Large arc flag
    const largeArcFlag = sliceAngle > 180 ? 1 : 0;
    
    // Create the path for the slice
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    return {
      ...item,
      pathData,
      percentage: percentage.toFixed(1),
      startAngle,
      endAngle
    };
  });

  return (
    <div style={pieChartStyles.container}>
      <div style={pieChartStyles.chartWrapper}>
        <svg width={size} height={size} style={pieChartStyles.svg}>
          {slices.map((slice, index) => (
            <path
              key={index}
              d={slice.pathData}
              fill={slice.color}
              stroke="#ffffff"
              strokeWidth={strokeWidth}
              style={{
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
            />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div style={pieChartStyles.legend}>
        {data.map((item, index) => (
          <div key={index} style={pieChartStyles.legendItem}>
            <div
              style={{
                ...pieChartStyles.legendColor,
                backgroundColor: item.color
              }}
            />
            <span style={pieChartStyles.legendLabel}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const pieChartStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between', // Distribute space between pie chart and legend
    gap: '32px', // Increased gap for better separation
    width: '100%',
    height: '100%', // Fill available height
    padding: '20px' // Add padding on all sides
  },
  
  chartWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: '0 0 auto' // Don't grow or shrink
  },

  svg: {
    flexShrink: 0,
    filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.08))' // Reduced shadow
  },

  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px', // Increased gap for better spacing
    flex: '1',
    alignItems: 'flex-start', // Align legend items to start
    justifyContent: 'center', // Center vertically within legend space
    paddingLeft: '10px' // Add some left padding
  },

  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px', // Reduced from 12px
    padding: '4px 0', // Reduced from 8px
    fontSize: '13px' // Reduced from 14px
  },
  
  legendColor: {
    width: '12px', // Reduced from 16px
    height: '12px', // Reduced from 16px
    borderRadius: '2px', // Reduced from 3px
    flexShrink: 0
  },
  
  legendLabel: {
    fontWeight: 500,
    color: colors.gray700
  }
};

export default PieChart;