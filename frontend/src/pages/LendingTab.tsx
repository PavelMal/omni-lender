import { useState } from 'react';
import { AgentStatus } from '../hooks/useAgent';
import { colors, spacing, radii, fontSizes } from '../styles/tokens';
import { cardStyle, badgeStyle, buttonStyle } from '../styles/common';
import StatCard from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';

type LoanFilter = 'all' | 'active' | 'repaid' | 'overdue';

interface Props {
  status: AgentStatus;
  lendingStats: any;
}

const statusColorMap: Record<string, string> = {
  active: colors.brand,
  repaid: colors.textMuted,
  overdue: colors.red,
};

export function LendingTab({ status, lendingStats }: Props) {
  const [filter, setFilter] = useState<LoanFilter>('all');

  const { loans } = status;
  const totalLoans = lendingStats?.totalLoans ?? loans.length;
  const activeLoans = loans.filter(l => l.status === 'active').length;
  const interestEarned = lendingStats?.totalInterestEarned ?? 0;

  const filteredLoans = filter === 'all'
    ? loans
    : loans.filter(l => l.status === filter);

  const filters: { key: LoanFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'repaid', label: 'Repaid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: spacing.md,
      }}>
        <StatCard
          label="Total Loans"
          value={String(totalLoans)}
          color={colors.purple}
          tooltip="Total number of loans issued by the agent"
        />
        <StatCard
          label="Active Loans"
          value={String(activeLoans)}
          color={colors.orange}
          subtitle={activeLoans > 0 ? 'Currently outstanding' : 'None active'}
        />
        <StatCard
          label="Interest Earned"
          value={`+$${interestEarned.toFixed(2)}`}
          color={colors.brand}
          tooltip="Total interest earned from repaid and active loans"
        />
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: spacing.sm }}>
        {filters.map(f => {
          const isActive = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radii.md,
                border: `1px solid ${isActive ? colors.purple : colors.border}`,
                background: isActive ? `${colors.purple}14` : 'transparent',
                color: isActive ? colors.purple : colors.textSecondary,
                cursor: 'pointer',
                fontSize: fontSizes.sm,
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              {f.label}
              {f.key !== 'all' && (
                <span style={{
                  marginLeft: spacing.xs,
                  fontSize: fontSizes.xs,
                  opacity: 0.7,
                }}>
                  {loans.filter(l => f.key === 'all' || l.status === f.key).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loan list */}
      {filteredLoans.length === 0 ? (
        <div style={{
          ...cardStyle(),
          textAlign: 'center',
          padding: `${spacing.xxxl * 2}px ${spacing.xl}px`,
        }}>
          <p style={{
            fontSize: fontSizes.lg,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}>
            {filter === 'all'
              ? 'No loans issued yet'
              : `No ${filter} loans`}
          </p>
          <p style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
            {filter === 'all'
              ? 'The agent will issue loans from the lending budget when suitable borrowers are found.'
              : 'Try changing the filter to see other loans.'}
          </p>
        </div>
      ) : (
        <div style={cardStyle()}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredLoans.map((loan, i) => {
              const statusColor = statusColorMap[loan.status] ?? colors.textMuted;
              const isOverdue = loan.status === 'overdue';
              const dueDate = new Date(loan.dueDate);
              const now = new Date();
              const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const interest = loan.totalDue - loan.principal;

              return (
                <div key={loan.id || i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: `${spacing.lg}px 0`,
                  borderBottom: i < filteredLoans.length - 1 ? `1px solid ${colors.border}` : 'none',
                }}>
                  {/* Status indicator */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: radii.sm,
                    background: `${statusColor}14`,
                    border: `1px solid ${statusColor}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: radii.pill,
                      background: statusColor,
                    }} />
                  </div>

                  {/* Borrower info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      marginBottom: spacing.xs,
                    }}>
                      <span style={{
                        fontWeight: 700,
                        fontSize: fontSizes.md,
                        color: colors.textPrimary,
                      }}>
                        {loan.borrowerName}
                      </span>
                      <Badge
                        label={loan.status}
                        color={statusColor}
                        pulse={loan.status === 'active'}
                      />
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: spacing.md,
                      fontSize: fontSizes.xs,
                      color: colors.textMuted,
                    }}>
                      <span>Due {dueDate.toLocaleDateString()}</span>
                      {loan.status === 'active' && (
                        <span style={{
                          color: daysUntilDue <= 3 ? colors.orange : colors.textMuted,
                        }}>
                          {daysUntilDue > 0
                            ? `${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} left`
                            : 'Due today'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amounts */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{
                      fontWeight: 700,
                      fontSize: fontSizes.lg,
                      color: colors.textPrimary,
                    }}>
                      ${loan.principal.toFixed(2)}
                    </p>
                    <p style={{
                      fontSize: fontSizes.xs,
                      color: interest > 0 ? colors.brand : colors.textMuted,
                    }}>
                      {interest > 0 ? `+$${interest.toFixed(2)} interest` : 'No interest'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
