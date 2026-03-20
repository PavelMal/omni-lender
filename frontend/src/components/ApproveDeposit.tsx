import { useState, useEffect } from 'react';
import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { USDT_CONTRACT, USDT_ABI, USDT_DECIMALS, API_BASE } from '../wagmi';
import { ensureSepolia } from './ConnectWallet';

const cardStyle: React.CSSProperties = {
  background: '#111118',
  border: '1px solid #222',
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #333',
  borderRadius: 8,
  background: '#0a0a0f',
  color: '#e0e0e0',
  fontSize: 16,
  marginBottom: 12,
};

const btnStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 24px',
  border: 'none',
  borderRadius: 8,
  background: active ? '#00d4aa' : '#333',
  color: active ? '#000' : '#666',
  cursor: active ? 'pointer' : 'not-allowed',
  fontWeight: 600,
  fontSize: 14,
});

interface Props {
  ownerAddress: string;
  onAgentReady: (operatorAddr: string) => void;
}

export function ApproveDeposit({ ownerAddress, onAgentReady }: Props) {
  const [amount, setAmount] = useState('100');
  const [operatorAddress, setOperatorAddress] = useState<string | null>(null);
  const [step, setStep] = useState<'init' | 'approve' | 'done'>('init');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Connect to backend — get operator address
  useEffect(() => {
    if (!ownerAddress || operatorAddress) return;

    fetch(`${API_BASE}/agent/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerAddress }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.operatorAddress) {
          setOperatorAddress(data.operatorAddress);
          setStep('approve');
        }
      })
      .catch(err => setError(String(err)));
  }, [ownerAddress, operatorAddress]);

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDT_CONTRACT,
    abi: USDT_ABI,
    functionName: 'allowance',
    args: operatorAddress ? [ownerAddress as `0x${string}`, operatorAddress as `0x${string}`] : undefined,
  });

  // Write: approve
  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // When approve/revoke confirms
  useEffect(() => {
    if (approveConfirmed && operatorAddress) {
      refetchAllowance().then(({ data }) => {
        const val = data ? Number(formatUnits(data as bigint, USDT_DECIMALS)) : 0;
        if (val > 0) {
          setStep('done');
          onAgentReady(operatorAddress);
        } else {
          setStep('approve');
        }
      });
      setLoading(false);
    }
  }, [approveConfirmed, operatorAddress, refetchAllowance, onAgentReady]);

  // Check if already approved
  useEffect(() => {
    if (allowance && Number(allowance) > 0 && step === 'approve' && operatorAddress) {
      setStep('done');
      onAgentReady(operatorAddress);
    }
  }, [allowance, step, operatorAddress, onAgentReady]);

  const handleApprove = async () => {
    if (!operatorAddress) return;
    setLoading(true);
    setError('');
    const switched = await ensureSepolia();
    if (!switched) {
      setError('Please switch MetaMask to Sepolia network');
      setLoading(false);
      return;
    }
    approve({
      address: USDT_CONTRACT,
      abi: USDT_ABI,
      functionName: 'approve',
      args: [operatorAddress as `0x${string}`, parseUnits(amount, USDT_DECIMALS)],
    });
  };

  const currentAllowance = allowance ? Number(formatUnits(allowance as bigint, USDT_DECIMALS)) : 0;

  if (step === 'init') {
    return (
      <div style={cardStyle}>
        <p style={{ color: '#888' }}>Connecting to agent...</p>
      </div>
    );
  }

  const handleRevoke = async () => {
    if (!operatorAddress) return;
    setLoading(true);
    setError('');
    await ensureSepolia();
    approve({
      address: USDT_CONTRACT,
      abi: USDT_ABI,
      functionName: 'approve',
      args: [operatorAddress as `0x${string}`, BigInt(0)],
    });
  };

  if (step === 'done') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: '#00d4aa', marginBottom: 8 }}>USDT delegated!</h3>
            <p style={{ fontSize: 13, color: '#888' }}>
              Allowance: <b>{currentAllowance} USDT</b> — agent operates within this budget.
            </p>
            <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
              Your funds stay in your wallet. The agent uses transferFrom when needed.
            </p>
          </div>
          <button
            onClick={handleRevoke}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #ff444466',
              background: 'transparent',
              color: '#ff6666',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Revoking...' : 'Revoke'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ marginBottom: 16, fontSize: 18 }}>
        Delegate USDT to Agent
      </h3>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
        Approve how much USDT the agent can manage. Funds stay in your wallet.
      </p>

      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount (USDT)"
        style={inputStyle}
      />

      {error && <p style={{ color: '#ff4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button
        onClick={handleApprove}
        disabled={loading || !amount}
        style={btnStyle(!loading && !!amount)}
      >
        {loading ? 'Approving...' : `Approve ${amount} USDT`}
      </button>
    </div>
  );
}
