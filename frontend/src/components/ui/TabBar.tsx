import { colors, spacing, fontSizes } from '../../styles/tokens';

interface TabBarProps {
  tabs: Array<{ id: string; label: string; icon?: string }>;
  active: string;
  onChange: (id: string) => void;
}

export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <nav
      style={{
        display: 'flex',
        gap: spacing.xs,
        borderBottom: `1px solid ${colors.border}`,
        marginBottom: spacing.xxl,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: `${spacing.sm}px ${spacing.lg}px`,
              paddingBottom: spacing.md,
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? colors.brand : 'transparent'}`,
              color: isActive ? colors.textPrimary : colors.textSecondary,
              fontSize: fontSizes.md,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              marginBottom: -1,
            }}
          >
            {tab.icon && (
              <span style={{ fontSize: fontSizes.lg }}>{tab.icon}</span>
            )}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
