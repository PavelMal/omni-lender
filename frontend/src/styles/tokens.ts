// OmniLender — Terminal OS / Mission Control theme

export const colors = {
  // Primary palette
  accent: '#00ff88',        // phosphor green
  accentDim: '#00cc6a',     // dimmed green
  accentGlow: '#00ff8822',  // green glow

  success: '#00ff88',       // green
  danger: '#ff3333',        // red
  warning: '#ffb700',       // amber

  bgPrimary: '#000000',     // pure black
  bgCard: '#0a0a0a',        // near-black
  bgCardHover: '#111111',   // hover
  bgInset: '#060606',       // deeper black

  border: '#1a1a1a',        // dark border
  borderLight: '#333333',   // lighter border

  textPrimary: '#cccccc',   // light gray text
  textSecondary: '#666666', // mid gray
  textMuted: '#444444',     // muted

  // Legacy aliases for compatibility
  brand: '#00ff88',
  blue: '#00ff88',
  purple: '#666666',
  orange: '#ffb700',
  red: '#ff3333',
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
} as const;

export const radii = {
  sm: 1, md: 2, lg: 2, xl: 2, pill: 2,
} as const;

export const fontSizes = {
  xs: 10, sm: 11, md: 12, lg: 13, xl: 16, xxl: 22, hero: 32,
} as const;

export const fonts = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  body: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
} as const;
