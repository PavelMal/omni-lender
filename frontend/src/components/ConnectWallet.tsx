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
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <span style={{
          padding: `${spacing.xs}px ${spacing.md}px`,
          borderRadius: radii.sm,
          border: `1px solid ${colors.border}`,
          background: colors.bgCard,
          color: colors.textSecondary,
          fontSize: fontSizes.xs,
          fontFamily: fonts.mono,
        }}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          style={{
            padding: `${spacing.xs}px ${spacing.sm}px`,
            borderRadius: radii.sm,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.textMuted,
            cursor: 'pointer',
            fontSize: fontSizes.xs,
          }}
        >
          Disconnect
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
        border: 'none',
        background: colors.accent,
        color: '#000',
        cursor: 'pointer',
        fontSize: fontSizes.md,
        fontWeight: 700,
      }}
    >
      Connect Wallet
    </button>
  );
}

export { ensureSepolia };
