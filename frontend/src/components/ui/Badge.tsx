import { colors } from '../../styles/tokens';
import { badgeStyle } from '../../styles/common';
import { pulse } from '../../styles/animations';

interface BadgeProps {
  label: string;
  color?: string;
  pulse?: boolean;
}

export function Badge({
  label,
  color = colors.brand,
  pulse: shouldPulse = false,
}: BadgeProps) {
  return (
    <span
      style={{
        ...badgeStyle(color),
        animation: shouldPulse ? `${pulse} 2s ease-in-out infinite` : undefined,
      }}
    >
      {label}
    </span>
  );
}
