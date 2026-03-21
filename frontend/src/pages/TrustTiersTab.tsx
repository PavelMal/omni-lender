import { useState } from 'react';
import { colors, spacing, radii, fontSizes } from '../styles/tokens';
import { cardStyle, inputStyle, buttonStyle } from '../styles/common';
import { API_BASE } from '../api';

const TIERS = [
  { tier: 0, name: 'New',      pct: 150, color: '#ff4444', req: 'Default for new borrowers', emoji: '' },
  { tier: 1, name: 'Bronze',   pct: 120, color: '#ffaa00', req: '1+ loans repaid, 0 defaults', emoji: '' },
  { tier: 2, name: 'Silver',   pct: 80,  color: '#4488ff', req: '3+ loans repaid, 0 defaults', emoji: '' },
  { tier: 3, name: 'Gold',     pct: 50,  color: '#aa44ff', req: '5+ repaid, $100+ total, 0 defaults', emoji: '' },
  { tier: 4, name: 'Platinum', pct: 0,   color: '#00d4aa', req: '10+ repaid, $500+ total, avg >= $25, 0 defaults', emoji: '' },
];

interface CreditProfile {
  creditScore: number;
  trustTier: { tier: number; name: string; collateralPercent: number };
  totalLoans: number;
  repaidLoans: number;
  defaultedLoans: number;
  totalBorrowed: number;
  totalInterestPaid: number;
  collateralRequired: string;
  maxUncollateralizedLoan: number;
  riskMetrics: {
    avgLoanSize: number;
    exposureCapUsed: string;
    defaultRate: string;
  };
}

