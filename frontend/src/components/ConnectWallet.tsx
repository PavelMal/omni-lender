import { useAccount, useConnect, useDisconnect, useBalance, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { sepolia } from 'wagmi/chains';
import { USDT_CONTRACT, USDT_ABI, USDT_DECIMALS } from '../wagmi';

const SEPOLIA_HEX = `0x${sepolia.id.toString(16)}`;

async function ensureSepolia(): Promise<boolean> {
  const eth = (window as any).ethereum;
  if (!eth) return false;

  const sepoliaParams = {
    chainId: SEPOLIA_HEX,
    chainName: 'Sepolia Testnet',
    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  };

  try {
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [sepoliaParams],
    });
  } catch {
    // Built-in chain — fine
  }

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_HEX }],
    });
    return true;
  } catch {
    return false;
  }
}

const pill: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #333',
  background: '#111118',
  color: '#ccc',
  fontSize: 13,
  fontWeight: 600,
};

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ethBalance } = useBalance({ address });
  const { data: usdtRaw } = useReadContract({
    address: USDT_CONTRACT,
    abi: USDT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const ethStr = ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0';
  const usdtStr = usdtRaw != null ? Number(formatUnits(usdtRaw as bigint, USDT_DECIMALS)).toFixed(2) : '0';

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={pill}>
          {ethStr} ETH
        </span>
        <span style={{ ...pill, color: '#00d4aa', borderColor: '#00d4aa44' }}>
          {usdtStr} USDT
        </span>
        <span style={pill}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #ff444466',
            background: 'transparent',
            color: '#ff6666',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
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
        padding: '10px 24px',
        borderRadius: 10,
        border: 'none',
        background: '#00d4aa',
        color: '#000',
        cursor: 'pointer',
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      Connect MetaMask
    </button>
  );
}

export { ensureSepolia };
