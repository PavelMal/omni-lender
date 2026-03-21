import { useState, useEffect } from 'react';
import { useWriteContract, useAccount } from 'wagmi';
import { AgentStatus } from '../hooks/useAgent';
import { API_BASE } from '../api';
import { USDT_CONTRACT, USDT_ABI } from '../wagmi';
import { colors, spacing, radii, fontSizes, fonts } from '../styles/tokens';

interface Props {
  status: AgentStatus | null;
  ownerAddress: string;
  lendingStats: any;
  onShowAudit?: () => void;
}

const LK = ['loan', 'negotiation', 'collateral', 'interest', 'liquidat', 'repay', 'credit'];
function isLending(e: any): boolean {
  const a = (e.action ?? '').toLowerCase();
  return (LK.some(k => a.includes(k)) || e.module === 'lending') && a !== 'wallet_initialized' && a !== 'budgets_allocated';
}

const TIERS = ['NEW', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
const TIER_PCT = [150, 120, 80, 50, 0];
const TIER_COLORS = [colors.textMuted, '#cd7f32', '#aaa', '#ffd700', colors.accent];

export function OverviewTab({ status, ownerAddress, lendingStats, onShowAudit }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [revoking, setRevoking] = useState(false);
  const { writeContract } = useWriteContract();

  useEffect(() => {
    const f = () => fetch(`${API_BASE}/api/agent/audit/${ownerAddress}?limit=30`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setEvents((Array.isArray(d) ? d : []).filter(isLending).slice(-8).reverse()))
      .catch(() => {});
    f(); const i = setInterval(f, 6000); return () => clearInterval(i);
  }, [ownerAddress]);

  const c = colors, s = spacing, f = fontSizes;
  const allowance = status?.allowance ?? 0;
  const loans = status?.loans ?? [];
  const active = loans.filter(l => l.status === 'active').length;
  const lent = lendingStats?.totalLent ?? 0;
  const profit = lendingStats?.totalInterestEarned ?? 0;
  const totalLoans = lendingStats?.totalLoans ?? loans.length;
  const overdue = lendingStats?.overdueLoans ?? 0;
  const rate = lendingStats?.dynamicRate ?? 0;

  const metrics = [
    {
      label: 'DELEGATED',
      value: `$${allowance.toFixed(0)}`,
      color: c.textPrimary,
      hasRevoke: allowance > 0,
    },
    { label: 'TOTAL LENT', value: `$${lent.toFixed(2)}`, color: c.textPrimary },
    { label: 'ACTIVE / TOTAL', value: `${active}/${totalLoans}`, color: c.textPrimary },
    { label: 'OVERDUE', value: String(overdue), color: overdue > 0 ? c.danger : c.textMuted },
    { label: 'PROFIT', value: `+$${profit.toFixed(2)}`, color: profit > 0 ? c.accent : c.textMuted },
  ];

  return (
    <div style={{ fontFamily: fonts.mono, display: 'flex', flexDirection: 'column', gap: s.md }}>

      {/* ── Metrics row ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: c.border }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            background: c.bgCard,
            padding: `${s.md}px ${s.md}px`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: s.xs,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 600, color: c.textMuted,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {m.label}
              </span>
              {/* Revoke button on DELEGATED */}
              {m.hasRevoke && (
                <button
                  onClick={() => {
                    if (!confirm('Revoke all delegated USDT from the bot?')) return;
                    setRevoking(true);
                    const opAddr = status?.operatorAddress;
                    if (!opAddr) { setRevoking(false); return; }
                    writeContract({
                      address: USDT_CONTRACT,
                      abi: USDT_ABI,
                      functionName: 'approve',
                      args: [opAddr as `0x${string}`, BigInt(0)],
                    }, {
                      onSuccess: () => { setRevoking(false); window.location.reload(); },
                      onError: () => { setRevoking(false); },
                    });
                  }}
                  style={{
                    fontSize: 8, fontWeight: 700, color: c.danger,
                    background: 'transparent',
                    border: `1px solid ${c.danger}33`,
                    borderRadius: radii.sm,
                    padding: '1px 5px', cursor: 'pointer',
                    fontFamily: fonts.mono, textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {revoking ? '...' : 'REVOKE'}
                </button>
              )}
            </div>
            <div style={{
              fontSize: 20, fontWeight: 700, lineHeight: 1,
              color: m.color,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column: Trust Tiers + Live Feed ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: s.md, alignItems: 'start' }}>

        {/* ── Trust Tiers sidebar ── */}
        <div style={{
          border: `1px solid ${c.border}`,
          borderRadius: radii.sm,
          background: c.bgCard,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: `${s.sm}px ${s.md}px`,
            borderBottom: `1px solid ${c.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em' }}>
              TRUST TIERS
            </span>
            <span style={{ fontSize: 9, color: c.textMuted }}>
              COLLATERAL
            </span>
          </div>

          {TIERS.map((name, i) => {
            const tierColor = TIER_COLORS[i];
            const borrowerCount = (lendingStats?.borrowers ?? []).filter((b: any) => b.trustTier === i).length;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${s.sm}px ${s.md}px`,
                borderBottom: i < 4 ? `1px solid ${c.border}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: s.sm }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: tierColor,
                    width: 10, textAlign: 'center',
                  }}>
                    {i}
                  </span>
                  <span style={{
                    fontSize: f.xs, color: tierColor,
                    fontWeight: i === 4 ? 600 : 400,
                  }}>
                    {name}
                  </span>
                  {borrowerCount > 0 && (
                    <span style={{ fontSize: 9, color: c.textMuted }}>
                      [{borrowerCount}]
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: f.xs, fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: TIER_PCT[i] === 0 ? c.accent : c.textSecondary,
                }}>
                  {TIER_PCT[i] === 0 ? 'NONE' : `${TIER_PCT[i]}%`}
                </span>
              </div>
            );
          })}

          {/* Dynamic rate */}
          {rate > 0 && (
            <div style={{
              padding: `${s.sm}px ${s.md}px`,
              borderTop: `1px solid ${c.border}`,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 9, color: c.textMuted, letterSpacing: '0.1em' }}>BASE RATE</span>
              <span style={{ fontSize: f.xs, color: c.accent, fontWeight: 600 }}>{(rate * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* ── Live decision feed ── */}
        <div style={{
          border: `1px solid ${c.border}`,
          borderRadius: radii.sm,
          background: c.bgCard,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: `${s.sm}px ${s.md}px`,
            borderBottom: `1px solid ${c.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em' }}>
              LIVE DECISIONS
            </span>
            <span style={{ fontSize: 9, color: c.textMuted }}>
              [{events.length}]
            </span>
          </div>

          {events.length === 0 ? (
            <div style={{
              padding: `${s.xl}px ${s.md}px`,
              color: c.textMuted, fontSize: f.xs,
              display: 'flex', alignItems: 'center', gap: s.xs,
            }}>
              <span>Awaiting decisions</span>
              <span style={{ animation: 'termBlink 1s step-end infinite' }}>_</span>
            </div>
          ) : (
            <>
              {/* Blinking cursor */}
              <div style={{
                padding: `${s.xs}px ${s.md}px`,
                borderBottom: `1px solid ${c.border}`,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{
                  color: c.accent, fontSize: f.xs, fontWeight: 700,
                  animation: 'termBlink 1s step-end infinite',
                }}>{'>'}</span>
                <span style={{ fontSize: 9, color: c.textMuted }}>stream</span>
              </div>

              {events.map((e, i) => {
                const action = (e.action ?? '').replace(/_/g, ' ').toUpperCase();
                const a = (e.action ?? '').toLowerCase();
                const dot = a.includes('rejected') || a.includes('overdue') ? c.danger
                  : a.includes('approved') || a.includes('repaid') ? c.accent
                  : a.includes('negotiation') ? c.warning : c.textMuted;

                return (
                  <div key={`${e.timestamp}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: s.sm,
                    padding: `${s.xs + 2}px ${s.md}px`,
                    borderBottom: i < events.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: dot,
                      boxShadow: `0 0 4px ${dot}66`,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: f.xs, color: dot,
                      fontWeight: 600, flex: 1,
                      letterSpacing: '0.02em',
                    }}>
                      {action}
                    </span>
                    {e.amount != null && (
                      <span style={{
                        fontSize: f.xs, color: c.textSecondary,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        ${e.amount}
                      </span>
                    )}
                    <span style={{
                      fontSize: 9, color: c.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
