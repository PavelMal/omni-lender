import { colors, spacing, fontSizes } from '../../styles/tokens';
import { statCardStyle } from '../../styles/common';
import { Tooltip } from './Tooltip';
import { slideUp } from '../../styles/animations';

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  subtitle?: string;
  tooltip?: string;
}

export default function StatCard({
  label,
  value,
  color = colors.textPrimary,
  subtitle,
  tooltip,
}: StatCardProps) {
  return (
    <div
      style={{
        ...statCardStyle(),
        animation: `${slideUp} 0.3s ease`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <span
          style={{
            fontSize: fontSizes.xs,
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>

      <span
        style={{
          fontSize: fontSizes.xxl,
          fontWeight: 700,
          color,
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>

      {subtitle && (
        <span
          style={{
            fontSize: fontSizes.xs,
            color: colors.textMuted,
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}
