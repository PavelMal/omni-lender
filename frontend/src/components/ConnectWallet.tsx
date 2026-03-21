import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { colors, spacing, radii, fontSizes, fonts } from '../styles/tokens';

const SEPOLIA_HEX = '0xaa36a7';

async function ensureSepolia(): Promise<boolean> {
  const eth = (window as any).ethereum;
  if (!eth) return false;
  try {
    await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: SEPOLIA_HEX, chainName: 'Sepolia Testnet', nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'], blockExplorerUrls: ['https://sepolia.etherscan.io'] }] });
  } catch {}
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_HEX }] });
    return true;
  } catch { return false; }
}

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.sm,
          padding: `3px ${spacing.sm}px`,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.sm,
          background: colors.bgCard,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: colors.accent,
            boxShadow: `0 0 6px ${colors.accent}`,
          }} />
          <span style={{
            color: colors.accent,
            fontSize: fontSizes.xs,
            fontFamily: fonts.mono,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          style={{
            padding: `3px ${spacing.sm}px`,
            borderRadius: radii.sm,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.textMuted,
            cursor: 'pointer',
            fontSize: fontSizes.xs,
            fontFamily: fonts.mono,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          DC
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={async () => {
        await ensureSepolia();
        const metamask = connectors.find(c => c.id === 'injected') ?? connectors[0];
        if (metamask) connect({ connector: metamask });
      }}
      style={{
        padding: `${spacing.sm}px ${spacing.xl}px`,
        borderRadius: radii.sm,
        border: `1px solid ${colors.accent}44`,
        background: colors.accent,
        color: '#000',
        cursor: 'pointer',
        fontSize: fontSizes.sm,
        fontWeight: 700,
        fontFamily: fonts.mono,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      CONNECT WALLET
    </button>
  );
}

export { ensureSepolia };
