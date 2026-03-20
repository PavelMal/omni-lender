import { useState, useEffect } from 'react';
import { useAgent } from '../hooks/useAgent';
import { API_BASE } from '../api';

const card: React.CSSProperties = {
  background: '#111118',
  border: '1px solid #222',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 12,
  marginBottom: 24,
};

interface Props {
  ownerAddress: string;
}

export function Dashboard({ ownerAddress }: Props) {
  const { status, loading } = useAgent(ownerAddress);
  const [lendingStats, setLendingStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = () => {
      fetch(`${API_BASE}/api/agent/lending-stats`)
        .then(r => r.ok ? r.json() : null)
        .then(setLendingStats)
        .catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return <p style={{ color: '#555' }}>Loading agent status...</p>;
  }

  if (!status) {
    return <p style={{ color: '#555' }}>No agent found. Connect and deposit first.</p>;
  }

  const { balance, allowance, availableBudget, budgets, holdings, positions, loans, aaveBalance } = status;

  return (
    <div>
      {/* Balance cards */}
      <div style={grid}>
        <div style={card}>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>USDT Balance</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#00d4aa' }}>
            ${balance.usdt.toFixed(2)}
          </p>
        </div>
        <div style={card}>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Delegated (Allowance)</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#aa44ff' }}>
            ${(allowance ?? 0).toFixed(2)}
          </p>
        </div>
        {(aaveBalance ?? 0) > 0 && (
          <div style={card}>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Aave aUSDT (yield-bearing)</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#4488ff' }}>
              ${(aaveBalance ?? 0).toFixed(2)}
            </p>
          </div>
        )}
        <div style={card}>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Positions</p>
          <p style={{ fontSize: 24, fontWeight: 700 }}>{positions.length}</p>
        </div>
        <div style={card}>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Active Loans</p>
          <p style={{ fontSize: 24, fontWeight: 700 }}>
            {loans.filter(l => l.status === 'active').length}
          </p>
        </div>
        {lendingStats && lendingStats.totalLoans > 0 && (
          <div style={card}>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Lending Profit</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#00d4aa' }}>
              +${lendingStats.totalInterestEarned.toFixed(2)}
            </p>
            <div style={{ color: '#555', fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
              <span>{lendingStats.totalLoans} {lendingStats.totalLoans === 1 ? 'loan' : 'loans'} issued</span>
              {lendingStats.activeLoans > 0 && (
                <span style={{ color: '#ffaa00' }}> · {lendingStats.activeLoans} active</span>
              )}
              {lendingStats.overdueLoans > 0 && (
                <span style={{ color: '#ff4444' }}> · {lendingStats.overdueLoans} overdue</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Budget bars */}
      <div style={card}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Budget Allocation</h3>
        {Object.entries(budgets).map(([name, b]) => {
          const pct = b.allocated > 0 ? (b.spent / b.allocated) * 100 : 0;
          return (
            <div key={name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{name === 'reserve' ? 'Treasury' : name}</span>
                <span style={{ color: '#888' }}>${b.spent.toFixed(2)} / ${b.allocated.toFixed(2)}</span>
              </div>
              <div style={{ height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(pct, 100)}%`,
                  background: pct > 90 ? '#ff4444' : '#00d4aa',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Holdings (portfolio) */}
      {Object.values(holdings).some(v => v > 0) && (
        <div style={card}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Portfolio Holdings</h3>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {Object.entries(holdings).filter(([, val]) => val > 0).map(([asset, val]) => {
              const total = Object.values(holdings).reduce((s, v) => s + v, 0);
              const pct = total > 0 ? (val / total * 100).toFixed(0) : '0';
              const color = asset === 'USDT' ? '#00d4aa' : asset === 'WETH' ? '#627eea' : asset === 'WBTC' ? '#f7931a' : '#888';
              return (
                <div key={asset}>
                  <p style={{ color: '#888', fontSize: 12 }}>{asset}</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color }}>${val.toFixed(2)}</p>
                  <p style={{ color: '#555', fontSize: 11 }}>{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DeFi Positions */}
      {positions.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>DeFi Positions</h3>
          {positions.map((p, i) => {
            const isAave = p.protocol === 'Aave V3';
            const currentBalance = isAave ? (aaveBalance ?? p.deposited) : p.deposited;
            const earned = Math.max(0, currentBalance - p.deposited);
            const color = isAave ? '#4488ff' : '#aa44ff';

            return (
              <div key={i} style={{
                padding: 16, marginBottom: 8,
                background: '#0a0a12', borderRadius: 10,
                border: `1px solid ${color}33`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: `${color}18`, border: `1px solid ${color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color,
                    }}>
                      {isAave ? 'A' : p.protocol[0]}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{p.protocol}</p>
                      <p style={{ color: '#666', fontSize: 11 }}>{p.asset} Pool</p>
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 6,
                    background: '#00d4aa18', border: '1px solid #00d4aa33',
                    color: '#00d4aa', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center',
                  }}>
                    {p.currentApy}% APY
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ color: '#666', fontSize: 11, marginBottom: 2 }}>Deposited</p>
                    <p style={{ fontSize: 16, fontWeight: 600 }}>${p.deposited.toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#666', fontSize: 11, marginBottom: 2 }}>Current Value</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color }}>${currentBalance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#666', fontSize: 11, marginBottom: 2 }}>Earned</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: earned > 0 ? '#00d4aa' : '#888' }}>
                      {earned > 0 ? '+' : ''}${earned.toFixed(4)}
                    </p>
                  </div>
                </div>

                {isAave ? (
                  <p style={{ color: '#555', fontSize: 10, marginTop: 8, fontStyle: 'italic' }}>
                    aUSDT on your wallet — yield accrues automatically every block
                  </p>
                ) : (
                  <button
                    onClick={async () => {
                      if (!confirm(`Withdraw $${p.deposited} from ${p.protocol}?`)) return;
                      try {
                        const r = await fetch(`${API_BASE}/api/agent/withdraw/${ownerAddress}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ positionIndex: i }),
                        });
                        const data = await r.json();
                        if (data.ok) {
                          alert(`Withdrawn $${data.amount} USDT. TX: ${data.txHash.slice(0, 14)}...`);
                          window.location.reload();
                        } else {
                          alert(`Withdraw failed: ${data.error}`);
                        }
                      } catch (e) {
                        alert(`Error: ${e}`);
                      }
                    }}
                    style={{
                      marginTop: 12,
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: '#ff444418',
                      border: '1px solid #ff444433',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Withdraw ${p.deposited.toFixed(2)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Loans */}
      {loans.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Loans</h3>
          {loans.map((l, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid #1a1a22',
              fontSize: 13,
            }}>
              <span>
                <span style={{ fontWeight: 600 }}>{l.borrowerName}</span>
                <span style={{
                  marginLeft: 8, fontSize: 11,
                  padding: '2px 6px', borderRadius: 4,
                  background: l.status === 'active' ? '#00d4aa22' : l.status === 'overdue' ? '#ff444422' : '#88888822',
                  color: l.status === 'active' ? '#00d4aa' : l.status === 'overdue' ? '#ff4444' : '#888',
                }}>
                  {l.status}
                </span>
              </span>
              <span>${l.principal} — due {new Date(l.dueDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
      {/* Debug: Reset */}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #1a1a22' }}>
        <button
          onClick={async () => {
            if (!confirm('Reset ALL data for this account? (audit, state, positions, budgets)')) return;
            await fetch(`${API_BASE}/api/agent/reset/${ownerAddress}`, { method: 'DELETE' });
            window.location.reload();
          }}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            background: 'transparent',
            border: '1px solid #333',
            color: '#555',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Reset account data
        </button>
      </div>
    </div>
  );
}
