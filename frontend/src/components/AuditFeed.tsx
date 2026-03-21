import { useState, useRef, useCallback } from 'react';
import { useAuditStream } from '../hooks/useAuditStream';
import { API_BASE } from '../api';
import { colors, spacing, radii, fontSizes, fonts } from '../styles/tokens';

const PAGE_SIZE = 20;

const LENDING_KEYWORDS = ['loan', 'negotiation', 'collateral', 'interest', 'liquidat', 'repay', 'credit'];

function isLendingEvent(e: any): boolean {
  if (e.module === 'wallet-os') return false;
  const action = (e.action ?? '').toLowerCase();
  if (action === 'wallet_initialized' || action === 'budgets_allocated') return false;
  return LENDING_KEYWORDS.some(kw => action.includes(kw)) || e.module === 'lending';
}

function statusColor(status: string): string {
  switch (status) {
    case 'approved':
    case 'executed':
      return colors.accent;
    case 'rejected':
    case 'failed':
      return colors.danger;
    default:
      return colors.textSecondary;
  }
}

const humanLabels: Record<string, string> = {
  loan_rejected: 'LOAN_REJECTED',
  loan_repaid: 'LOAN_REPAID',
  loan_overdue: 'LOAN_OVERDUE',
  collateral_loan_approved: 'COLLATERAL_LOAN_APPROVED',
  collateral_loan_rejected: 'COLLATERAL_LOAN_REJECTED',
  collateral_returned: 'COLLATERAL_RETURNED',
  collateral_liquidated: 'COLLATERAL_LIQUIDATED',
  interest_reinvested: 'INTEREST_REINVESTED',
  negotiation_round: 'NEGOTIATION_ROUND',
  negotiation_complete: 'NEGOTIATION_COMPLETE',
  credit_check: 'CREDIT_CHECK',
  spend_approved: 'SPEND_APPROVED',
  spend_rejected: 'SPEND_REJECTED',
  transaction_executed: 'TX_EXECUTED',
  funds_received: 'FUNDS_RECEIVED',
  defi_deposit: 'DEFI_DEPOSIT',
  defi_withdraw: 'DEFI_WITHDRAWAL',
  aave_supply: 'DEFI_DEPOSIT_AAVE',
  erc4626_deposit: 'DEFI_DEPOSIT_VAULT',
};

interface Props {
  ownerAddress: string;
}

