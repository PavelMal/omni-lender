import { useState } from 'react';
import { AgentStatus } from '../hooks/useAgent';
import { API_BASE } from '../api';
import { colors, spacing, radii, fontSizes } from '../styles/tokens';
import { cardStyle, buttonStyle } from '../styles/common';
import StatCard from '../components/ui/StatCard';
import { Modal } from '../components/ui/Modal';

interface Props {
  status: AgentStatus;
  ownerAddress: string;
}

export function DeFiTab({ status, ownerAddress }: Props) {
  const [withdrawTarget, setWithdrawTarget] = useState<{ index: number; protocol: string; amount: number } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { positions, aaveBalance } = status;

  const totalDeposited = positions.reduce((s, p) => s + p.deposited, 0);
  const totalCurrent = positions.reduce((s, p) => {
    const isAave = p.protocol === 'Aave V3';
    return s + (isAave ? (aaveBalance ?? p.deposited) : p.deposited);
  }, 0);
  const totalEarned = Math.max(0, totalCurrent - totalDeposited);

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/agent/withdraw/${ownerAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionIndex: withdrawTarget.index }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({
          type: 'success',
          message: `Withdrawn $${data.amount} USDT. TX: ${data.txHash.slice(0, 14)}...`,
        });
      } else {
        setFeedback({ type: 'error', message: `Withdraw failed: ${data.error}` });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: `Error: ${e}` });
    } finally {
      setWithdrawing(false);
      setWithdrawTarget(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      {/* Feedback message */}
      {feedback && (
        <div style={{
          padding: `${spacing.md}px ${spacing.lg}px`,
          borderRadius: radii.md,
          background: feedback.type === 'success' ? `${colors.brand}12` : `${colors.red}12`,
          border: `1px solid ${feedback.type === 'success' ? colors.brand : colors.red}33`,
          color: feedback.type === 'success' ? colors.brand : colors.red,
          fontSize: fontSizes.sm,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: fontSizes.lg,
              lineHeight: 1,
              padding: 0,
            }}
          >
            x
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: spacing.md,
      }}>
        <StatCard
          label="Total Deposited"
          value={`$${totalDeposited.toFixed(2)}`}
          color={colors.textSecondary}
          tooltip="Sum of all initial deposits into DeFi protocols"
        />
        <StatCard
          label="Current Value"
          value={`$${totalCurrent.toFixed(2)}`}
          color={colors.blue}
          tooltip="Current total value including yield"
        />
        <StatCard
          label="Total Earned"
          value={`+$${totalEarned.toFixed(4)}`}
          color={colors.brand}
          tooltip="Total yield earned from DeFi positions"
        />
      </div>

      {/* Positions */}
      {positions.length === 0 ? (
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
            No DeFi positions yet
          </p>
          <p style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
            The agent will automatically deploy funds to DeFi protocols when conditions are favorable.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {positions.map((p, i) => {
            const isAave = p.protocol === 'Aave V3';
            const currentBalance = isAave ? (aaveBalance ?? p.deposited) : p.deposited;
            const earned = Math.max(0, currentBalance - p.deposited);
            const protocolColor = isAave ? colors.blue : colors.purple;

            return (
              <div key={i} style={{
                ...cardStyle(protocolColor),
                padding: spacing.xl,
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: spacing.lg,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: radii.sm,
                      background: `${protocolColor}14`,
                      border: `1px solid ${protocolColor}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: fontSizes.md,
                      fontWeight: 800,
                      color: protocolColor,
                    }}>
                      {isAave ? 'A' : p.protocol[0]}
                    </div>
                    <div>
                      <p style={{
                        fontWeight: 700,
                        fontSize: fontSizes.lg,
                        color: colors.textPrimary,
                      }}>
                        {p.protocol}
                      </p>
                      <p style={{
                        color: colors.textMuted,
                        fontSize: fontSizes.sm,
                      }}>
                        {p.asset} Pool
                      </p>
                    </div>
                  </div>
                  <div style={{
                    padding: `${spacing.xs}px ${spacing.md}px`,
                    borderRadius: radii.sm,
                    background: `${colors.brand}14`,
                    border: `1px solid ${colors.brand}33`,
                    color: colors.brand,
                    fontSize: fontSizes.sm,
                    fontWeight: 700,
                  }}>
                    {p.currentApy}% APY
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: spacing.lg,
                  marginBottom: spacing.lg,
                }}>
                  <div>
                    <p style={{
                      color: colors.textMuted,
                      fontSize: fontSizes.xs,
                      marginBottom: spacing.xs,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>
                      Deposited
                    </p>
                    <p style={{
                      fontSize: fontSizes.xl,
                      fontWeight: 700,
                      color: colors.textPrimary,
                    }}>
                      ${p.deposited.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p style={{
                      color: colors.textMuted,
                      fontSize: fontSizes.xs,
                      marginBottom: spacing.xs,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>
                      Current Value
                    </p>
                    <p style={{
                      fontSize: fontSizes.xl,
                      fontWeight: 700,
                      color: protocolColor,
                    }}>
                      ${currentBalance.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p style={{
                      color: colors.textMuted,
                      fontSize: fontSizes.xs,
                      marginBottom: spacing.xs,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>
                      Earned
                    </p>
                    <p style={{
                      fontSize: fontSizes.xl,
                      fontWeight: 700,
                      color: earned > 0 ? colors.brand : colors.textMuted,
                    }}>
                      {earned > 0 ? '+' : ''}${earned.toFixed(4)}
                    </p>
                  </div>
                </div>

                {/* Deposited date + action */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: spacing.md,
                  borderTop: `1px solid ${colors.border}`,
                }}>
                  {isAave ? (
                    <p style={{
                      color: colors.textMuted,
                      fontSize: fontSizes.xs,
                      fontStyle: 'italic',
                    }}>
                      aUSDT on your wallet -- yield accrues automatically every block
                    </p>
                  ) : (
                    <>
                      <p style={{
                        color: colors.textMuted,
                        fontSize: fontSizes.xs,
                      }}>
                        Deposited {new Date(p.depositedAt).toLocaleDateString()}
                      </p>
                      <button
                        onClick={() => setWithdrawTarget({
                          index: i,
                          protocol: p.protocol,
                          amount: p.deposited,
                        })}
                        style={{
                          ...buttonStyle('danger'),
                          fontSize: fontSizes.sm,
                          padding: `${spacing.sm}px ${spacing.lg}px`,
                        }}
                      >
                        Withdraw ${p.deposited.toFixed(2)}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Withdraw confirmation modal */}
      <Modal
        open={withdrawTarget !== null}
        title="Confirm Withdrawal"
        description={
          withdrawTarget
            ? `Withdraw $${withdrawTarget.amount.toFixed(2)} from ${withdrawTarget.protocol}? Funds will be returned to your wallet.`
            : ''
        }
        confirmLabel="Withdraw"
        confirmVariant="danger"
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawTarget(null)}
        loading={withdrawing}
      />
    </div>
  );
}
