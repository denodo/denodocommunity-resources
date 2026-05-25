import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Monitor, 
  AlertTriangle, 
  Database, 
  TrendingUp, 
  Settings, 
  Upload,
  ChevronLeft,
  ChevronRight,
  Home
} from 'lucide-react';

const Sidebar = ({ currentView, onViewChange, onNewAnalysis, isAnalyzing, hasAnalysisData, onCollapseChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    if (onCollapseChange) {
      onCollapseChange(newCollapsed);
    }
  };

  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      view: 'dashboard',
      disabled: !hasAnalysisData
    },
    {
      id: 'vdb-breakdown',
      label: 'VDB Breakdown',
      icon: Database,
      view: 'vdb-breakdown',
      disabled: !hasAnalysisData
    },
    {
      id: 'global-stats',
      label: 'Global Stats',
      icon: Monitor,
      view: 'global-stats',
      disabled: !hasAnalysisData
    },
    {
      id: 'duplicates',
      label: 'Duplicates',
      icon: AlertTriangle,
      view: 'duplicates',
      disabled: !hasAnalysisData
    },
    {
      id: 'datasource-breakdown',
      label: 'Data Sources',
      icon: Database,
      view: 'datasource-breakdown',
      disabled: !hasAnalysisData
    },
    {
      id: 'view-complexity',
      label: 'View Complexity',
      icon: TrendingUp,
      view: 'view-complexity',
      disabled: !hasAnalysisData
    },
    {
      id: 'server-config',
      label: 'Server Config',
      icon: Settings,
      view: 'server-config',
      disabled: !hasAnalysisData
    }
  ];

  const sidebarWidth = isCollapsed ? '60px' : '240px';

  const sidebarStyles = {
    container: {
      width: sidebarWidth,
      height: '100vh',
      background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
      position: 'relative',
      zIndex: 100,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #334155',
      boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)'
    },
    
    header: {
      padding: isCollapsed ? '8px 4px' : '8px 12px', // Further reduced padding
      borderBottom: '1px solid #334155',
      display: 'flex',
      alignItems: 'center',
      justifyContent: isCollapsed ? 'center' : 'space-between',
      minHeight: '48px' // Further reduced from 56px
    },
    
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: isCollapsed ? '0' : '8px', // Further reduced from 10px
      color: '#ffffff',
      fontSize: isCollapsed ? '0' : '15px', // Further reduced from 16px
      fontWeight: 600,
      overflow: 'hidden',
      whiteSpace: 'nowrap'
    },
    
    collapseButton: {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '3px', // Further reduced from 4px
      padding: '4px', // Further reduced from 6px
      color: '#cbd5e1',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ':hover': {
        background: 'rgba(255, 255, 255, 0.2)',
        color: '#ffffff'
      }
    },
    
    navigation: {
      flex: 1,
      padding: '12px 0', // Further reduced from 16px
      overflowY: 'auto',
      overflowX: 'hidden'
    },
    
    navItem: {
      display: 'flex',
      alignItems: 'center',
      gap: isCollapsed ? '0' : '8px', // Further reduced from 10px
      padding: isCollapsed ? '8px 12px' : '8px 14px', // Further reduced heights
      margin: isCollapsed ? '2px 4px' : '2px 8px', // Further reduced margins
      color: '#94a3b8',
      background: 'transparent',
      border: 'none',
      borderRadius: '4px', // Further reduced from 6px
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '12px', // Further reduced from 13px
      fontWeight: 500,
      textAlign: 'left',
      width: isCollapsed ? 'auto' : 'calc(100% - 16px)', // Further reduced from 20px
      justifyContent: isCollapsed ? 'center' : 'flex-start',
      position: 'relative'
    },
    
    navItemActive: {
      background: 'rgba(59, 130, 246, 0.15)',
      color: '#60a5fa',
      borderLeft: isCollapsed ? 'none' : '2px solid #3b82f6' // Reduced from 3px
    },
    
    navItemHover: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#e2e8f0',
      transform: 'translateX(3px)' // Reduced from 4px
    },
    
    navItemDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    
    navLabel: {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      opacity: isCollapsed ? 0 : 1,
      transition: 'opacity 0.2s ease',
      fontSize: '12px' // Further reduced from 13px
    },
    
    divider: {
      height: '1px',
      background: '#334155',
      margin: '8px 8px', // Further reduced from 12px/10px
      opacity: isCollapsed ? 0 : 1,
      transition: 'opacity 0.2s ease'
    },
    
    newAnalysisButton: {
      display: 'flex',
      alignItems: 'center',
      gap: isCollapsed ? '0' : '4px', // Further reduced from 6px
      padding: isCollapsed ? '8px' : '8px 12px', // Further reduced from 10px/16px
      margin: '8px 8px', // Further reduced from 12px/10px
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '4px', // Further reduced from 6px
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '12px', // Further reduced from 13px
      fontWeight: 600,
      justifyContent: isCollapsed ? 'center' : 'flex-start',
      ':hover': {
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        transform: 'translateY(-1px)'
      },
      ':disabled': {
        opacity: 0.6,
        cursor: 'not-allowed',
        transform: 'none'
      }
    },
    
    tooltip: {
      position: 'absolute',
      left: '60px',
      background: '#374151',
      color: '#ffffff',
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      zIndex: 1000,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      opacity: 0,
      visibility: 'hidden',
      transition: 'all 0.2s ease',
      pointerEvents: 'none'
    },
    
    tooltipVisible: {
      opacity: 1,
      visibility: 'visible'
    },
    
  };

  const NavItem = ({ item, isActive }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const IconComponent = item.icon;
    
    return (
      <button
        style={{
          ...sidebarStyles.navItem,
          ...(isActive ? sidebarStyles.navItemActive : {}),
          ...(item.disabled ? sidebarStyles.navItemDisabled : {}),
          ...(isHovered && !item.disabled ? sidebarStyles.navItemHover : {})
        }}
        onClick={() => !item.disabled && onViewChange(item.view)}
        disabled={item.disabled}
        onMouseEnter={() => {
          setIsHovered(true);
          if (isCollapsed) setShowTooltip(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowTooltip(false);
        }}
        title={isCollapsed ? item.label : ''}
      >
        <IconComponent size={18} />
        <span style={sidebarStyles.navLabel}>
          {item.label}
        </span>
        {isCollapsed && showTooltip && (
          <div style={{
            ...sidebarStyles.tooltip,
            ...sidebarStyles.tooltipVisible
          }}>
            {item.label}
          </div>
        )}
      </button>
    );
  };

  return (
    <div style={sidebarStyles.container}>
        {/* Header */}
        <div style={sidebarStyles.header}>
        
        <button
          style={sidebarStyles.collapseButton}
          onClick={handleCollapseToggle}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={sidebarStyles.navigation}>
        {navigationItems.map((item) => {
          const isActive = currentView === item.view;
          
          return (
            <NavItem
              key={item.id}
              item={item}
              isActive={isActive}
            />
          );
        })}
        
        {/* Divider */}
        <div style={sidebarStyles.divider}></div>
        
        {/* New Analysis Button */}
        <button
          style={sidebarStyles.newAnalysisButton}
          onClick={onNewAnalysis}
          disabled={isAnalyzing}
          title={isCollapsed ? 'New Analysis' : ''}
        >
          <Upload size={18} />
          {!isCollapsed && <span>New Analysis</span>}
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;