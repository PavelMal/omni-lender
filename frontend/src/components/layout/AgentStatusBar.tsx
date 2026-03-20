import { colors, spacing, fontSizes, radii } from '../../styles/tokens';
import { buttonStyle, cardStyle, badgeStyle } from '../../styles/common';
import { pulse as pulseAnim } from '../../styles/animations';

interface AgentStatusBarProps {
  isActive: boolean;
  onActivate: () => void;
  onPause: () => void;
  onCycle: () => void;
  onToggleAudit: () => void;
}

export function AgentStatusBar({
  isActive,
  onActivate,
  onPause,
  onCycle,
  onToggleAudit,
}: AgentStatusBarProps) {
  if (!isActive) {
    return (
      <div
        style={{
          ...cardStyle(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.lg,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span
            style={{
              fontSize: fontSizes.md,
              color: colors.textSecondary,
              fontWeight: 500,
            }}
          >
            Agent not active
          </span>
          <p
            style={{
              fontSize: fontSizes.sm,
              color: colors.textMuted,
              margin: 0,
              marginTop: spacing.xs,
              lineHeight: 1.5,
            }}
          >
            Activate the agent to begin autonomous treasury management, DeFi
            operations, and tipping.
          </p>
        </div>

        <button
          onClick={onActivate}
          style={{
            ...buttonStyle('primary'),
            padding: `${spacing.md}px ${spacing.xxl}px`,
            fontSize: fontSizes.lg,
            borderRadius: radii.md,
          }}
        >
          Activate Agent
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        ...cardStyle(colors.brand),
        display: 'flex',
        alignItems: 'center',
        gap: spacing.lg,
        flexWrap: 'wrap',
      }}
    >
      {/* Status indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {/* Green dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: colors.brand,
            boxShadow: `0 0 8px ${colors.brand}88`,
          }}
        />
        <span
          style={{
            ...badgeStyle(colors.brand),
            animation: `${pulseAnim} 2s ease-in-out infinite`,
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          ACTIVE
        </span>
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: spacing.sm,
          marginLeft: 'auto',
          flexWrap: 'wrap',
        }}
      >
        <button onClick={onPause} style={buttonStyle('secondary')}>
          Pause
        </button>
        <button onClick={onCycle} style={buttonStyle('primary')}>
          Run Cycle
        </button>
        <button onClick={onToggleAudit} style={buttonStyle('ghost')}>
          Audit Feed
        </button>
      </div>
    </div>
  );
}
