import type { CSSProperties } from 'react';
import { colors, radii, spacing, fontSizes, fonts } from './tokens';

export function cardStyle(accent?: string): CSSProperties {
  return {
    background: colors.bgCard,
    border: `1px solid ${accent ? accent + '33' : colors.border}`,
    borderRadius: radii.md,
    padding: spacing.lg,
    transition: 'border-color 0.15s',
  };
}

export function buttonStyle(
  variant: 'primary' | 'secondary' | 'danger' | 'ghost',
): CSSProperties {
  const base: CSSProperties = {
    padding: `${spacing.xs}px ${spacing.md}px`,
    borderRadius: radii.sm,
    fontSize: fontSizes.sm,
    fontWeight: 600,
    fontFamily: fonts.mono,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  switch (variant) {
    case 'primary':
      return {
        ...base,
        background: colors.accent,
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
        background: 'transparent',
        color: colors.danger,
        border: `1px solid ${colors.danger}44`,
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
    fontFamily: fonts.mono,
    color: colors.textPrimary,
    outline: 'none',
    transition: 'border-color 0.15s',
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
    fontFamily: fonts.mono,
    padding: `2px ${spacing.sm}px`,
    borderRadius: radii.sm,
    background: color + '15',
    color: color,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
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
