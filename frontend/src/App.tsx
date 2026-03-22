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
import { VaultTab } from './pages/VaultTab';
import { AuditFeed } from './components/AuditFeed';
import { ConnectWallet } from './components/ConnectWallet';
import { useWriteContract } from 'wagmi';
import { USDT_CONTRACT, USDT_ABI } from './wagmi';

// ── inject font + global styles ──
if (typeof document !== 'undefined' && !document.querySelector('[data-omni-font]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap';
  link.setAttribute('data-omni-font', '1');
  document.head.appendChild(link);

  // Inject global styles for scrollbar + blink animation + scanline
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #000; color: #ccc; }
    body { font-family: 'JetBrains Mono', monospace; }

    /* Terminal blink */
    @keyframes termBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* Scanline overlay */
    body::after {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 9999;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,255,136,0.01) 2px,
        rgba(0,255,136,0.01) 4px
      );
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #0a0a0a; }
    ::-webkit-scrollbar-thumb { background: #222; border-radius: 0; }
    ::-webkit-scrollbar-thumb:hover { background: #333; }

    /* Selection */
    ::selection { background: #00ff8833; color: #fff; }

    /* Table row hover */
    tbody tr:hover { background: #111 !important; }
  `;
  document.head.appendChild(style);
}

type Tab = 'overview' | 'borrowers' | 'loans' | 'vault' | 'activity';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',  label: 'OVERVIEW' },
  { key: 'borrowers', label: 'BORROWERS' },
  { key: 'loans',     label: 'LOANS' },
  { key: 'vault',     label: 'VAULT' },
  { key: 'activity',  label: 'ACTIVITY' },
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

  // ── Not connected: show landing ──
  if (!isConnected) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: spacing.xxl, fontFamily: fonts.mono }}>
        <Landing />
      </div>
    );
  }

  // ── Not set up: show setup flow ──
  if (!agentReady) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: spacing.xxl, fontFamily: fonts.mono }}>
        <SetupFlow ownerAddress={address!} onReady={(op) => { setOperatorAddress(op); setAgentReady(true); }} />
      </div>
    );
  }

  const c = colors, s = spacing, f = fontSizes;
  const bal = status?.balance?.usdt ?? 0;
  const loans = status?.loans ?? [];
  const activeCount = loans.filter(l => l.status === 'active').length;

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto',
      padding: `0 ${s.lg}px`,
      minHeight: '100vh', fontFamily: fonts.mono,
    }}>

      {/* ══ Top bar ══════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `${s.md}px 0`,
        borderBottom: `1px solid ${c.border}`,
      }}>
        <span style={{
          fontSize: f.lg, fontWeight: 700, color: c.accent,
          letterSpacing: '-0.02em',
          textShadow: `0 0 20px ${c.accent}33`,
        }}>
          OMNILENDER
        </span>

        {/* Right: wallet */}
        <ConnectWallet />
      </div>

      {/* ══ Tab bar ══════════════════════════════════════════════════ */}
      <nav style={{
        display: 'flex', gap: 0,
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
                color: active ? c.accent : c.textMuted,
                fontSize: 9, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: fonts.mono,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                transition: 'color 0.1s',
              }}
            >
              {t.label}
            </button>
          );
        })}

        {/* Right-aligned system time */}
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center',
          fontSize: 9, color: c.textMuted, fontVariantNumeric: 'tabular-nums',
          padding: `0 ${s.sm}px`,
          gap: s.sm,
        }}>
          <SystemClock />
        </div>
      </nav>

      {/* ══ Content ══════════════════════════════════════════════════ */}
      <div style={{ padding: `${s.lg}px 0` }}>
        {tab === 'overview' && (
          <OverviewTab status={status} ownerAddress={address!} lendingStats={lendingStats} onGoToActivity={() => setTab('activity')} />
        )}
        {tab === 'borrowers' && (
          <BorrowersTab lendingStats={lendingStats} />
        )}
        {tab === 'loans' && (
          <LendingTab />
        )}
        {tab === 'vault' && (
          <VaultTab lendingStats={lendingStats} ownerAddress={address!} />
        )}
        {tab === 'activity' && (
          <div style={{
            background: c.bgCard,
            border: `1px solid ${c.border}`,
            borderRadius: radii.sm,
            padding: s.lg,
          }}>
            <AuditFeed ownerAddress={address!} />
          </div>
        )}
      </div>

      {/* ══ Footer bar ═══════════════════════════════════════════════ */}
      <div style={{
        borderTop: `1px solid ${c.border}`,
        padding: `${s.sm}px 0`,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 9, color: c.textMuted,
        letterSpacing: '0.05em',
      }}>
        <span>SEPOLIA TESTNET</span>
        <span>OMNILENDER v1.0</span>
      </div>
    </div>
  );
}

// ── System clock component ──
function SystemClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <span>
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </span>
  );
}
