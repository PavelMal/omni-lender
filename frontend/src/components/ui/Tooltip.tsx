import { useState, useRef } from 'react';
import { colors, radii, spacing, fontSizes } from '../../styles/tokens';

interface TooltipProps {
  text: string;
  children?: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `1px solid ${colors.borderLight}`,
            fontSize: 10,
            fontWeight: 700,
            color: colors.textMuted,
            cursor: 'help',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ?
        </span>
      )}

      {visible && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.bgCardHover,
            border: `1px solid ${colors.borderLight}`,
            borderRadius: radii.sm,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            fontSize: fontSizes.xs,
            color: colors.textSecondary,
            whiteSpace: 'nowrap',
            maxWidth: 260,
            lineHeight: 1.5,
            zIndex: 10000,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
