/**
 * Design System & Theme Configuration for Next.js
 * Modern gradient-based theme with consistent spacing and typography
 */

// Professional Color Palette - Tech Company Grade
export const colors = {
  // Primary brand colors (Professional Blue/Navy)
  primary: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', // Slate dark to medium
  primaryHover: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', // Darker slate
  primarySolid: '#1e293b',
  primaryLight: '#334155',

  // Secondary accents (Professional Blue)
  accent: '#3b82f6', // Blue-500
  accentHover: '#2563eb', // Blue-600
  accentLight: '#60a5fa', // Blue-400

  // Database/Data colors (Sophisticated teal/emerald)
  database: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', // Teal-700 to teal-500
  databaseHover: 'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)',
  databaseSolid: '#0f766e',

  // View colors (Professional differentiated)
  baseView: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', // Emerald-600 to emerald-500
  derivedView: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', // Violet-600 to violet-500
  interfaceView: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', // Red-600 to red-500

  // Status colors (Professional system colors)
  success: '#059669', // Emerald-600
  successLight: '#10b981', // Emerald-500
  warning: '#d97706', // Amber-600
  warningLight: '#f59e0b', // Amber-500
  error: '#dc2626', // Red-600
  errorLight: '#ef4444', // Red-500
  info: '#2563eb', // Blue-600
  infoLight: '#3b82f6', // Blue-500

  // Cache colors (Professional status system)
  cacheEnabled: '#059669', // Emerald-600
  cachePartial: '#d97706', // Amber-600
  cacheDisabled: '#64748b', // Slate-500

  // Professional neutral palette
  white: '#ffffff',
  gray25: '#fefefe',
  gray50: '#f8fafc', // Slate-50
  gray100: '#f1f5f9', // Slate-100
  gray200: '#e2e8f0', // Slate-200
  gray300: '#cbd5e1', // Slate-300
  gray400: '#94a3b8', // Slate-400
  gray500: '#64748b', // Slate-500
  gray600: '#475569', // Slate-600
  gray700: '#334155', // Slate-700
  gray800: '#1e293b', // Slate-800
  gray900: '#0f172a', // Slate-900
};

// Spacing system (8px grid)
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  xxxl: '64px',
};

// Border radius system
export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

// Typography system
export const typography = {
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
};

// Shadow system
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

// Animation system
export const animation = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  ease: {
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// Breakpoints for responsive design
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Component styles
export const styles = {
  card: {
    background: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.md,
    border: `1px solid ${colors.gray200}`,
    padding: spacing.lg,
  },

  button: {
    primary: {
      background: colors.primary,
      color: colors.white,
      border: 'none',
      borderRadius: borderRadius.md,
      padding: `${spacing.sm} ${spacing.lg}`,
      fontWeight: typography.fontWeight.medium,
      cursor: 'pointer',
      transition: `all ${animation.duration.normal} ${animation.ease.inOut}`,
    },

    secondary: {
      background: colors.white,
      color: colors.primarySolid,
      border: `1px solid ${colors.gray300}`,
      borderRadius: borderRadius.md,
      padding: `${spacing.sm} ${spacing.lg}`,
      fontWeight: typography.fontWeight.medium,
      cursor: 'pointer',
      transition: `all ${animation.duration.normal} ${animation.ease.inOut}`,
    },
  },

  input: {
    background: colors.white,
    border: `1px solid ${colors.gray300}`,
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.fontSize.base,
    transition: `all ${animation.duration.normal} ${animation.ease.inOut}`,
  },
};