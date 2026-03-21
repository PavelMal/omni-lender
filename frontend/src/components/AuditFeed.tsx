import { useState, useRef, useCallback } from 'react';
import { useAuditStream } from '../hooks/useAuditStream';
import { API_BASE } from '../api';
import { colors, spacing, radii, fontSizes } from '../styles/tokens';

const PAGE_SIZE = 20;

// ---------- Lending event filter ----------

const LENDING_KEYWORDS = ['loan', 'negotiation', 'collateral', 'interest', 'liquidat', 'repay', 'credit'];

function isLendingEvent(e: any): boolean {
  if (e.module === 'wallet-os') return false;
  const action = (e.action ?? '').toLowerCase();
  if (action === 'wallet_initialized' || action === 'budgets_allocated') return false;
  return LENDING_KEYWORDS.some(kw => action.includes(kw)) || e.module === 'lending';
}

// ---------- Status colors ----------

function statusColor(status: string): string {
  switch (status) {
    case 'approved':
    case 'executed':
      return colors.success;
    case 'rejected':
    case 'failed':
      return colors.danger;
    default:
      return colors.textSecondary;
  }
}

// ---------- Human-readable labels ----------

const humanLabels: Record<string, string> = {
  loan_rejected: 'Loan rejected',
  loan_repaid: 'Loan repaid',
  loan_overdue: 'Loan overdue',
  collateral_loan_approved: 'Collateralized loan approved',
  collateral_loan_rejected: 'Collateralized loan rejected',
  collateral_returned: 'Collateral returned',
  collateral_liquidated: 'Collateral liquidated',
  interest_reinvested: 'Interest reinvested',
  negotiation_round: 'Negotiation round',
  negotiation_complete: 'Negotiation complete',
  credit_check: 'Credit check',
  spend_approved: 'Spend approved',
  spend_rejected: 'Spend rejected',
  transaction_executed: 'Transaction executed',
  funds_received: 'Funds received',
  defi_deposit: 'DeFi deposit',
  defi_withdraw: 'DeFi withdrawal',
  aave_supply: 'DeFi deposit (Aave V3)',
  erc4626_deposit: 'DeFi deposit (Vault)',
};

interface Props {
  ownerAddress: string;
}

function AuditEntry({ e }: { e: any }) {
  const [expanded, setExpanded] = useState(false);
  const isReal = e.txHash && !e.txHash.startsWith('0xsim');
  const isSim = e.txHash && e.txHash.startsWith('0xsim');
  const firstLine = (e.reasoning ?? '').split('\n')[0];
  const hasDetail = (e.reasoning ?? '').length > 120 || (e.reasoning ?? '').includes('\n\n');
  const sc = statusColor(e.status);

  return (
    <div style={{
      padding: `${spacing.sm}px 0`,
      borderBottom: `1px solid ${colors.border}`,
      fontSize: fontSizes.sm,
    }}>
      <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          width: 5, height: 5,
          borderRadius: radii.pill,
          background: sc,
          flexShrink: 0,
          opacity: 0.8,
        }} />
        <span style={{ color: sc, fontWeight: 600 }}>
          {humanLabels[e.action] ?? (e.action ?? '').replace(/_/g, ' ')}
        </span>
        {e.amount !== undefined && (
          <span style={{ color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
            ${e.amount} {e.asset ?? 'USDT'}
          </span>
        )}
        {isReal && (
          <a
            href={`https://sepolia.etherscan.io/tx/${e.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: fontSizes.xs,
              padding: '2px 8px',
              borderRadius: radii.sm,
              background: `${colors.accent}10`,
              border: `1px solid ${colors.accent}25`,
              color: colors.accent,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Etherscan
          </a>
        )}
        {isSim && (
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: radii.sm,
            background: `${colors.warning}10`,
            color: colors.warning,
          }}>
            simulated
          </span>
        )}
        <span style={{
          color: colors.textMuted,
          marginLeft: 'auto',
          fontSize: fontSizes.xs,
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {new Date(e.timestamp).toLocaleString()}
        </span>
      </div>
      {(e.reasoning ?? '') && (
        <div
          style={{
            color: colors.textMuted,
            fontSize: fontSizes.xs,
            marginTop: spacing.xs,
            marginLeft: spacing.lg,
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
              color: colors.textSecondary,
              fontSize: fontSizes.xs,
              lineHeight: 1.6,
            }}>
              {e.reasoning}
            </pre>
          )}
          {hasDetail && (
            <span style={{ color: colors.accent, fontSize: 10, marginLeft: 4, opacity: 0.7 }}>
              {expanded ? ' [collapse]' : ' [more]'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditFeed({ ownerAddress }: Props) {
  const { events, connected, clearEvents } = useAuditStream(ownerAddress);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter to lending-related events only
  const lendingEvents = events.filter(isLendingEvent);

  // Newest first
  const reversed = [...lendingEvents].reverse();
  const visible = reversed.slice(0, visibleCount);
  const hasMore = visibleCount < reversed.length;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  return (
    <div style={{
      marginTop: spacing.xl,
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: radii.lg,
      padding: spacing.xl,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
      }}>
        <h3 style={{
          fontSize: fontSizes.md,
          fontWeight: 600,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Lending Activity
        </h3>
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          {lendingEvents.length > 0 && (
            <>
              <span style={{ fontSize: fontSizes.xs, color: colors.textMuted }}>
                {visible.length} / {lendingEvents.length}
              </span>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  style={{
                    fontSize: fontSizes.xs,
                    padding: '3px 8px',
                    borderRadius: radii.sm,
                    background: 'transparent',
                    border: `1px solid ${colors.border}`,
                    color: colors.textMuted,
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
                  background: `${colors.danger}08`,
                  border: `1px solid ${colors.danger}20`,
                  borderRadius: radii.sm,
                  padding: `${spacing.xs}px ${spacing.md}px`,
                }}>
                  <span style={{ fontSize: fontSizes.xs, color: colors.danger }}>Delete all?</span>
                  <button
                    onClick={() => {
                      fetch(`${API_BASE}/api/agent/audit/${ownerAddress}`, { method: 'DELETE' })
                        .then(() => { clearEvents(); setConfirmClear(false); })
                        .catch(() => {});
                    }}
                    style={{
                      fontSize: fontSizes.xs,
                      padding: '2px 10px',
                      borderRadius: radii.sm,
                      background: colors.danger,
                      border: 'none',
                      color: '#000',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    style={{
                      fontSize: fontSizes.xs,
                      padding: '2px 10px',
                      borderRadius: radii.sm,
                      background: 'transparent',
                      border: `1px solid ${colors.border}`,
                      color: colors.textMuted,
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
            fontSize: fontSizes.xs,
            padding: '3px 8px',
            borderRadius: radii.pill,
            background: connected ? `${colors.accent}12` : `${colors.danger}12`,
            color: connected ? colors.accent : colors.danger,
          }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {lendingEvents.length === 0 ? (
        <p style={{ color: colors.textMuted, fontSize: fontSizes.sm }}>
          Waiting for lending events...
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
            <div style={{
              textAlign: 'center',
              padding: spacing.md,
              color: colors.textMuted,
              fontSize: fontSizes.xs,
            }}>
              Scroll for more...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
