// OmniLender — Industrial fintech dark theme

export const colors = {
  accent: '#34d399',       // emerald-400
  accentDim: '#059669',    // emerald-600

  success: '#4ade80',      // green-400
  danger: '#f87171',       // red-400
  warning: '#fbbf24',      // amber-400

  bgPrimary: '#09090b',    // zinc-950
  bgCard: '#18181b',       // zinc-900
  bgCardHover: '#27272a',  // zinc-800
  bgInset: '#0f0f12',

  border: '#27272a',       // zinc-800
  borderLight: '#3f3f46',  // zinc-700

  textPrimary: '#fafafa',  // zinc-50
  textSecondary: '#a1a1aa', // zinc-400
  textMuted: '#52525b',    // zinc-600

  // Legacy aliases
  brand: '#34d399',
  blue: '#34d399',
  purple: '#a1a1aa',
  orange: '#fbbf24',
  red: '#f87171',
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
} as const;

export const radii = {
  sm: 4, md: 8, lg: 12, xl: 16, pill: 999,
} as const;

export const fontSizes = {
  xs: 11, sm: 12, md: 13, lg: 15, xl: 20, xxl: 28, hero: 36,
} as const;

export const fonts = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;
