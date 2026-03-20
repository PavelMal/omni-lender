import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { colors, spacing, fontSizes, radii } from '../../styles/tokens';
import { buttonStyle, badgeStyle } from '../../styles/common';

const USDT_SEPOLIA = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0' as const;

export function Header() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const { data: ethBalance } = useBalance({
    address,
    chainId: sepolia.id,
  });

  const { data: usdtBalance } = useBalance({
    address,
    token: USDT_SEPOLIA,
    chainId: sepolia.id,
  });

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const formatBal = (val: bigint | undefined, decimals: number) => {
    if (val === undefined) return '--';
    const num = Number(val) / 10 ** decimals;
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${spacing.lg}px 0`,
        borderBottom: `1px solid ${colors.border}`,
        marginBottom: spacing.xxl,
      }}
    >
      {/* Left: branding */}
      <div>
        <h1
          style={{
            fontSize: fontSizes.xxl,
            fontWeight: 700,
            color: colors.brand,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          OmniAgent
        </h1>
        <p
          style={{
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
            margin: 0,
            marginTop: 2,
          }}
        >
          Autonomous AI Economic Agent
        </p>
      </div>

      {/* Right: account info */}
      {isConnected && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.md,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <span style={badgeStyle(colors.purple)}>Sepolia</span>

          <span
            style={{
              fontSize: fontSizes.sm,
              color: colors.textSecondary,
            }}
          >
            {formatBal(ethBalance?.value, ethBalance?.decimals ?? 18)} ETH
          </span>

          <span
            style={{
              fontSize: fontSizes.sm,
              color: colors.textSecondary,
            }}
          >
            {formatBal(usdtBalance?.value, usdtBalance?.decimals ?? 6)} USDT
          </span>

          <span
            style={{
              fontSize: fontSizes.xs,
              fontFamily: 'monospace',
              color: colors.textMuted,
              background: colors.bgInset,
              padding: `3px ${spacing.sm}px`,
              borderRadius: radii.sm,
              border: `1px solid ${colors.border}`,
            }}
          >
            {shortAddr}
          </span>

          <button
            onClick={() => disconnect()}
            style={buttonStyle('ghost')}
          >
            Disconnect
          </button>
        </div>
      )}
    </header>
  );
}
