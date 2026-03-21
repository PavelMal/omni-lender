import { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import { colors, spacing, radii, fontSizes, fonts } from '../styles/tokens';

interface Borrower {
  address: string; creditScore: number; trustTier: number;
  totalBorrowed: number; totalRepaid: number; activeLoans: number; defaultRate: string;
}

const TIERS = ['New', 'Bronze', 'Silver', 'Gold', 'Platinum'];
const TIER_PCT = [150, 120, 80, 50, 0];

export function BorrowersTab({ lendingStats }: { lendingStats: any }) {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);

  useEffect(() => {
    if (lendingStats?.borrowers) { setBorrowers(lendingStats.borrowers); return; }
    fetch(`${API_BASE}/agent/borrowers`).then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setBorrowers(d); }).catch(() => {});
  }, [lendingStats]);

  const c = colors, s = spacing, f = fontSizes, r = radii;
  const card = { background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: r.md };

  if (borrowers.length === 0) {
    return (
      <div style={{ ...card, padding: `${s.xxxl * 2}px`, textAlign: 'center' }}>
        <div style={{ fontSize: f.sm, color: c.textMuted }}>No borrowers yet</div>
      </div>
    );
  }

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['BORROWER', 'SCORE', 'TIER', 'COLLATERAL', 'BORROWED', 'REPAID', 'ACTIVE', 'DEFAULTS'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: `${s.md}px ${s.lg}px`,
                borderBottom: `1px solid ${c.border}`,
                fontSize: 10, fontWeight: 600, color: c.textMuted,
                letterSpacing: '0.08em', fontFamily: fonts.mono,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {borrowers.map((b, i) => {
            const short = b.address ? `${b.address.slice(0, 6)}...${b.address.slice(-4)}` : '—';
            const tier = b.trustTier;
            const tierName = TIERS[tier] ?? 'New';
            const pct = TIER_PCT[tier] ?? 150;
            const scoreColor = b.creditScore >= 80 ? c.success : b.creditScore >= 50 ? c.textPrimary : c.danger;

            // Score bar width
            const barW = `${b.creditScore}%`;

            return (
              <tr key={b.address || i} style={{ borderBottom: i < borrowers.length - 1 ? `1px solid ${c.border}` : 'none' }}>
                <td style={{ padding: `${s.md}px ${s.lg}px` }}>
                  <span style={{ fontSize: f.sm, fontFamily: fonts.mono, color: c.textPrimary }}>{short}</span>
                </td>
                <td style={{ padding: `${s.md}px ${s.lg}px` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: s.sm }}>
                    <div style={{ width: 60, height: 4, background: c.bgInset, borderRadius: r.pill, overflow: 'hidden' }}>
                      <div style={{ width: barW, height: '100%', background: scoreColor, borderRadius: r.pill, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: f.sm, fontFamily: fonts.mono, fontWeight: 600, color: scoreColor, minWidth: 24 }}>
                      {b.creditScore}
                    </span>
                  </div>
                </td>
                <td style={{ padding: `${s.md}px ${s.lg}px` }}>
                  <span style={{
                    fontSize: f.xs, fontWeight: 500, color: tier === 4 ? c.accent : c.textSecondary,
                    background: tier === 4 ? `${c.accent}12` : c.bgInset,
                    padding: '2px 8px', borderRadius: r.pill,
                    border: `1px solid ${tier === 4 ? `${c.accent}25` : c.border}`,
                  }}>
                    {tierName}
                  </span>
                </td>
                <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.sm, fontFamily: fonts.mono, color: c.textSecondary }}>
                  {pct === 0 ? <span style={{ color: c.accent }}>none</span> : `${pct}%`}
                </td>
                <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.sm, fontFamily: fonts.mono, color: c.textPrimary }}>
                  ${b.totalBorrowed.toFixed(2)}
                </td>
                <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.sm, fontFamily: fonts.mono, color: c.textSecondary }}>
                  ${b.totalRepaid.toFixed(2)}
                </td>
                <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.sm, fontFamily: fonts.mono, color: b.activeLoans > 0 ? c.warning : c.textMuted }}>
                  {b.activeLoans}
                </td>
                <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.sm, fontFamily: fonts.mono, color: b.defaultRate !== '0%' ? c.danger : c.textMuted }}>
                  {b.defaultRate}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
