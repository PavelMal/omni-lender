import { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import { colors, spacing, radii, fontSizes, fonts } from '../styles/tokens';

interface Borrower {
  address: string; creditScore: number; trustTier: number;
  totalBorrowed: number; totalRepaid: number; activeLoans: number; defaultRate: string;
}

const TIERS = ['NEW', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
const TIER_COLORS = [colors.textMuted, '#cd7f32', '#aaa', '#ffd700', colors.accent];

export function BorrowersTab({ lendingStats }: { lendingStats: any }) {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);

  useEffect(() => {
    if (lendingStats?.borrowers) { setBorrowers(lendingStats.borrowers); return; }
    fetch(`${API_BASE}/agent/borrowers`).then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setBorrowers(d); }).catch(() => {});
  }, [lendingStats]);

  const c = colors, s = spacing, f = fontSizes;

  if (borrowers.length === 0) {
    return (
      <div style={{
        fontFamily: fonts.mono,
        border: `1px solid ${c.border}`,
        borderRadius: radii.sm,
        background: c.bgCard,
        padding: `${s.xxxl * 2}px`,
        textAlign: 'center',
        color: c.textMuted,
        fontSize: f.sm,
      }}>
        No data
      </div>
    );
  }

  const headers = ['BORROWER', 'TIER', 'BORROWED', 'REPAID', 'ACTIVE'];

  return (
    <div style={{
      fontFamily: fonts.mono,
      border: `1px solid ${c.border}`,
      borderRadius: radii.sm,
      background: c.bgCard,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        padding: `${s.sm}px ${s.md}px`,
        borderBottom: `1px solid ${c.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em' }}>
          BORROWER REGISTRY
        </span>
        <span style={{ fontSize: 9, color: c.textMuted }}>
          [{borrowers.length}]
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: 'left',
                padding: `${s.sm}px ${s.md}px`,
                borderBottom: `1px solid ${c.border}`,
                fontSize: 9, fontWeight: 600, color: c.textMuted,
                letterSpacing: '0.1em',
                ...(h === '' ? { width: 70, padding: `${s.sm}px 0` } : {}),
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {borrowers.map((b, i) => {
            const short = b.address ? `${b.address.slice(0, 6)}...${b.address.slice(-4)}` : '\u2014';
            const tier = b.trustTier;
            const tierName = TIERS[tier] ?? 'NEW';
            const tierColor = TIER_COLORS[tier] ?? c.textMuted;

            return (
              <tr key={b.address || i} style={{
                borderBottom: i < borrowers.length - 1 ? `1px solid ${c.border}` : 'none',
              }}>
                <td style={{ padding: `${s.sm}px ${s.md}px` }}>
                  <span style={{ fontSize: f.xs, color: c.textPrimary }}>{short}</span>
                </td>
                <td style={{ padding: `${s.sm}px ${s.md}px` }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: tierColor, letterSpacing: '0.05em' }}>
                    {tierName}
                  </span>
                </td>
                <td style={{ padding: `${s.sm}px ${s.md}px`, fontSize: f.xs, color: c.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                  ${b.totalBorrowed.toFixed(2)}
                </td>
                <td style={{ padding: `${s.sm}px ${s.md}px`, fontSize: f.xs, color: c.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                  ${b.totalRepaid.toFixed(2)}
                </td>
                <td style={{ padding: `${s.sm}px ${s.md}px`, fontSize: f.xs, fontVariantNumeric: 'tabular-nums', color: b.activeLoans > 0 ? c.warning : c.textMuted }}>
                  {b.activeLoans}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
