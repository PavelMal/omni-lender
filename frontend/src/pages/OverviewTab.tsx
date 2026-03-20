import { useState, useEffect } from 'react';
import { AgentStatus } from '../hooks/useAgent';
import { API_BASE } from '../api';
import { colors, spacing, radii, fontSizes } from '../styles/tokens';
import { cardStyle, badgeStyle } from '../styles/common';
import StatCard from '../components/ui/StatCard';

interface Props {
  status: AgentStatus;
  ownerAddress: string;
  onShowAudit: () => void;
  lendingStats: any;
}

const budgetColors: Record<string, string> = {
  defi: colors.blue,
  lending: colors.purple,
  tipping: colors.orange,
  reserve: colors.brand,
};

const budgetLabels: Record<string, string> = {
  defi: 'DeFi',
  lending: 'Lending',
  tipping: 'Tipping',
  reserve: 'Treasury',
};

const budgetTargets: Record<string, number> = {
  defi: 60,
  lending: 20,
  tipping: 10,
  reserve: 10,
};

const holdingColors: Record<string, string> = {
  USDT: '#00d4aa',
  WETH: '#627eea',
  WBTC: '#f7931a',
};

export function OverviewTab({ status, ownerAddress, onShowAudit, lendingStats }: Props) {
  const [recentAudit, setRecentAudit] = useState<any[]>([]);

  useEffect(() => {
    const fetchAudit = () => {
      fetch(`${API_BASE}/api/agent/audit/${ownerAddress}?limit=5`)
        .then(r => r.ok ? r.json() : [])
        .then(data => setRecentAudit(Array.isArray(data) ? data.slice(-5).reverse() : []))
        .catch(() => {});
    };
    fetchAudit();
    const interval = setInterval(fetchAudit, 8000);
    return () => clearInterval(interval);
  }, [ownerAddress]);

  const { balance, allowance, holdings, positions, loans, aaveBalance } = status;

  const totalPortfolio = Object.values(holdings).reduce((s, v) => s + v, 0) + (aaveBalance ?? 0);
  const activeLoans = loans.filter(l => l.status === 'active').length;
  const lendingProfit = lendingStats?.totalInterestEarned ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      {/* Stat cards row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: spacing.md,
      }}>
        <StatCard
          label="USDT Balance"
          value={`$${balance.usdt.toFixed(2)}`}
          color={colors.brand}
          tooltip="Available USDT in your wallet"
        />
        <StatCard
          label="Delegated Allowance"
          value={`$${(allowance ?? 0).toFixed(2)}`}
          color={colors.purple}
          tooltip="Amount the agent is authorized to manage"
        />
        <StatCard
          label="Total Portfolio"
          value={`$${totalPortfolio.toFixed(2)}`}
          color={colors.blue}
          tooltip="Combined value of all holdings and positions"
        />
        <StatCard
          label="DeFi Positions"
          value={String(positions.length)}
          color={colors.blue}
          subtitle={positions.length > 0 ? 'Active' : 'None'}
        />
        <StatCard
          label="Active Loans"
          value={String(activeLoans)}
          color={colors.orange}
          subtitle={`${loans.length} total`}
        />
        {lendingStats && lendingStats.totalLoans > 0 && (
          <StatCard
            label="Lending Profit"
            value={`+$${lendingProfit.toFixed(2)}`}
            color={colors.brand}
            subtitle={`${lendingStats.totalLoans} loan${lendingStats.totalLoans === 1 ? '' : 's'} issued`}
          />
        )}
      </div>

      {/* Budget Allocation */}
      <div style={cardStyle()}>
        <h3 style={{
          fontSize: fontSizes.lg,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: spacing.lg,
        }}>
          Budget Allocation
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {Object.entries(status.budgets).map(([name, b]) => {
            const pct = b.allocated > 0 ? (b.spent / b.allocated) * 100 : 0;
            const target = budgetTargets[name] ?? 0;
            const color = budgetColors[name] ?? colors.textMuted;

            return (
              <div key={name}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: fontSizes.md,
                  marginBottom: spacing.xs,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: radii.sm,
                      background: color,
                    }} />
                    <span style={{ fontWeight: 600, color: colors.textPrimary }}>
                      {budgetLabels[name] ?? name}
                    </span>
                    <span style={{
                      fontSize: fontSizes.xs,
                      color: colors.textMuted,
                      fontWeight: 500,
                    }}>
                      {target}%
                    </span>
                  </div>
                  <span style={{ color: colors.textSecondary, fontSize: fontSizes.sm }}>
                    ${b.spent.toFixed(2)} / ${b.allocated.toFixed(2)}
                  </span>
                </div>
                <div style={{
                  height: 6,
                  background: colors.bgInset,
                  borderRadius: radii.pill,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(pct, 100)}%`,
                    background: pct > 90 ? colors.red : color,
                    borderRadius: radii.pill,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portfolio Holdings */}
      {Object.values(holdings).some(v => v > 0) && (
        <div style={cardStyle()}>
          <h3 style={{
            fontSize: fontSizes.lg,
            fontWeight: 700,
            color: colors.textPrimary,
            marginBottom: spacing.lg,
          }}>
            Portfolio Holdings
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {(() => {
              const total = Object.values(holdings).reduce((s, v) => s + v, 0);
              const entries = Object.entries(holdings).filter(([, val]) => val > 0);

              return entries.map(([asset, val]) => {
                const pct = total > 0 ? (val / total) * 100 : 0;
                const color = holdingColors[asset] ?? colors.textMuted;

                return (
                  <div key={asset}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: spacing.xs,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: radii.sm,
                          background: `${color}18`,
                          border: `1px solid ${color}44`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: fontSizes.xs,
                          fontWeight: 800,
                          color,
                        }}>
                          {asset[0]}
                        </div>
                        <span style={{
                          fontWeight: 600,
                          fontSize: fontSizes.md,
                          color: colors.textPrimary,
                        }}>
                          {asset}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: fontSizes.lg,
                          color,
                        }}>
                          ${val.toFixed(2)}
                        </span>
                        <span style={{
                          marginLeft: spacing.sm,
                          fontSize: fontSizes.sm,
                          color: colors.textMuted,
                        }}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div style={{
                      height: 4,
                      background: colors.bgInset,
                      borderRadius: radii.pill,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: color,
                        borderRadius: radii.pill,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div style={cardStyle()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.lg,
        }}>
          <h3 style={{
            fontSize: fontSizes.lg,
            fontWeight: 700,
            color: colors.textPrimary,
          }}>
            Recent Activity
          </h3>
          <button
            onClick={onShowAudit}
            style={{
              background: 'none',
              border: 'none',
              color: colors.blue,
              fontSize: fontSizes.sm,
              fontWeight: 600,
              cursor: 'pointer',
              padding: `${spacing.xs}px ${spacing.sm}px`,
            }}
          >
            View all
          </button>
        </div>

        {recentAudit.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: fontSizes.md }}>
            No recent activity. The agent will log actions here as it operates.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentAudit.map((e, i) => {
              const statusColor =
                e.status === 'approved' || e.status === 'executed' ? colors.brand :
                e.status === 'rejected' || e.status === 'failed' ? colors.red :
                colors.textMuted;

              return (
                <div key={`${e.timestamp}-${i}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  padding: `${spacing.sm}px 0`,
                  borderBottom: i < recentAudit.length - 1 ? `1px solid ${colors.border}` : 'none',
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: radii.pill,
                    background: statusColor,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: fontSizes.sm,
                    color: statusColor,
                    fontWeight: 600,
                    minWidth: 0,
                  }}>
                    {(e.action ?? '').replace(/_/g, ' ')}
                  </span>
                  {e.amount !== undefined && (
                    <span style={{
                      fontSize: fontSizes.sm,
                      color: colors.textSecondary,
                    }}>
                      ${e.amount} {e.asset ?? 'USDT'}
                    </span>
                  )}
                  <span style={{
                    fontSize: fontSizes.xs,
                    color: colors.textMuted,
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}>
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
