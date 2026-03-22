import { useState, useRef, useEffect } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (isConnected && address) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing.sm,
            padding: `3px ${spacing.sm}px`,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            background: colors.bgCard,
            cursor: 'pointer',
          }}
        >
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
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: colors.bgCard,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            padding: spacing.xs,
            zIndex: 100,
            minWidth: 160,
          }}>
            <a
              href={`https://sepolia.etherscan.io/address/${address}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: `${spacing.xs}px ${spacing.sm}px`,
                fontSize: fontSizes.xs,
                fontFamily: fonts.mono,
                color: colors.textSecondary,
                textDecoration: 'none',
                letterSpacing: '0.05em',
              }}
            >
              VIEW ON ETHERSCAN
            </a>
            <button
              onClick={() => { disconnect(); setMenuOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: `${spacing.xs}px ${spacing.sm}px`,
                background: 'none', border: 'none',
                fontSize: fontSizes.xs,
                fontFamily: fonts.mono,
                color: colors.danger,
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              DISCONNECT
            </button>
          </div>
        )}
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
