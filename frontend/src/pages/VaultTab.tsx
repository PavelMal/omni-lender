import { useState, useEffect } from 'react';
import { colors, spacing, radii, fontSizes, fonts } from '../styles/tokens';
import { API_BASE } from '../api';

const c = colors, s = spacing, f = fontSizes;

const LK = ['interest', 'reinvest'];
function isReinvest(e: any): boolean {
  const a = (e.action ?? '').toLowerCase();
  return LK.some(k => a.includes(k));
}

export function VaultTab({ lendingStats, ownerAddress }: { lendingStats: any; ownerAddress: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const profit = lendingStats?.totalInterestEarned ?? 0;

  useEffect(() => {
    fetch(`${API_BASE}/api/agent/audit/${ownerAddress}?limit=50`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setEvents((Array.isArray(d) ? d : []).filter(isReinvest).reverse()))
      .catch(() => {});
  }, [ownerAddress]);

  return (
    <div style={{ fontFamily: fonts.mono, display: 'flex', flexDirection: 'column', gap: s.md }}>

      {/* Vault metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: c.border }}>
        <div style={{ background: c.bgCard, padding: `${s.lg}px ${s.md}px` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em', marginBottom: s.sm }}>
            TOTAL REINVESTED
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: c.accent, fontVariantNumeric: 'tabular-nums' }}>
            ${profit.toFixed(2)}
          </div>
        </div>
        <div style={{ background: c.bgCard, padding: `${s.lg}px ${s.md}px` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em', marginBottom: s.sm }}>
            VAULT TYPE
          </div>
          <div style={{ fontSize: f.sm, fontWeight: 600, color: c.textPrimary }}>
            ERC-4626 SimpleYieldVault
          </div>
          <div style={{ fontSize: f.xs, color: c.textMuted, marginTop: s.xs }}>
            <a
              href="https://sepolia.etherscan.io/address/0x6D250AA419108448409DA37B1027E01e4EedC851"
              target="_blank" rel="noopener noreferrer"
              style={{ color: c.textSecondary, textDecoration: 'none' }}
            >
              0x6D25...C851
            </a>
          </div>
        </div>
        <div style={{ background: c.bgCard, padding: `${s.lg}px ${s.md}px` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em', marginBottom: s.sm }}>
            SOURCE
          </div>
          <div style={{ fontSize: f.sm, fontWeight: 600, color: c.textPrimary }}>
            Loan interest
          </div>
          <div style={{ fontSize: f.xs, color: c.textMuted, marginTop: s.xs }}>
            Auto-deposited after each repayment
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{
        border: `1px solid ${c.border}`, borderRadius: radii.sm,
        background: c.bgCard, padding: s.lg,
      }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em', marginBottom: s.md }}>
          HOW REINVESTMENT WORKS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: s.sm }}>
          {[
            { label: 'Borrower repays', color: c.textSecondary },
            { label: 'Interest separated', color: c.textSecondary },
            { label: 'Deposited into vault', color: c.accent },
            { label: 'Yield compounds', color: c.accent },
          ].map((step, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: s.sm, flex: 1 }}>
              <div style={{
                flex: 1, padding: `${s.sm}px ${s.md}px`,
                background: c.bgInset, border: `1px solid ${c.border}`,
                fontSize: f.xs, color: step.color, textAlign: 'center',
              }}>
                {step.label}
              </div>
              {i < arr.length - 1 && (
                <span style={{ color: c.textMuted, fontSize: f.xs, flexShrink: 0 }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reinvestment history */}
      <div style={{
        border: `1px solid ${c.border}`, borderRadius: radii.sm,
        background: c.bgCard, overflow: 'hidden',
      }}>
        <div style={{
          padding: `${s.sm}px ${s.md}px`, borderBottom: `1px solid ${c.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, letterSpacing: '0.1em' }}>
            REINVESTMENT HISTORY
          </span>
          <span style={{ fontSize: 9, color: c.textMuted }}>[{events.length}]</span>
        </div>

        {events.length === 0 ? (
          <div style={{ padding: `${s.xl}px ${s.md}px`, color: c.textMuted, fontSize: f.xs }}>
            No reinvestments yet
          </div>
        ) : (
          events.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: s.sm,
              padding: `${s.sm}px ${s.md}px`,
              borderBottom: i < events.length - 1 ? `1px solid ${c.border}` : 'none',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: c.accent, boxShadow: `0 0 4px ${c.accent}66`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: f.xs, color: c.accent, fontWeight: 600, flex: 1 }}>
                {(e.action ?? '').replace(/_/g, ' ').toUpperCase()}
              </span>
              {e.amount != null && (
                <span style={{ fontSize: f.xs, color: c.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                  ${e.amount}
                </span>
              )}
              <span style={{ fontSize: 9, color: c.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                {new Date(e.timestamp).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