function AuditEntry({ e }: { e: any }) {
  const [expanded, setExpanded] = useState(false);
  const isReal = e.txHash && !e.txHash.startsWith('0xsim');
  const isSim = e.txHash && e.txHash.startsWith('0xsim');
  const firstLine = (e.reasoning ?? '').split('\n')[0];
  const hasDetail = (e.reasoning ?? '').length > 100 || (e.reasoning ?? '').includes('\n\n');
  const sc = statusColor(e.status);

  const ts = new Date(e.timestamp);
  const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = ts.toLocaleDateString([], { month: '2-digit', day: '2-digit' });

  return (
    <div style={{
      padding: `${spacing.sm}px 0`,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily: fonts.mono,
      fontSize: fontSizes.sm,
    }}>
      <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
        {/* Timestamp */}
        <span style={{
          color: colors.textMuted,
          fontSize: fontSizes.xs,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 90,
          flexShrink: 0,
        }}>
          {dateStr} {timeStr}
        </span>

        {/* Status dot */}
        <div style={{
          width: 6, height: 6,
          borderRadius: '50%',
          background: sc,
          boxShadow: `0 0 4px ${sc}66`,
          flexShrink: 0,
        }} />

        {/* Action label */}
        <span style={{
          color: sc,
          fontWeight: 600,
          fontSize: fontSizes.xs,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {humanLabels[e.action] ?? (e.action ?? '').replace(/_/g, '_').toUpperCase()}
        </span>

        {/* Amount */}
        {e.amount !== undefined && (
          <span style={{
            color: colors.textPrimary,
            fontVariantNumeric: 'tabular-nums',
            fontSize: fontSizes.xs,
          }}>
            ${e.amount} {e.asset ?? 'USDT'}
          </span>
        )}

        {/* TX links */}
        {isReal && (
          <a
            href={`https://sepolia.etherscan.io/tx/${e.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: radii.sm,
              border: `1px solid ${colors.accent}33`,
              color: colors.accent,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            TX
          </a>
        )}
        {isSim && (
          <span style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: radii.sm,
            border: `1px solid ${colors.warning}33`,
            color: colors.warning,
          }}>
            SIM
          </span>
        )}
      </div>

      {/* Reasoning */}
      {(e.reasoning ?? '') && (
        <div
          style={{
            color: colors.textMuted,
            fontSize: fontSizes.xs,
            marginTop: 3,
            marginLeft: 106,
            lineHeight: 1.5,
            cursor: hasDetail ? 'pointer' : 'default',
            wordBreak: 'break-word',
          }}
          onClick={() => hasDetail && setExpanded(!expanded)}
        >
          <span>{expanded ? '' : (firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine)}</span>
          {expanded && (
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontFamily: fonts.mono,
              margin: '2px 0 0',
              color: colors.textSecondary,
              fontSize: fontSizes.xs,
              lineHeight: 1.5,
            }}>
              {e.reasoning}
            </pre>
          )}
          {hasDetail && (
            <span style={{ color: colors.accent, fontSize: 9, marginLeft: 4, opacity: 0.6 }}>
              {expanded ? ' [-]' : ' [+]'}
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

  const lendingEvents = events.filter(isLendingEvent);
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
    <div style={{ fontFamily: fonts.mono }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <span style={{
            fontSize: fontSizes.xs,
            fontWeight: 600,
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            AUDIT LOG
          </span>
          <span style={{
            fontSize: fontSizes.xs,
            color: colors.textMuted,
          }}>
            [{lendingEvents.length}]
          </span>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          {lendingEvents.length > 0 && (
            <>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: radii.sm,
                    background: 'transparent',
                    border: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    cursor: 'pointer',
                    fontFamily: fonts.mono,
                    textTransform: 'uppercase',
                  }}
                >
                  CLR
                </button>
              ) : (
                <div style={{
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  <button
                    onClick={() => {
                      fetch(`${API_BASE}/api/agent/audit/${ownerAddress}`, { method: 'DELETE' })
                        .then(() => { clearEvents(); setConfirmClear(false); })
                        .catch(() => {});
                    }}
                    style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: radii.sm,
                      background: colors.danger, border: 'none',
                      color: '#000', cursor: 'pointer', fontWeight: 700, fontFamily: fonts.mono,
                    }}
                  >
                    CONFIRM
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: radii.sm,
                      background: 'transparent', border: `1px solid ${colors.border}`,
                      color: colors.textMuted, cursor: 'pointer', fontFamily: fonts.mono,
                    }}
                  >
                    NO
                  </button>
                </div>
              )}
            </>
          )}
          {/* Live indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 9, fontWeight: 600,
            color: connected ? colors.accent : colors.danger,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: connected ? colors.accent : colors.danger,
              boxShadow: connected ? `0 0 6px ${colors.accent}` : 'none',
              animation: connected ? 'termBlink 2s infinite' : 'none',
            }} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* Feed */}
      {lendingEvents.length === 0 ? (
        <div style={{
          color: colors.textMuted, fontSize: fontSizes.sm, padding: `${spacing.xl}px 0`,
          display: 'flex', alignItems: 'center', gap: spacing.sm,
        }}>
          <span>Awaiting events</span>
          <span style={{ animation: 'termBlink 1s step-end infinite' }}>_</span>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ maxHeight: 600, overflowY: 'auto' }}
        >
          {/* Blinking cursor at top */}
          <div style={{
            padding: `${spacing.xs}px 0`,
            color: colors.accent,
            fontSize: fontSizes.xs,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ animation: 'termBlink 1s step-end infinite', fontWeight: 700 }}>{'>'}</span>
            <span style={{ color: colors.textMuted }}>latest</span>
          </div>
          {visible.map((e, i) => (
            <AuditEntry key={`${e.timestamp}-${i}`} e={e} />
          ))}
          {hasMore && (
            <div style={{
              textAlign: 'center', padding: spacing.md,
              color: colors.textMuted, fontSize: fontSizes.xs,
            }}>
              ...scroll for more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
