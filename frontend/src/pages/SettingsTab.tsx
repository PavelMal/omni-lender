import { useState, useEffect, useCallback } from 'react';
import { AgentStatus } from '../hooks/useAgent';
import { API_BASE } from '../api';
import { colors, spacing, radii, fontSizes } from '../styles/tokens';
import { cardStyle, buttonStyle } from '../styles/common';
import { Modal } from '../components/ui/Modal';

interface Props {
  status: AgentStatus;
  ownerAddress: string;
  onReset: () => void;
}

interface BudgetConfig {
  defi: number;
  lending: number;
  tipping: number;
  reserve: number;
}

const budgetLabels: Record<keyof BudgetConfig, string> = {
  defi: 'DeFi',
  lending: 'Lending',
  tipping: 'Tipping',
  reserve: 'Treasury',
};

const budgetColors: Record<keyof BudgetConfig, string> = {
  defi: colors.blue,
  lending: colors.purple,
  tipping: colors.orange,
  reserve: colors.brand,
};

const budgetDescriptions: Record<keyof BudgetConfig, string> = {
  defi: 'Yield farming and DeFi protocol deposits',
  lending: 'Peer-to-peer lending to verified borrowers',
  tipping: 'Tips to content creators on Rumble',
  reserve: 'Reserved funds held in treasury',
};

