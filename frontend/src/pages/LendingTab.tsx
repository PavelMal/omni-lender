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

  const c = colors, s = spacing, f = fontSizes;

  const filtered = filter === 'all' ? loans : loans.filter(l => l.status === filter);
  const counts = {
    all: loans.length,
    active: loans.filter(l => l.status === 'active').length,
    repaid: loans.filter(l => l.status === 'repaid').length,
    overdue: loans.filter(l => l.status === 'overdue').length,
  };

  const filters: { key: Filter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'ALL', count: counts.all, color: c.textPrimary },
    { key: 'active', label: 'ACTIVE', count: counts.active, color: c.accent },
    { key: 'repaid', label: 'REPAID', count: counts.repaid, color: c.textSecondary },
    { key: 'overdue', label: 'OVERDUE', count: counts.overdue, color: c.danger },
  ];

  return (
    <div style={{ fontFamily: fonts.mono, display: 'flex', flexDirection: 'column', gap: s.md }}>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 1, background: c.border }}>
        {filters.map(fl => {
          const isActive = filter === fl.key;
          return (
            <button
              key={fl.key}
              onClick={() => setFilter(fl.key)}
              style={{
                flex: 1,
                padding: `${s.sm}px ${s.md}px`,
                background: isActive ? c.bgCardHover : c.bgCard,
                border: 'none',
                fontSize: 9, fontWeight: 600,
                color: isActive ? fl.color : c.textMuted,
                cursor: 'pointer',
                fontFamily: fonts.mono,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                transition: 'all 0.1s',
                borderBottom: isActive ? `2px solid ${fl.color}` : '2px solid transparent',
              }}
            >
              {fl.label} [{fl.count}]
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          border: `1px solid ${c.border}`, borderRadius: radii.sm,
          background: c.bgCard,
          padding: `${s.xxxl}px`, textAlign: 'center',
          color: c.textMuted, fontSize: f.sm,
        }}>
          {filter === 'all' ? 'No data' : `No ${filter} loans`}
        </div>
      ) : (
        <div style={{
          border: `1px solid ${c.border}`, borderRadius: radii.sm,
          background: c.bgCard, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['BORROWER', 'PRINCIPAL', 'INTEREST', 'DUE DATE', 'STATUS', 'COLLATERAL'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: `${s.sm}px ${s.md}px`,
                    borderBottom: `1px solid ${c.border}`,
                    fontSize: 9, fontWeight: 600, color: c.textMuted,
                    letterSpacing: '0.1em',
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
                const borrower = loan.borrowerName || (loan.borrowerAddress ? `${loan.borrowerAddress.slice(0, 6)}...${loan.borrowerAddress.slice(-4)}` : '\u2014');
                const now = new Date();
                const isOverdue = loan.status === 'active' && dueDate < now;

                return (
                  <tr key={loan.id || i} style={{
                    borderBottom: i < filtered.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}>
                    <td style={{ padding: `${s.sm}px ${s.md}px`, fontSize: f.xs, color: c.textPrimary }}>
                      {borrower}
                    </td>
                    <td style={{
                      padding: `${s.sm}px ${s.md}px`, fontSize: f.xs,
                      fontWeight: 600, color: c.textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      ${loan.principal.toFixed(2)}
                    </td>
                    <td style={{
                      padding: `${s.sm}px ${s.md}px`, fontSize: f.xs,
                      color: interest > 0 ? c.accent : c.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {interest > 0 ? `+$${interest.toFixed(2)}` : '\u2014'}
                    </td>
                    <td style={{
                      padding: `${s.sm}px ${s.md}px`, fontSize: f.xs,
                      color: isOverdue ? c.danger : c.textSecondary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {dueDate.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' })}
                    </td>
                    <td style={{ padding: `${s.sm}px ${s.md}px` }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: statusColor,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {loan.status}
                      </span>
                    </td>
                    <td style={{
                      padding: `${s.sm}px ${s.md}px`, fontSize: f.xs,
                      color: c.textSecondary, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {loan.collateralAmountEth
                        ? `${loan.collateralAmountEth} ETH`
                        : '\u2014'}
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
