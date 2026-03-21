import { ConnectWallet } from '../components/ConnectWallet';
import { colors, spacing, fontSizes, fonts } from '../styles/tokens';

const ASCII_LOGO = `
 ██████  ███    ███ ███    ██ ██
██    ██ ████  ████ ████   ██ ██
██    ██ ██ ████ ██ ██ ██  ██ ██
██    ██ ██  ██  ██ ██  ██ ██ ██
 ██████  ██      ██ ██   ████ ██
`;

const SPECS = [
  { k: 'PROTOCOL',   v: 'COLLATERALIZED LENDING' },
  { k: 'ENGINE',     v: 'CLAUDE LLM + ON-CHAIN' },
  { k: 'COLLATERAL', v: 'ETH -> USDT ESCROW' },
  { k: 'NETWORK',    v: 'ETHEREUM SEPOLIA' },
  { k: 'TRUST',      v: '5-TIER GRADUATED SYSTEM' },
  { k: 'SETTLEMENT', v: 'USDT (ERC-20)' },
];

export function Landing() {
  return (
    <div style={{
      fontFamily: fonts.mono,
      color: colors.textPrimary,
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xxl,
    }}>
      {/* ASCII Art */}
      <pre style={{
        color: colors.accent,
        fontSize: 11,
        lineHeight: 1.2,
        textAlign: 'center',
        margin: 0,
        textShadow: `0 0 20px ${colors.accent}44`,
        userSelect: 'none',
      }}>
        {ASCII_LOGO}
      </pre>

      {/* Title line */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: fontSizes.xs,
          color: colors.accent,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          marginBottom: spacing.sm,
        }}>
          AUTONOMOUS AI LENDING AGENT
        </div>
        <div style={{
          fontSize: fontSizes.xs,
          color: colors.textMuted,
          letterSpacing: '0.15em',
        }}>
          v1.0.0 // MISSION CONTROL INTERFACE
        </div>
      </div>

      {/* Specs table */}
      <div style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 1,
        padding: spacing.md,
        minWidth: 360,
      }}>
        <div style={{
          fontSize: 9,
          color: colors.textMuted,
          letterSpacing: '0.1em',
          marginBottom: spacing.sm,
          paddingBottom: spacing.xs,
          borderBottom: `1px solid ${colors.border}`,
        }}>
          SYSTEM SPECIFICATION
        </div>
        {SPECS.map(s => (
          <div key={s.k} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: `3px 0`,
            fontSize: fontSizes.xs,
          }}>
            <span style={{ color: colors.textMuted }}>{s.k}</span>
            <span style={{ color: colors.textSecondary }}>{s.v}</span>
          </div>
        ))}
      </div>

      {/* Connect */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.sm }}>
        <ConnectWallet />
        <span style={{
          fontSize: 9,
          color: colors.textMuted,
          letterSpacing: '0.1em',
        }}>
          CONNECT METAMASK TO INITIALIZE
        </span>
      </div>

      {/* Scanline effect at bottom */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 1,
        background: `${colors.accent}08`,
        boxShadow: `0 0 40px 20px ${colors.accent}04`,
      }} />
    </div>
  );
}
