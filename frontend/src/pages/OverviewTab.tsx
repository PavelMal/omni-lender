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
  onGoToActivity?: () => void;
}

const LK = ['loan', 'negotiation', 'collateral', 'interest', 'liquidat', 'repay', 'credit'];
function isLending(e: any): boolean {
  const a = (e.action ?? '').toLowerCase();
  return (LK.some(k => a.includes(k)) || e.module === 'lending') && a !== 'wallet_initialized' && a !== 'budgets_allocated';
}

const TIERS = ['NEW', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
const TIER_PCT = [150, 120, 80, 50, 0];
const TIER_COLORS = [colors.textMuted, '#cd7f32', '#aaa', '#ffd700', colors.accent];

export function OverviewTab({ status, ownerAddress, lendingStats, onShowAudit, onGoToActivity }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [allLoans, setAllLoans] = useState<any[]>([]);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showTierInfo, setShowTierInfo] = useState(false);
  const { writeContract } = useWriteContract();

  // Fetch all loans
  useEffect(() => {
    const f = () => fetch(`${API_BASE}/api/agent/all-loans`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setAllLoans(d); })
      .catch(() => {});
    f(); const i = setInterval(f, 8000); return () => clearInterval(i);
  }, []);

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
  const rate = lendingStats?.dynamicRate?.rate ?? 0;

  const metrics = [
    {
      label: 'DELEGATED',
      value: `$${allowance.toFixed(0)}`,
      color: c.textPrimary,
      hasRevoke: allowance > 0,
    },
    { label: 'LOANS ISSUED', value: `$${lent.toFixed(2)}`, sub: `${totalLoans} loans` },
    { label: 'ACTIVE LOANS', value: String(active), color: active > 0 ? c.accent : c.textMuted },
    { label: 'EARNED', value: `+$${profit.toFixed(2)}`, color: profit > 0 ? c.accent : c.textMuted, sub: 'from interest' },
  ];

  return (
    <div style={{ fontFamily: fonts.mono, display: 'flex', flexDirection: 'column', gap: s.md }}>

      {/* ── Metrics row ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: c.border }}>
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
                  onClick={() => setShowRevokeModal(true)}
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
              color: m.color ?? c.textPrimary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {m.value}
            </div>
            {(m as any).sub && (
              <div style={{ fontSize: 9, color: c.textMuted, marginTop: 4 }}>{(m as any).sub}</div>
            )}
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
          overflow: 'visible',
          position: 'relative',
        }}>
          {/* Header */}
          <div style={{
            padding: `${s.sm}px ${s.md}px`,
            borderBottom: `1px solid ${c.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: s.xs }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em' }}>
                TRUST TIERS
              </span>
              <button
                onClick={() => setShowTierInfo(!showTierInfo)}
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: `1px solid ${showTierInfo ? c.accent : c.borderLight}`,
                  background: showTierInfo ? `${c.accent}15` : 'transparent',
                  color: showTierInfo ? c.accent : c.textSecondary,
                  fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: fonts.mono,
                }}
              >?</button>
            </div>
            <span style={{ fontSize: 9, color: c.textMuted }}>
              COLLATERAL
            </span>
          </div>

          {/* Tier info popup */}
          {showTierInfo && (
            <>
              <div onClick={() => setShowTierInfo(false)} style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
              }} />
              <div style={{
                position: 'absolute', top: 36, left: 0, zIndex: 1000,
                background: c.bgCard, border: `1px solid ${c.border}`,
                borderRadius: radii.sm, padding: s.md,
                width: 280, fontFamily: fonts.mono,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: 9, color: c.textSecondary, lineHeight: 1.8 }}>
                  <div>Borrowers put up ETH as collateral to get USDT loans.</div>
                  <div style={{ marginTop: 4 }}>New borrowers must deposit 150% of the loan value.</div>
                  <div style={{ marginTop: 4 }}>Each repaid loan builds trust — the bot requires less collateral.</div>
                  <div style={{ marginTop: 4 }}>Trusted borrowers (Tier 4) can borrow with no collateral at all.</div>
                  <div style={{ marginTop: 4, color: c.danger }}>A single missed payment resets trust to zero.</div>
                </div>
              </div>
            </>
          )}

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
              <span style={{ fontSize: f.xs, color: c.accent, fontWeight: 600 }}>{rate.toFixed(1)}%</span>
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
                    <span
                      onClick={onGoToActivity}
                      style={{
                        fontSize: f.xs, color: dot,
                        fontWeight: 600, flex: 1,
                        letterSpacing: '0.02em',
                        cursor: onGoToActivity ? 'pointer' : 'default',
                      }}
                      title="View in Activity tab"
                    >
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

      {/* ── Recent Loans ──────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${c.border}`, borderRadius: radii.sm,
        background: c.bgCard, overflow: 'hidden',
      }}>
        <div style={{
          padding: `${s.sm}px ${s.md}px`, borderBottom: `1px solid ${c.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em' }}>RECENT LOANS</span>
          <span style={{ fontSize: 9, color: c.textMuted }}>[{allLoans.length}]</span>
        </div>

        {allLoans.length === 0 ? (
          <div style={{ padding: `${s.lg}px ${s.md}px`, color: c.textMuted, fontSize: f.xs }}>—</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['BORROWER', 'AMOUNT', 'INTEREST', 'STATUS', 'TX'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: `${s.xs}px ${s.md}px`,
                    borderBottom: `1px solid ${c.border}`,
                    fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allLoans.slice(-6).reverse().map((l: any, i: number) => {
                const sc = l.status === 'active' ? c.accent : l.status === 'repaid' ? c.textMuted : c.danger;
                const interest = (l.totalDue ?? 0) - (l.principal ?? 0);
                return (
                  <tr key={l.id || i} style={{ borderBottom: i < Math.min(allLoans.length, 6) - 1 ? `1px solid ${c.border}` : 'none' }}>
                    <td style={{ padding: `${s.xs}px ${s.md}px`, fontSize: f.xs, color: c.textPrimary }}>
                      {l.borrowerName?.slice(0, 20) || '—'}
                    </td>
                    <td style={{ padding: `${s.xs}px ${s.md}px`, fontSize: f.xs, color: c.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                      ${l.principal?.toFixed(2)}
                    </td>
                    <td style={{ padding: `${s.xs}px ${s.md}px`, fontSize: f.xs, color: interest > 0 ? c.accent : c.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                      {interest > 0 ? `+$${interest.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: `${s.xs}px ${s.md}px`, fontSize: 9, fontWeight: 600, color: sc, letterSpacing: '0.05em' }}>
                      {l.status?.toUpperCase()}
                    </td>
                    <td style={{ padding: `${s.xs}px ${s.md}px`, fontSize: f.xs }}>
                      {l.txHash && l.txHash.startsWith('0x') && l.txHash.length > 20 ? (
                        <a href={`https://sepolia.etherscan.io/tx/${l.txHash}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: c.accent, textDecoration: 'none' }}>{l.txHash.slice(0, 6)}...{l.txHash.slice(-4)}</a>
                      ) : <span style={{ color: c.textMuted }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Revoke Modal ─────────────────────────────────────────── */}
      {showRevokeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: c.bgCard, border: `1px solid ${c.danger}33`,
            borderRadius: radii.sm, padding: s.xl,
            maxWidth: 360, width: '100%', fontFamily: fonts.mono,
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: c.danger, letterSpacing: '0.1em', marginBottom: s.md }}>
              REVOKE DELEGATION
            </div>
            <div style={{ fontSize: f.xs, color: c.textSecondary, marginBottom: s.xl, lineHeight: 1.6 }}>
              This will set USDT allowance to 0. The bot will no longer be able to issue loans with your funds.
            </div>
            <div style={{ display: 'flex', gap: s.sm, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRevokeModal(false)}
                style={{
                  padding: `${s.xs}px ${s.lg}px`, background: 'transparent',
                  border: `1px solid ${c.border}`, borderRadius: radii.sm,
                  color: c.textMuted, fontSize: f.xs, cursor: 'pointer',
                  fontFamily: fonts.mono, letterSpacing: '0.05em',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setShowRevokeModal(false);
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
                  padding: `${s.xs}px ${s.lg}px`, background: c.danger,
                  border: 'none', borderRadius: radii.sm,
                  color: '#000', fontSize: f.xs, fontWeight: 700, cursor: 'pointer',
                  fontFamily: fonts.mono, letterSpacing: '0.05em',
                }}
              >
                {revoking ? 'REVOKING...' : 'REVOKE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
