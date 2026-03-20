import { useState } from 'react';
import { colors, spacing, fontSizes, radii } from '../../styles/tokens';
import { buttonStyle, badgeStyle } from '../../styles/common';
import { slideInFromBottom, fadeIn } from '../../styles/animations';
import { AuditFeed } from '../AuditFeed';

const MODULE_FILTERS = ['All', 'Treasury', 'DeFi', 'Lending', 'Tipping'] as const;

interface AuditDrawerProps {
  ownerAddress: string;
  open: boolean;
  onToggle: () => void;
  newCount?: number;
}

export function AuditDrawer({
  ownerAddress,
  open,
  onToggle,
  newCount = 0,
}: AuditDrawerProps) {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  return (
    <>
      {/* Fixed toggle button at bottom */}
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          bottom: open ? 450 : 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: `${spacing.sm}px ${spacing.xl}px`,
          background: colors.bgCard,
          border: `1px solid ${colors.borderLight}`,
          borderBottom: open ? 'none' : `1px solid ${colors.borderLight}`,
          borderRadius: open
            ? `${radii.md}px ${radii.md}px 0 0`
            : `${radii.md}px ${radii.md}px 0 0`,
          color: colors.textPrimary,
          fontSize: fontSizes.sm,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          transition: 'bottom 0.4s ease-out',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}
      >
        Audit Feed
        {newCount > 0 && (
          <span style={badgeStyle(colors.brand)}>
            {newCount} new
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            color: colors.textMuted,
            marginLeft: spacing.xs,
          }}
        >
          {open ? 'v' : '^'}
        </span>
      </button>

      {/* Slide-up panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 450,
            zIndex: 999,
            background: colors.bgPrimary,
            borderTop: `1px solid ${colors.borderLight}`,
            animation: `${slideInFromBottom} 0.4s ease-out`,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Filter chips */}
          <div
            style={{
              display: 'flex',
              gap: spacing.sm,
              padding: `${spacing.md}px ${spacing.xl}px`,
              borderBottom: `1px solid ${colors.border}`,
              animation: `${fadeIn} 0.3s ease`,
            }}
          >
            {MODULE_FILTERS.map((filter) => {
              const isActive = filter === activeFilter;
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  style={{
                    padding: `${spacing.xs}px ${spacing.md}px`,
                    borderRadius: radii.pill,
                    border: `1px solid ${isActive ? colors.brand + '55' : colors.border}`,
                    background: isActive ? colors.brand + '18' : 'transparent',
                    color: isActive ? colors.brand : colors.textSecondary,
                    fontSize: fontSizes.xs,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {filter}
                </button>
              );
            })}
          </div>

          {/* Audit feed content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: `0 ${spacing.xl}px ${spacing.xl}px`,
            }}
          >
            <AuditFeed ownerAddress={ownerAddress} />
          </div>
        </div>
      )}
    </>
  );
}
