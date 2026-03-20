// Design tokens for OmniAgent dark theme

export const colors = {
  brand: '#00d4aa',
  purple: '#aa44ff',
  blue: '#4488ff',
  orange: '#ffaa00',
  red: '#ff4444',

  bgPrimary: '#0a0a0f',
  bgCard: '#111118',
  bgCardHover: '#161620',
  bgInset: '#0a0a12',

  border: '#1a1a2e',
  borderLight: '#2a2a3e',

  textPrimary: '#e0e0e0',
  textSecondary: '#888',
  textMuted: '#555',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 16,
  xl: 20,
  xxl: 28,
  hero: 36,
} as const;
