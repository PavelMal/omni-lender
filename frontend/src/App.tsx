import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { API_BASE } from './wagmi';
import { colors, spacing, radii, fontSizes, fonts } from './styles/tokens';
import { useAgent } from './hooks/useAgent';
import { Landing } from './pages/Landing';
import { SetupFlow } from './components/setup/SetupFlow';
import { OverviewTab } from './pages/OverviewTab';
import { LendingTab } from './pages/LendingTab';
import { BorrowersTab } from './pages/BorrowersTab';
import { AuditFeed } from './components/AuditFeed';
import { ConnectWallet } from './components/ConnectWallet';
import { useWriteContract } from 'wagmi';
import { USDT_CONTRACT, USDT_ABI } from './wagmi';

// ── inject font ──
if (typeof document !== 'undefined' && !document.querySelector('[data-omni-font]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap';
  link.setAttribute('data-omni-font', '1');
  document.head.appendChild(link);
}

type Tab = 'overview' | 'borrowers' | 'loans' | 'activity';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'borrowers', label: 'Borrowers' },
  { key: 'loans',     label: 'Loans' },
  { key: 'activity',  label: 'Activity' },
];

export default function App() {
  const { address, isConnected } = useAccount();
  const [agentReady, setAgentReady] = useState(false);
  const [, setOperatorAddress] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [lendingStats, setLendingStats] = useState<any>(null);
  const { status } = useAgent(isConnected && agentReady ? address! : '');

  useEffect(() => {
    if (!isConnected || !address) return;
    fetch(`${API_BASE}/agent/status/${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.operatorAddress && data?.allowance > 0) {
          setOperatorAddress(data.operatorAddress);
          setAgentReady(true);
        }
      })
      .catch(() => {});
  }, [isConnected, address]);

  useEffect(() => {
    if (!agentReady) return;
    const f = () => fetch(`${API_BASE}/agent/lending-stats`).then(r => r.ok ? r.json() : null).then(setLendingStats).catch(() => {});
    f(); const i = setInterval(f, 5000); return () => clearInterval(i);
  }, [agentReady]);

  if (!isConnected) return <div style={{ maxWidth: 960, margin: '0 auto', padding: spacing.xxl, fontFamily: fonts.body }}><Landing /></div>;

  if (!agentReady) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: spacing.xxl, fontFamily: fonts.body }}>
        <SetupFlow ownerAddress={address!} onReady={(op) => { setOperatorAddress(op); setAgentReady(true); }} />
      </div>
    );
  }

  const c = colors, s = spacing, f = fontSizes, r = radii;
  const bal = status?.balance?.usdt ?? 0;
  const loans = status?.loans ?? [];
  const activeCount = loans.filter(l => l.status === 'active').length;
  const profit = lendingStats?.totalInterestEarned ?? 0;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: `${s.lg}px ${s.lg}px`, minHeight: '100vh', fontFamily: fonts.body }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.xl }}>
        <span style={{ fontSize: f.xl, fontWeight: 700, color: c.textPrimary, fontFamily: fonts.mono, letterSpacing: -1 }}>
          OmniLender
        </span>
        <ConnectWallet />
      </div>

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', gap: 0, marginBottom: s.xl,
        borderBottom: `1px solid ${c.border}`,
      }}>
        {TABS.map(t => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: `${s.sm}px ${s.lg}px`,
                background: 'none', border: 'none',
                borderBottom: active ? `2px solid ${c.accent}` : '2px solid transparent',
                color: active ? c.textPrimary : c.textMuted,
                fontSize: f.sm, fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s ease',
                fontFamily: fonts.body,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* ── Content ─────────────────────────────────────────── */}
      {tab === 'overview' && (
        <OverviewTab status={status} ownerAddress={address!} lendingStats={lendingStats} />
      )}
      {tab === 'borrowers' && (
        <BorrowersTab lendingStats={lendingStats} />
      )}
      {tab === 'loans' && (
        <LendingTab />
      )}
      {tab === 'activity' && (
        <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: r.md, padding: s.lg }}>
          <AuditFeed ownerAddress={address!} />
        </div>
      )}

      <div style={{ height: s.xxl }} />
    </div>
  );
}
