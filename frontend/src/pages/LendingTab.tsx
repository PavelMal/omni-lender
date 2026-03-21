import { useState, useEffect } from 'react';
import { colors, spacing, radii, fontSizes, fonts } from '../styles/tokens';
import { API_BASE } from '../api';

type Filter = 'all' | 'active' | 'repaid' | 'overdue';

export function LendingTab() {
  const [loans, setLoans] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const f = () => fetch(`${API_BASE}/api/agent/all-loans`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setLoans(d); })
      .catch(() => {});
    f(); const i = setInterval(f, 5000); return () => clearInterval(i);
  }, []);

  const c = colors, s = spacing, f = fontSizes, r = radii;
  const card = { background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: r.md };

  const filtered = filter === 'all' ? loans : loans.filter(l => l.status === filter);
  const counts = {
    all: loans.length,
    active: loans.filter(l => l.status === 'active').length,
    repaid: loans.filter(l => l.status === 'repaid').length,
    overdue: loans.filter(l => l.status === 'overdue').length,
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'active', label: `Active (${counts.active})` },
    { key: 'repaid', label: `Repaid (${counts.repaid})` },
    { key: 'overdue', label: `Overdue (${counts.overdue})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: s.md }}>
      <div style={{ display: 'flex', gap: s.xs }}>
        {filters.map(fl => (
          <button
            key={fl.key}
            onClick={() => setFilter(fl.key)}
            style={{
              padding: `${s.xs}px ${s.md}px`,
              background: filter === fl.key ? c.bgCardHover : 'transparent',
              border: `1px solid ${filter === fl.key ? c.borderLight : c.border}`,
              borderRadius: r.sm, fontSize: f.xs, fontWeight: 500,
              color: filter === fl.key ? c.textPrimary : c.textMuted,
              cursor: 'pointer', fontFamily: fonts.body, transition: 'all 0.15s',
            }}
          >{fl.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...card, padding: `${s.xxxl}px`, textAlign: 'center', color: c.textMuted, fontSize: f.sm }}>
          {filter === 'all' ? 'No loans issued yet' : `No ${filter} loans`}
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['BORROWER', 'AMOUNT', 'INTEREST', 'DUE', 'STATUS', 'COLLATERAL'].map(h => (
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
              {filtered.map((loan: any, i: number) => {
                const statusColor = loan.status === 'active' ? c.accent
                  : loan.status === 'repaid' ? c.textMuted : c.danger;
                const dueDate = new Date(loan.dueDate);
                const interest = loan.totalDue - loan.principal;
                const borrower = loan.borrowerName || (loan.borrowerAddress ? `${loan.borrowerAddress.slice(0, 6)}...${loan.borrowerAddress.slice(-4)}` : '—');

                return (
                  <tr key={loan.id || i} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${c.border}` : 'none' }}>
                    <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.sm, color: c.textPrimary }}>
                      {borrower}
                    </td>
                    <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.sm, fontFamily: fonts.mono, fontWeight: 600, color: c.textPrimary }}>
                      ${loan.principal.toFixed(2)}
                    </td>
                    <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.sm, fontFamily: fonts.mono, color: interest > 0 ? c.accent : c.textMuted }}>
                      {interest > 0 ? `+$${interest.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.xs, color: c.textSecondary }}>
                      {dueDate.toLocaleDateString()}
                    </td>
                    <td style={{ padding: `${s.md}px ${s.lg}px` }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: statusColor,
                        background: `${statusColor}12`, padding: '2px 8px',
                        borderRadius: r.pill, textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {loan.status}
                      </span>
                    </td>
                    <td style={{ padding: `${s.md}px ${s.lg}px`, fontSize: f.xs, fontFamily: fonts.mono, color: c.textSecondary }}>
                      {loan.collateralAmountEth
                        ? `${loan.collateralAmountEth} ETH ($${loan.collateralValueUsd?.toFixed(2) ?? '?'})`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