export function SettingsTab({ status, ownerAddress, onReset }: Props) {
  const [budgets, setBudgets] = useState<BudgetConfig>({
    defi: 60,
    lending: 20,
    tipping: 10,
    reserve: 10,
  });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Initialize from current status
  useEffect(() => {
    if (status.budgets) {
      const total = Object.values(status.budgets).reduce((s, b) => s + b.allocated, 0);
      if (total > 0) {
        const defiPct = Math.round((status.budgets.defi?.allocated ?? 0) / total * 100);
        const lendingPct = Math.round((status.budgets.lending?.allocated ?? 0) / total * 100);
        const tippingPct = Math.round((status.budgets.tipping?.allocated ?? 0) / total * 100);
        const reservePct = 100 - defiPct - lendingPct - tippingPct;
        setBudgets({
          defi: defiPct,
          lending: lendingPct,
          tipping: tippingPct,
          reserve: Math.max(0, reservePct),
        });
      }
    }
  }, [status.budgets]);

  const handleSliderChange = useCallback((key: keyof BudgetConfig, newVal: number) => {
    setBudgets(prev => {
      const others = (Object.keys(prev) as (keyof BudgetConfig)[]).filter(k => k !== key);
      const oldOthersTotal = others.reduce((s, k) => s + prev[k], 0);
      const remaining = 100 - newVal;

      const next = { ...prev, [key]: newVal };

      if (oldOthersTotal === 0) {
        // Distribute remaining equally
        const each = Math.floor(remaining / others.length);
        others.forEach((k, i) => {
          next[k] = i === others.length - 1 ? remaining - each * (others.length - 1) : each;
        });
      } else {
        // Distribute proportionally
        let distributed = 0;
        others.forEach((k, i) => {
          if (i === others.length - 1) {
            next[k] = Math.max(0, remaining - distributed);
          } else {
            const proportion = prev[k] / oldOthersTotal;
            const val = Math.round(remaining * proportion);
            next[k] = Math.max(0, val);
            distributed += next[k];
          }
        });
      }

      return next;
    });
    setDirty(true);
    setSaveResult(null);
  }, []);

  const handleInputChange = useCallback((key: keyof BudgetConfig, val: string) => {
    const num = Math.max(0, Math.min(100, parseInt(val) || 0));
    handleSliderChange(key, num);
  }, [handleSliderChange]);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/agent/budgets/${ownerAddress}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: budgets }),
      });
      if (res.ok) {
        setSaveResult({ type: 'success', message: 'Budget allocations updated successfully.' });
        setDirty(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveResult({ type: 'error', message: data.error || 'Failed to save budgets.' });
      }
    } catch (e) {
      setSaveResult({ type: 'error', message: `Error: ${e}` });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await fetch(`${API_BASE}/api/agent/reset/${ownerAddress}`, { method: 'DELETE' });
      onReset();
    } catch {
      // Reset will reload anyway
    } finally {
      setResetting(false);
      setShowResetModal(false);
    }
  };

  const total = Object.values(budgets).reduce((s, v) => s + v, 0);
  const isValid = total === 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      {/* Budget Allocation Editor */}
      <div style={cardStyle()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xl,
        }}>
          <div>
            <h3 style={{
              fontSize: fontSizes.lg,
              fontWeight: 700,
              color: colors.textPrimary,
              marginBottom: spacing.xs,
            }}>
              Budget Allocation
            </h3>
            <p style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
              Configure how the agent distributes funds across modules. Must sum to 100%.
            </p>
          </div>
          <div style={{
            fontSize: fontSizes.xxl,
            fontWeight: 800,
            color: isValid ? colors.brand : colors.red,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {total}%
          </div>
        </div>

        {/* Preview bar */}
        <div style={{
          height: 8,
          borderRadius: radii.pill,
          overflow: 'hidden',
          display: 'flex',
          marginBottom: spacing.xxl,
        }}>
          {(Object.keys(budgets) as (keyof BudgetConfig)[]).map(key => (
            <div key={key} style={{
              width: `${budgets[key]}%`,
              height: '100%',
              background: budgetColors[key],
              transition: 'width 0.3s ease',
            }} />
          ))}
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xxl }}>
          {(Object.keys(budgets) as (keyof BudgetConfig)[]).map(key => {
            const color = budgetColors[key];
            return (
              <div key={key}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                }}>
                  <div>
                    <span style={{
                      fontWeight: 700,
                      fontSize: fontSizes.md,
                      color: colors.textPrimary,
                    }}>
                      {budgetLabels[key]}
                    </span>
                    <span style={{
                      marginLeft: spacing.sm,
                      fontSize: fontSizes.xs,
                      color: colors.textMuted,
                    }}>
                      {budgetDescriptions[key]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <input
                      type="number"
                      value={budgets[key]}
                      onChange={e => handleInputChange(key, e.target.value)}
                      min={0}
                      max={100}
                      style={{
                        width: 56,
                        padding: `${spacing.xs}px ${spacing.sm}px`,
                        border: `1px solid ${colors.border}`,
                        borderRadius: radii.sm,
                        background: colors.bgInset,
                        color: colors.textPrimary,
                        fontSize: fontSizes.md,
                        fontWeight: 700,
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                    <span style={{
                      fontSize: fontSizes.sm,
                      color: colors.textMuted,
                    }}>
                      %
                    </span>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={budgets[key]}
                    onChange={e => handleSliderChange(key, parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      height: 6,
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      background: `linear-gradient(to right, ${color} 0%, ${color} ${budgets[key]}%, ${colors.bgInset} ${budgets[key]}%, ${colors.bgInset} 100%)`,
                      borderRadius: radii.pill,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Save feedback */}
        {saveResult && (
          <div style={{
            marginTop: spacing.lg,
            padding: `${spacing.sm}px ${spacing.md}px`,
            borderRadius: radii.sm,
            background: saveResult.type === 'success' ? `${colors.brand}12` : `${colors.red}12`,
            border: `1px solid ${saveResult.type === 'success' ? colors.brand : colors.red}33`,
            color: saveResult.type === 'success' ? colors.brand : colors.red,
            fontSize: fontSizes.sm,
          }}>
            {saveResult.message}
          </div>
        )}

        {/* Save button */}
        <div style={{ marginTop: spacing.xl, display: 'flex', gap: spacing.md }}>
          <button
            onClick={handleSave}
            disabled={saving || !isValid || !dirty}
            style={{
              ...buttonStyle('primary'),
              opacity: (saving || !isValid || !dirty) ? 0.5 : 1,
              cursor: (saving || !isValid || !dirty) ? 'not-allowed' : 'pointer',
              fontSize: fontSizes.md,
              padding: `${spacing.md}px ${spacing.xxl}px`,
            }}
          >
            {saving ? 'Saving...' : 'Save Allocation'}
          </button>
          {!isValid && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: fontSizes.sm,
              color: colors.red,
            }}>
              Total must equal 100% (currently {total}%)
            </span>
          )}
        </div>
      </div>

      {/* Agent Configuration */}
      <div style={cardStyle()}>
        <h3 style={{
          fontSize: fontSizes.lg,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: spacing.lg,
        }}>
          Agent Configuration
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${spacing.md}px ${spacing.lg}px`,
            background: colors.bgInset,
            borderRadius: radii.md,
          }}>
            <div>
              <p style={{
                fontWeight: 600,
                fontSize: fontSizes.md,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}>
                Auto-Cycle
              </p>
              <p style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
                Automatically run investment cycles on a timer
              </p>
            </div>
            <div style={{
              padding: `${spacing.xs}px ${spacing.md}px`,
              borderRadius: radii.pill,
              background: status.autoCycle ? `${colors.brand}18` : `${colors.textMuted}18`,
              border: `1px solid ${status.autoCycle ? colors.brand : colors.textMuted}33`,
              color: status.autoCycle ? colors.brand : colors.textMuted,
              fontSize: fontSizes.sm,
              fontWeight: 700,
            }}>
              {status.autoCycle ? 'Enabled' : 'Disabled'}
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${spacing.md}px ${spacing.lg}px`,
            background: colors.bgInset,
            borderRadius: radii.md,
          }}>
            <div>
              <p style={{
                fontWeight: 600,
                fontSize: fontSizes.md,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}>
                Agent Status
              </p>
              <p style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
                Whether the agent is currently active and managing funds
              </p>
            </div>
            <div style={{
              padding: `${spacing.xs}px ${spacing.md}px`,
              borderRadius: radii.pill,
              background: status.active ? `${colors.brand}18` : `${colors.red}18`,
              border: `1px solid ${status.active ? colors.brand : colors.red}33`,
              color: status.active ? colors.brand : colors.red,
              fontSize: fontSizes.sm,
              fontWeight: 700,
            }}>
              {status.active ? 'Active' : 'Inactive'}
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${spacing.md}px ${spacing.lg}px`,
            background: colors.bgInset,
            borderRadius: radii.md,
          }}>
            <div>
              <p style={{
                fontWeight: 600,
                fontSize: fontSizes.md,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}>
                Operator Address
              </p>
              <p style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
                The backend wallet executing transactions on your behalf
              </p>
            </div>
            <span style={{
              fontFamily: 'monospace',
              fontSize: fontSizes.sm,
              color: colors.textSecondary,
              background: colors.bgInset,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              borderRadius: radii.sm,
              border: `1px solid ${colors.border}`,
            }}>
              {status.operatorAddress
                ? `${status.operatorAddress.slice(0, 8)}...${status.operatorAddress.slice(-6)}`
                : 'Not assigned'}
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{
        ...cardStyle(),
        borderColor: `${colors.red}44`,
      }}>
        <h3 style={{
          fontSize: fontSizes.lg,
          fontWeight: 700,
          color: colors.red,
          marginBottom: spacing.sm,
        }}>
          Danger Zone
        </h3>
        <p style={{
          fontSize: fontSizes.sm,
          color: colors.textMuted,
          marginBottom: spacing.xl,
        }}>
          These actions are irreversible. Proceed with caution.
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.lg,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${spacing.md}px ${spacing.lg}px`,
            background: `${colors.red}08`,
            borderRadius: radii.md,
            border: `1px solid ${colors.red}22`,
          }}>
            <div>
              <p style={{
                fontWeight: 600,
                fontSize: fontSizes.md,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}>
                Reset Account
              </p>
              <p style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
                Clears all data: audit log, positions, loans, budgets, and state. Cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              style={{
                ...buttonStyle('danger'),
                fontSize: fontSizes.sm,
                padding: `${spacing.sm}px ${spacing.lg}px`,
                flexShrink: 0,
              }}
            >
              Reset Account
            </button>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${spacing.md}px ${spacing.lg}px`,
            background: `${colors.red}08`,
            borderRadius: radii.md,
            border: `1px solid ${colors.red}22`,
          }}>
            <div>
              <p style={{
                fontWeight: 600,
                fontSize: fontSizes.md,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}>
                Revoke Allowance
              </p>
              <p style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>
                To revoke the agent's USDT allowance, use the Approve USDT panel and set the allowance to 0,
                or use MetaMask to revoke the token approval directly.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reset confirmation modal */}
      <Modal
        open={showResetModal}
        title="Reset Account Data"
        description="This will permanently delete all agent data including audit logs, DeFi positions, loans, budget allocations, and state. Your wallet funds are not affected. This action cannot be undone."
        confirmLabel="Reset Everything"
        confirmVariant="danger"
        onConfirm={handleReset}
        onCancel={() => setShowResetModal(false)}
        loading={resetting}
      />
    </div>
  );
}
