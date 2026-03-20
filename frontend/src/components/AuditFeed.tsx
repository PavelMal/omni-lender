import { useState, useRef, useCallback } from 'react';
import { useAuditStream } from '../hooks/useAuditStream';
import { API_BASE } from '../api';

const PAGE_SIZE = 20;

const statusColors: Record<string, string> = {
  approved: '#00d4aa',
  executed: '#4488ff',
  rejected: '#ff4444',
  failed: '#ff4444',
  info: '#888',
};

const moduleIcons: Record<string, string> = {
  treasury: 'T',
  defi: 'D',
  lending: 'L',
  tipping: '$',
  'wallet-os': 'W',
};

const humanLabels: Record<string, string> = {
  wallet_initialized: 'Wallet initialized',
  budgets_allocated: 'Budgets allocated',
  spend_approved: 'Spend approved',
  spend_rejected: 'Spend rejected',
  transaction_executed: 'Transaction executed',
  funds_received: 'Funds received',
  loan_rejected: 'Loan rejected',
  loan_repaid: 'Loan repaid',
  loan_overdue: 'Loan overdue',
  collateral_loan_approved: 'Collateralized loan approved',
  collateral_loan_rejected: 'Collateralized loan rejected',
  collateral_returned: 'Collateral returned',
  collateral_liquidated: 'Collateral liquidated',
  tip_sent: 'Tip sent',
  tip_skipped: 'Tipping skipped (budget exhausted)',
  defi_deposit: 'DeFi deposit',
  defi_withdraw: 'DeFi withdrawal',
  rebalance: 'Portfolio rebalance',
  rebalance_hold: 'Portfolio — hold',
  rebalance_swap: 'Portfolio — swap',
  swap_executed: 'Portfolio — swapped',
  swap_failed: 'Portfolio swap failed',
  swap_start: 'Portfolio — swapping...',
  aave_supply: 'DeFi deposit (Aave V3)',
  aave_supply_failed: 'DeFi deposit failed (Aave)',
  erc4626_deposit: 'DeFi deposit (Vault)',
  erc4626_deposit_failed: 'DeFi deposit failed (Vault)',
  fallback_to_vault: 'DeFi — switching protocol',
  pool_skipped: 'DeFi — pool skipped',
  analyzing: 'Analyzing...',
  anomaly_detected: 'Anomaly detected',
};

interface Props {
  ownerAddress: string;
}

function AuditEntry({ e }: { e: any }) {
  const [expanded, setExpanded] = useState(false);
  const isReal = e.txHash && !e.txHash.startsWith('0xsim');
  const isSim = e.txHash && e.txHash.startsWith('0xsim');
  const firstLine = e.reasoning.split('\n')[0];
  const hasDetail = e.reasoning.length > 120 || e.reasoning.includes('\n\n');

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid #1a1a22',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          width: 22, height: 22,
          borderRadius: 4,
          background: '#222',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#888',
          flexShrink: 0,
        }}>
          {moduleIcons[e.module] ?? '?'}
        </span>
        <span style={{ color: statusColors[e.status] ?? '#888', fontWeight: 600 }}>
          {humanLabels[e.action] ?? e.action.replace(/_/g, ' ')}
        </span>
        {e.amount !== undefined && (
          <span style={{ color: '#e0e0e0' }}>${e.amount} {e.asset ?? 'USDT'}</span>
        )}
        {isReal && (
          <a
            href={`https://sepolia.etherscan.io/tx/${e.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#00d4aa18',
              border: '1px solid #00d4aa33',
              color: '#00d4aa',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            View on Etherscan
          </a>
        )}
        {isSim && (
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: '#ffaa0018',
            color: '#ffaa00',
          }}>
            simulated
          </span>
        )}
        <span style={{ color: '#444', marginLeft: 'auto', fontSize: 11, flexShrink: 0 }}>
          {new Date(e.timestamp).toLocaleString()}
        </span>
      </div>
      <div
        style={{
          color: '#666',
          fontSize: 12,
          marginTop: 6,
          marginLeft: 30,
          lineHeight: 1.6,
          cursor: hasDetail ? 'pointer' : 'default',
          wordBreak: 'break-word',
        }}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <span>{expanded ? '' : (firstLine.length > 120 ? firstLine.slice(0, 120) + '...' : firstLine)}</span>
        {expanded && (
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            margin: '4px 0 0',
            color: '#999',
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            {e.reasoning}
          </pre>
        )}
        {hasDetail && (
          <span style={{ color: '#4488ff', fontSize: 11, marginLeft: 4 }}>
            {expanded ? ' [collapse]' : ' [more]'}
          </span>
        )}
      </div>
    </div>
  );
}

export function AuditFeed({ ownerAddress }: Props) {
  const { events, connected, clearEvents } = useAuditStream(ownerAddress);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Newest first
  const reversed = [...events].reverse();
  const visible = reversed.slice(0, visibleCount);
  const hasMore = visibleCount < reversed.length;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    // Load more when scrolled near the bottom
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  return (
    <div style={{
      marginTop: 24,
      background: '#111118',
      border: '1px solid #222',
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16 }}>Live Audit Feed</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {events.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: '#555' }}>
                {visible.length} / {events.length}
              </span>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid #333',
                    color: '#666',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              ) : (
                <div style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  background: '#ff444412',
                  border: '1px solid #ff444433',
                  borderRadius: 8,
                  padding: '4px 10px',
                }}>
                  <span style={{ fontSize: 11, color: '#ff6666' }}>Delete all logs?</span>
                  <button
                    onClick={() => {
                          fetch(`${API_BASE}/api/agent/audit/${ownerAddress}`, { method: 'DELETE' })
                        .then(() => { clearEvents(); setConfirmClear(false); })
                        .catch(() => {});
                    }}
                    style={{
                      fontSize: 11,
                      padding: '2px 10px',
                      borderRadius: 4,
                      background: '#ff4444',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    style={{
                      fontSize: 11,
                      padding: '2px 10px',
                      borderRadius: 4,
                      background: 'transparent',
                      border: '1px solid #333',
                      color: '#888',
                      cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              )}
            </>
          )}
          <span style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 10,
            background: connected ? '#00d4aa22' : '#ff444422',
            color: connected ? '#00d4aa' : '#ff4444',
          }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <p style={{ color: '#555', fontSize: 13 }}>
          Waiting for agent actions...
        </p>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ maxHeight: 600, overflowY: 'auto' }}
        >
          {visible.map((e, i) => (
            <AuditEntry key={`${e.timestamp}-${i}`} e={e} />
          ))}
          {hasMore && (
            <div style={{ textAlign: 'center', padding: 12, color: '#555', fontSize: 12 }}>
              Scroll down for more...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
