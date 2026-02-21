/**
 * PNPTV UI Kit - Unified Design System
 *
 * Main entry point for design system components and tokens.
 *
 * Usage:
 * 1. Import tokens.css in your main app file:
 *    import '@pnptv/ui-kit/src/tokens.css';
 *
 * 2. Use CSS variables in your components:
 *    color: var(--color-text-primary);
 *    background: var(--color-brand-prime);
 */

// Export nothing by default - components are co-located with their implementations
// This file serves as documentation for the design system

export const designTokens = {
  colors: {
    bg: {
      primary: '#0d0f14',
      secondary: '#1a1d24',
      tertiary: '#25282f',
      quaternary: '#2c2f38',
      surface: 'rgba(26, 29, 36, 0.8)',
      glass: 'rgba(26, 29, 36, 0.6)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b8bcc4',
      tertiary: '#7f8490',
      muted: '#5a6270',
      disabled: '#3d4150',
    },
    brand: {
      prime: '#ff3a7d',
      teal: '#2ce2c9',
      amber: '#ff9c38',
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
  },
  fonts: {
    body: 'Inter',
    display: 'Outfit',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '9999px',
  },
};