export function TrustTiersTab() {
  const [address, setAddress] = useState('');
  const [profile, setProfile] = useState<CreditProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookupProfile = async () => {
    if (!address.startsWith('0x') || address.length < 10) {
      setError('Enter a valid Ethereum address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // This would call the MCP tool via backend API
      // For now, show the tier system explanation
      setProfile({
        creditScore: 30,
        trustTier: { tier: 0, name: 'New', collateralPercent: 150 },
        totalLoans: 0,
        repaidLoans: 0,
        defaultedLoans: 0,
        totalBorrowed: 0,
        totalInterestPaid: 0,
        collateralRequired: '150%',
        maxUncollateralizedLoan: 0,
        riskMetrics: { avgLoanSize: 0, exposureCapUsed: '0%', defaultRate: '0%' },
      });
    } catch {
      setError('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      {/* Trust Tiers Visualization */}
      <div style={cardStyle()}>
        <h3 style={{
          fontSize: fontSizes.lg,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: spacing.xs,
        }}>
          Trust Tier System
        </h3>
        <p style={{
          fontSize: fontSizes.sm,
          color: colors.textMuted,
          marginBottom: spacing.xl,
        }}>
          Collateral requirements decrease as borrowers build repayment history. Any default resets to Tier 0.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {TIERS.map((t, i) => {
            const isActive = profile?.trustTier.tier === t.tier;
            return (
              <div key={t.tier} style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                padding: `${spacing.md}px ${spacing.lg}px`,
                background: isActive ? `${t.color}12` : colors.bgInset,
                border: `1px solid ${isActive ? `${t.color}44` : colors.border}`,
                borderRadius: radii.md,
                transition: 'all 0.2s ease',
              }}>
                {/* Tier badge */}
                <div style={{
                  width: 44, height: 44,
                  borderRadius: radii.md,
                  background: `${t.color}18`,
                  border: `2px solid ${t.color}${isActive ? '' : '44'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: t.color }}>T{t.tier}</span>
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: fontSizes.md, color: isActive ? t.color : colors.textPrimary }}>
                      {t.name}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: t.color,
                        background: `${t.color}25`,
                        padding: '2px 8px',
                        borderRadius: radii.pill,
                      }}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: fontSizes.xs, color: colors.textMuted }}>{t.req}</p>
                </div>

                {/* Collateral % */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{
                    fontSize: fontSizes.xl,
                    fontWeight: 800,
                    color: t.color,
                    lineHeight: 1,
                  }}>
                    {t.pct}%
                  </p>
                  <p style={{ fontSize: fontSizes.xs, color: colors.textMuted }}>
                    {t.pct === 0 ? 'No collateral' : 'collateral'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Anti-Abuse Protection */}
      <div style={{
        ...cardStyle(),
        borderColor: `${colors.red}22`,
      }}>
        <h3 style={{
          fontSize: fontSizes.lg,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: spacing.md,
        }}>
          Anti-Abuse Protection
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing.md,
        }}>
          {[
            {
              title: 'Default = Reset',
              desc: 'Any single default permanently resets borrower to Tier 0',
              color: colors.red,
            },
            {
              title: 'Avg Loan Size Gate',
              desc: 'Tier 4 requires average loan >= $25. Can\'t farm with micro-loans.',
              color: colors.orange,
            },
            {
              title: 'Exposure Cap',
              desc: 'Max uncollateralized = 20% of total repaid volume',
              color: colors.blue,
            },
            {
              title: 'Size Limit',
              desc: 'Max single loan = 3x average historical loan size',
              color: colors.purple,
            },
          ].map(item => (
            <div key={item.title} style={{
              padding: spacing.md,
              background: colors.bgInset,
              borderRadius: radii.md,
              borderLeft: `3px solid ${item.color}`,
            }}>
              <p style={{ fontSize: fontSizes.md, fontWeight: 700, color: item.color, marginBottom: spacing.xs }}>
                {item.title}
              </p>
              <p style={{ fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Attack scenario */}
        <div style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          background: '#0a0a14',
          borderRadius: radii.md,
          border: `1px solid ${colors.border}`,
        }}>
          <p style={{ fontSize: fontSizes.sm, fontWeight: 700, color: colors.textSecondary, marginBottom: spacing.sm }}>
            Attack scenario: 10 loans x $1 each, repay all, then request $100,000
          </p>
          <div style={{ fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 1.8 }}>
            <p>avgLoanSize = $10/10 = <span style={{ color: colors.red, fontWeight: 700 }}>$1</span> — Tier 4 requires &gt;= $25 — <span style={{ color: colors.red }}>DENIED</span></p>
            <p>Even if Tier 4: max = min($1 x 3, $10 x 20%, $100) = <span style={{ color: colors.brand, fontWeight: 700 }}>$2 maximum</span></p>
            <p>To get $100 uncollateralized: need 10+ loans, $500+ total, avg &gt;= $25, 0 defaults</p>
          </div>
        </div>
      </div>

      {/* LLM Negotiation Explainer */}
      <div style={cardStyle()}>
        <h3 style={{
          fontSize: fontSizes.lg,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: spacing.md,
        }}>
          LLM Loan Negotiation
        </h3>
        <p style={{
          fontSize: fontSizes.sm,
          color: colors.textMuted,
          marginBottom: spacing.lg,
        }}>
          Borrowers negotiate loan terms with the agent via Claude. Up to 5 rounds of bargaining.
        </p>

        {/* Example negotiation */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.sm,
        }}>
          {[
            { role: 'Borrower', msg: '$5 at 1% for 30 days', color: colors.blue },
            { role: 'Agent', msg: '$5 at 12% for 30 days — "New borrower, no history. 12% reflects risk premium."', color: colors.purple },
            { role: 'Borrower', msg: '$5 at 6.5% for 30 days', color: colors.blue },
            { role: 'Agent', msg: '$5 at 9.5% for 30 days — "Meeting halfway, 9.5% is within required range."', color: colors.purple },
            { role: 'Borrower', msg: 'Accepts $5 at 9.5% for 30 days', color: colors.blue },
            { role: 'Agent', msg: 'AGREED. Borrower can now call wdk_request_loan.', color: colors.brand },
          ].map((step, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: spacing.md,
              alignItems: 'flex-start',
            }}>
              <span style={{
                fontSize: fontSizes.xs,
                fontWeight: 700,
                color: step.color,
                background: `${step.color}15`,
                padding: '2px 8px',
                borderRadius: radii.pill,
                flexShrink: 0,
                marginTop: 2,
              }}>
                {step.role}
              </span>
              <p style={{
                fontSize: fontSizes.sm,
                color: colors.textSecondary,
                lineHeight: 1.5,
              }}>
                {step.msg}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MCP Tools */}
      <div style={cardStyle()}>
        <h3 style={{
          fontSize: fontSizes.lg,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: spacing.md,
        }}>
          MCP Tools (Agent-to-Agent Protocol)
        </h3>
        <p style={{
          fontSize: fontSizes.sm,
          color: colors.textMuted,
          marginBottom: spacing.lg,
        }}>
          External AI agents connect via MCP (SSE) and use these tools to interact with the lending system.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: spacing.sm,
        }}>
          {[
            { name: 'wdk_get_credit_profile', desc: 'Check credit score, trust tier, and loan history' },
            { name: 'wdk_negotiate_loan', desc: 'Multi-round LLM negotiation of loan terms' },
            { name: 'wdk_get_lending_terms', desc: 'Get escrow address, rates, trust tier table' },
            { name: 'wdk_request_loan', desc: 'Request USDT loan with ETH collateral' },
            { name: 'wdk_repay_loan', desc: 'Repay loan, collateral returned on-chain' },
            { name: 'wdk_get_loans', desc: 'List active loans, check overdue status' },
          ].map(tool => (
            <div key={tool.name} style={{
              padding: spacing.md,
              background: colors.bgInset,
              borderRadius: radii.sm,
              border: `1px solid ${colors.border}`,
            }}>
              <p style={{
                fontSize: fontSizes.sm,
                fontWeight: 700,
                color: colors.brand,
                fontFamily: 'monospace',
                marginBottom: spacing.xs,
              }}>
                {tool.name}
              </p>
              <p style={{ fontSize: fontSizes.xs, color: colors.textMuted }}>
                {tool.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
