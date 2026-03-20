import type { CSSProperties } from 'react';
import { colors, radii, spacing, fontSizes } from './tokens';

export function cardStyle(accent?: string): CSSProperties {
  return {
    background: colors.bgCard,
    border: `1px solid ${accent ? accent + '33' : colors.border}`,
    borderRadius: radii.lg,
    padding: spacing.xl,
    transition: 'border-color 0.2s ease, background 0.2s ease',
  };
}

export function buttonStyle(
  variant: 'primary' | 'secondary' | 'danger' | 'ghost',
): CSSProperties {
  const base: CSSProperties = {
    padding: `${spacing.sm}px ${spacing.lg}px`,
    borderRadius: radii.sm,
    fontSize: fontSizes.md,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };

  switch (variant) {
    case 'primary':
      return {
        ...base,
        background: colors.brand,
        color: '#000',
        border: 'none',
        fontWeight: 700,
      };
    case 'secondary':
      return {
        ...base,
        background: 'transparent',
        color: colors.textPrimary,
        border: `1px solid ${colors.borderLight}`,
      };
    case 'danger':
      return {
        ...base,
        background: colors.red,
        color: '#fff',
        border: 'none',
        fontWeight: 700,
      };
    case 'ghost':
      return {
        ...base,
        background: 'transparent',
        color: colors.textSecondary,
        border: '1px solid transparent',
        padding: `${spacing.xs}px ${spacing.sm}px`,
      };
  }
}

export function inputStyle(): CSSProperties {
  return {
    background: colors.bgInset,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.sm,
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    outline: 'none',
    transition: 'border-color 0.2s ease',
    width: '100%',
  };
}

export function badgeStyle(color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    fontSize: fontSizes.xs,
    fontWeight: 600,
    padding: `3px ${spacing.sm}px`,
    borderRadius: radii.pill,
    background: color + '18',
    color: color,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  };
}

export function statCardStyle(): CSSProperties {
  return {
    ...cardStyle(),
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    minWidth: 0,
  };
}
