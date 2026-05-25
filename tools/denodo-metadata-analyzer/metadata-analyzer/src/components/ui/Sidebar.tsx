'use client';

import React, { useState } from 'react';
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
import { colors, spacing, borderRadius, shadows, typography } from '../../lib/theme';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  view: string;
  disabled: boolean;
}

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onNewAnalysis: () => void;
  isAnalyzing: boolean;
  hasAnalysisData: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export default function Sidebar({
  currentView,
  onViewChange,
  onNewAnalysis,
  isAnalyzing,
  hasAnalysisData,
  onCollapseChange
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    if (onCollapseChange) {
      onCollapseChange(newCollapsed);
    }
  };

  const navigationItems: NavigationItem[] = [
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

  const NavItem = ({ item, isActive }: { item: NavigationItem; isActive: boolean }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const IconComponent = item.icon;

    return (
      <button
        style={{
          ...styles.navItem(isCollapsed),
          ...(isActive ? styles.navItemActive(isCollapsed) : {}),
          ...(item.disabled ? styles.navItemDisabled : {}),
          ...(isHovered && !item.disabled ? styles.navItemHover : {})
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
        <span style={styles.navLabel(isCollapsed)}>
          {item.label}
        </span>
        {isCollapsed && showTooltip && (
          <div style={styles.tooltip}>
            {item.label}
          </div>
        )}
      </button>
    );
  };

  return (
    <div style={styles.container(isCollapsed)}>
      {/* Header */}
      <div style={styles.header(isCollapsed)}>
        <button
          style={styles.collapseButton}
          onClick={handleCollapseToggle}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={styles.navigation}>
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
        <div style={styles.divider(isCollapsed)}></div>

        {/* New Analysis Button */}
        <button
          style={{
            ...styles.newAnalysisButton(isCollapsed),
            ...(isAnalyzing ? styles.newAnalysisButtonDisabled : {})
          }}
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
}

// Component styles using our modern theme system
const styles = {
  container: (isCollapsed: boolean) => ({
    width: isCollapsed ? '60px' : '240px',
    height: '100%',
    backgroundColor: colors.gray800,
    position: 'relative' as const,
    zIndex: 100,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column' as const,
    borderRight: `1px solid ${colors.gray700}`,
    boxShadow: shadows.lg,
    flexShrink: 0
  }),

  header: (isCollapsed: boolean) => ({
    padding: isCollapsed ? spacing.sm : `${spacing.sm} ${spacing.md}`,
    borderBottom: `1px solid ${colors.gray700}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: isCollapsed ? 'center' : 'space-between',
    minHeight: '48px'
  }),

  collapseButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    color: colors.gray300,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  navigation: {
    flex: 1,
    padding: `${spacing.md} 0`,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const
  },

  navItem: (isCollapsed: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: isCollapsed ? '0' : spacing.sm,
    padding: isCollapsed ? `${spacing.sm} ${spacing.md}` : `${spacing.sm} ${spacing.lg}`,
    margin: isCollapsed ? `2px ${spacing.xs}` : `2px ${spacing.sm}`,
    color: colors.gray400,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: borderRadius.sm,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left' as const,
    width: isCollapsed ? 'auto' : 'calc(100% - 16px)',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    position: 'relative' as const
  }),

  navItemActive: (isCollapsed: boolean) => ({
    backgroundColor: colors.accent + '20',
    color: colors.accentLight,
    borderLeft: isCollapsed ? 'none' : `2px solid ${colors.accent}`
  }),

  navItemHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: colors.gray200,
    transform: 'translateX(3px)'
  },

  navItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },

  navLabel: (isCollapsed: boolean) => ({
    overflow: 'hidden',
    whiteSpace: 'nowrap' as const,
    opacity: isCollapsed ? 0 : 1,
    transition: 'opacity 0.2s ease',
    fontSize: typography.fontSize.sm
  }),

  divider: (isCollapsed: boolean) => ({
    height: '1px',
    backgroundColor: colors.gray700,
    margin: `${spacing.sm} ${spacing.sm}`,
    opacity: isCollapsed ? 0 : 1,
    transition: 'opacity 0.2s ease'
  }),

  newAnalysisButton: (isCollapsed: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: isCollapsed ? '0' : spacing.xs,
    padding: isCollapsed ? spacing.sm : `${spacing.sm} ${spacing.md}`,
    margin: `${spacing.sm} ${spacing.sm}`,
    backgroundColor: colors.accent,
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.sm,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    justifyContent: isCollapsed ? 'center' : 'flex-start'
  }),

  newAnalysisButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    transform: 'none'
  },

  tooltip: {
    position: 'absolute' as const,
    left: '60px',
    backgroundColor: colors.gray700,
    color: colors.white,
    padding: `${spacing.xs} ${spacing.md}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    whiteSpace: 'nowrap' as const,
    zIndex: 1000,
    boxShadow: shadows.lg,
    opacity: 1,
    visibility: 'visible' as const,
    transition: 'all 0.2s ease',
    pointerEvents: 'none' as const
  }
};