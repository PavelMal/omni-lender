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

const TIERS = ['New', 'Bronze', 'Silver', 'Gold', 'Platinum'];
const TIER_PCT = [150, 120, 80, 50, 0];

export function OverviewTab({ status, ownerAddress, lendingStats, onShowAudit }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [revoking, setRevoking] = useState(false);
  const { writeContract } = useWriteContract();

  useEffect(() => {
    const f = () => fetch(`${API_BASE}/api/agent/audit/${ownerAddress}?limit=30`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setEvents((Array.isArray(d) ? d : []).filter(isLending).slice(-6).reverse()))
      .catch(() => {});
    f(); const i = setInterval(f, 6000); return () => clearInterval(i);
  }, [ownerAddress]);

  const c = colors, s = spacing, f = fontSizes, r = radii;
  const bal = status?.balance?.usdt ?? 0;
  const allowance = status?.allowance ?? 0;
  const loans = status?.loans ?? [];
  const active = loans.filter(l => l.status === 'active').length;
  const lent = lendingStats?.totalLent ?? 0;
  const profit = lendingStats?.totalInterestEarned ?? 0;
  const totalLoans = lendingStats?.totalLoans ?? loans.length;
  const overdue = lendingStats?.overdueLoans ?? 0;

  const card = { background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: r.md };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: s.lg }}>

      {/* ── Metrics grid ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: s.sm }}>
        {/* DELEGATED — with revoke */}
        <div style={{ ...card, padding: `${s.lg}px ${s.md}px` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.sm }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.08em', fontFamily: fonts.mono }}>DELEGATED</span>
            {allowance > 0 && (
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
                  fontSize: 9, fontWeight: 600, color: c.danger, background: `${c.danger}12`,
                  border: `1px solid ${c.danger}25`, borderRadius: r.sm,
                  padding: '1px 6px', cursor: 'pointer',
                }}
              >
                {revoking ? '...' : 'Revoke'}
              </button>
            )}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: fonts.mono, lineHeight: 1, color: c.textPrimary }}>
            ${allowance.toFixed(0)}
          </div>
        </div>

        {/* Other metrics */}
        {[
          { label: 'TOTAL LENT', val: `$${lent.toFixed(2)}` },
          { label: 'LOANS', val: `${active} active`, sub: `${totalLoans} total` },
          { label: 'OVERDUE', val: String(overdue), warn: overdue > 0 },
          { label: 'PROFIT', val: `+$${profit.toFixed(2)}`, accent: profit > 0 },
        ].map((m, i) => (
          <div key={i} style={{ ...card, padding: `${s.lg}px ${s.md}px` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.08em', marginBottom: s.sm, fontFamily: fonts.mono }}>
              {m.label}
            </div>
            <div style={{
              fontSize: 24, fontWeight: 700, fontFamily: fonts.mono, lineHeight: 1,
              color: (m as any).warn ? c.danger : (m as any).accent ? c.accent : c.textPrimary,
            }}>
              {m.val}
            </div>
            {(m as any).sub && <div style={{ fontSize: f.xs, color: c.textMuted, marginTop: 4 }}>{(m as any).sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Two-column: Trust tiers + Recent ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: s.md, alignItems: 'start' }}>

        {/* Trust tiers */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: `${s.sm}px ${s.md}px`, borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.08em', fontFamily: fonts.mono }}>TRUST TIERS</span>
            <span style={{ fontSize: 10, color: c.textMuted }}>collateral required</span>
          </div>
          {TIERS.map((name, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: `${s.sm}px ${s.md}px`,
              borderBottom: i < 4 ? `1px solid ${c.border}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: s.sm }}>
                <div style={{
                  width: 20, height: 20, borderRadius: r.sm,
                  background: i === 4 ? `${c.accent}15` : c.bgInset,
                  border: `1px solid ${i === 4 ? `${c.accent}33` : c.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: i === 4 ? c.accent : c.textMuted, fontFamily: fonts.mono,
                }}>
                  {i}
                </div>
                <span style={{ fontSize: f.sm, color: i === 4 ? c.accent : c.textPrimary, fontWeight: 500 }}>{name}</span>
              </div>
              <span style={{
                fontSize: f.sm, fontFamily: fonts.mono, fontWeight: 600,
                color: TIER_PCT[i] === 0 ? c.accent : c.textSecondary,
              }}>
                {TIER_PCT[i] === 0 ? 'no collateral' : `${TIER_PCT[i]}% ETH`}
              </span>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: `${s.sm}px ${s.md}px`, borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.08em', fontFamily: fonts.mono }}>RECENT DECISIONS</span>
            <span style={{ fontSize: f.xs, color: c.textMuted }}>{events.length}</span>
          </div>

          {events.length === 0 ? (
            <div style={{ padding: `${s.xxl}px ${s.md}px`, textAlign: 'center', color: c.textMuted, fontSize: f.sm }}>
              No activity yet
            </div>
          ) : events.map((e, i) => {
            const action = (e.action ?? '').replace(/_/g, ' ');
            const a = action.toLowerCase();
            const dot = a.includes('rejected') || a.includes('overdue') ? c.danger
              : a.includes('approved') || a.includes('repaid') ? c.success
              : a.includes('negotiation') ? c.accent : c.textMuted;

            return (
              <div key={`${e.timestamp}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: s.sm,
                padding: `${s.sm}px ${s.md}px`,
                borderBottom: i < events.length - 1 ? `1px solid ${c.border}` : 'none',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: f.sm, color: c.textPrimary, fontWeight: 500, flex: 1 }}>{action}</span>
                {e.amount != null && (
                  <span style={{ fontSize: f.xs, color: c.textSecondary, fontFamily: fonts.mono }}>${e.amount}</span>
                )}
                <span style={{ fontSize: 10, color: c.textMuted, fontFamily: fonts.mono }}>
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
