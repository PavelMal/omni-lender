import { colors, spacing, radii, fontSizes } from '../styles/tokens';
import { cardStyle } from '../styles/common';
import { CreatorSearch } from '../components/CreatorSearch';

interface Props {
  ownerAddress: string;
}

export function TippingTab({ ownerAddress }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      {/* Explanation */}
      <div style={cardStyle()}>
        <h3 style={{
          fontSize: fontSizes.lg,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: spacing.md,
        }}>
          Creator Tipping
        </h3>
        <p style={{
          fontSize: fontSizes.md,
          color: colors.textSecondary,
          lineHeight: 1.7,
          marginBottom: spacing.md,
        }}>
          The tipping module allocates a portion of the agent's budget to support content creators
          on Rumble. Search for creators by topic or name, review their engagement metrics, and
          send USDT tips directly to their wallets. All tips are recorded on-chain and appear
          in the audit log.
        </p>
        <div style={{
          display: 'flex',
          gap: spacing.lg,
          flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              background: colors.brand,
            }} />
            <span style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
              Tips are drawn from the tipping budget
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              background: colors.blue,
            }} />
            <span style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
              Claude analyzes creator metrics and engagement
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              background: colors.purple,
            }} />
            <span style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
              All transactions are auditable on Sepolia
            </span>
          </div>
        </div>
      </div>

      {/* Creator search component */}
      <CreatorSearch ownerAddress={ownerAddress} />
    </div>
  );
}
