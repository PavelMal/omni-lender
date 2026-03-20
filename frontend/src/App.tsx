import { useState, useEffect } from 'react';
import { useAccount, useSwitchChain, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { sepolia } from 'wagmi/chains';
import { USDT_CONTRACT, USDT_ABI, USDT_DECIMALS, API_BASE } from './wagmi';
import { colors, spacing, radii, fontSizes } from './styles/tokens';
import { cardStyle, buttonStyle, badgeStyle } from './styles/common';
import { useAgent } from './hooks/useAgent';
import { ConnectWallet } from './components/ConnectWallet';
import { AgentControls } from './components/AgentControls';
import { AuditFeed } from './components/AuditFeed';
import { Landing } from './pages/Landing';
import { SetupFlow } from './components/setup/SetupFlow';
import { OverviewTab } from './pages/OverviewTab';
import { DeFiTab } from './pages/DeFiTab';
import { LendingTab } from './pages/LendingTab';
import { TippingTab } from './pages/TippingTab';
import { Chat } from './pages/Chat';
import { SettingsTab } from './pages/SettingsTab';
import { TabBar } from './components/ui/TabBar';
import { Badge } from './components/ui/Badge';

type Tab = 'overview' | 'defi' | 'lending' | 'tipping' | 'chat' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'defi', label: 'DeFi' },
  { key: 'lending', label: 'Lending' },
  { key: 'tipping', label: 'Tipping' },
  { key: 'chat', label: 'Chat' },
  { key: 'settings', label: 'Settings' },
];

function AgentStatusBar({ status }: { status: any }) {
  if (!status) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      padding: `${spacing.md}px ${spacing.lg}px`,
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderRadius: radii.md,
      marginBottom: spacing.xl,
      flexWrap: 'wrap',
    }}>
      <Badge
        label={status.active ? 'ACTIVE' : 'INACTIVE'}
        color={status.active ? colors.brand : colors.red}
        pulse={status.active}
      />
      {status.autoCycle && (
        <Badge label="Auto-Cycle" color={colors.blue} />
      )}
      <div style={{ flex: 1 }} />
      <span style={{
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {status.auditCount ?? 0} audit entries
      </span>
      <span style={{
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        fontWeight: 600,
      }}>
        Balance: ${status.balance.usdt.toFixed(2)} USDT
      </span>
    </div>
  );
}

function Header() {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xxl,
      paddingBottom: spacing.lg,
      borderBottom: `1px solid ${colors.border}`,
    }}>
      <div>
        <h1 style={{
          fontSize: fontSizes.xxl,
          fontWeight: 800,
          color: colors.brand,
          letterSpacing: -0.5,
        }}>
          OmniAgent
        </h1>
        <p style={{
          fontSize: fontSizes.sm,
          color: colors.textMuted,
          marginTop: spacing.xs,
        }}>
          Autonomous AI Economic Agent
        </p>
      </div>
      <ConnectWallet />
    </header>
  );
}

function AuditDrawer({
  open,
  onClose,
  ownerAddress,
}: {
  open: boolean;
  onClose: () => void;
  ownerAddress: string;
}) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      maxWidth: 560,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: -1,
        }}
      />
      {/* Drawer panel */}
      <div style={{
        flex: 1,
        background: colors.bgPrimary,
        borderLeft: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideIn 0.2s ease-out',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${spacing.lg}px ${spacing.xl}px`,
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <h2 style={{
            fontSize: fontSizes.xl,
            fontWeight: 700,
            color: colors.textPrimary,
          }}>
            Audit Log
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: `1px solid ${colors.border}`,
              borderRadius: radii.sm,
              color: colors.textSecondary,
              cursor: 'pointer',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: fontSizes.lg,
            }}
          >
            x
          </button>
        </div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing.xl,
        }}>
          <AuditFeed ownerAddress={ownerAddress} />
        </div>
      </div>
    </div>
  );
}

function MainLayout({ ownerAddress }: { ownerAddress: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [lendingStats, setLendingStats] = useState<any>(null);
  const { status, loading } = useAgent(ownerAddress);

  // Fetch lending stats
  useEffect(() => {
    const fetchStats = () => {
      fetch(`${API_BASE}/agent/lending-stats`)
        .then(r => r.ok ? r.json() : null)
        .then(setLendingStats)
        .catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
      }}>
        <p style={{ color: colors.textMuted, fontSize: fontSizes.md }}>
          Loading agent status...
        </p>
      </div>
    );
  }

  if (!status) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
      }}>
        <p style={{ color: colors.textMuted, fontSize: fontSizes.md }}>
          No agent found. Please reconnect.
        </p>
      </div>
    );
  }

  const handleReset = () => {
    window.location.reload();
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            status={status}
            ownerAddress={ownerAddress}
            onShowAudit={() => setAuditDrawerOpen(true)}
            lendingStats={lendingStats}
          />
        );
      case 'defi':
        return <DeFiTab status={status} ownerAddress={ownerAddress} />;
      case 'lending':
        return <LendingTab status={status} lendingStats={lendingStats} />;
      case 'tipping':
        return <TippingTab ownerAddress={ownerAddress} />;
      case 'chat':
        return <Chat ownerAddress={ownerAddress} />;
      case 'settings':
        return (
          <SettingsTab
            status={status}
            ownerAddress={ownerAddress}
            onReset={handleReset}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AgentStatusBar status={status} />
      <AgentControls ownerAddress={ownerAddress} />
      <TabBar
        tabs={TABS.map(t => ({ id: t.key, label: t.label }))}
        active={activeTab}
        onChange={(id: string) => setActiveTab(id as Tab)}
      />
      <div style={{ marginTop: spacing.xl }}>
        {renderTab()}
      </div>
      <AuditDrawer
        open={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        ownerAddress={ownerAddress}
      />
    </>
  );
}

export default function App() {
  const { address, isConnected, chainId } = useAccount();
  const [agentReady, setAgentReady] = useState(false);

  // Check if already approved (has allowance)
  const [operatorAddress, setOperatorAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;
    // Try to get operator address from backend
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

  // Not connected
  if (!isConnected) {
    return (
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${spacing.xxl}px ${spacing.lg}px`,
      }}>
        <Landing />
      </div>
    );
  }

  // Connected but agent not ready
  if (!agentReady) {
    return (
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${spacing.xxl}px ${spacing.lg}px`,
      }}>
        <Header />
        <SetupFlow
          ownerAddress={address!}
          onReady={(opAddr) => {
            setOperatorAddress(opAddr);
            setAgentReady(true);
          }}
        />
      </div>
    );
  }

  // Fully connected and approved
  return (
    <div style={{
      maxWidth: 1040,
      margin: '0 auto',
      padding: `${spacing.xxl}px ${spacing.lg}px`,
    }}>
      <Header />
      <MainLayout ownerAddress={address!} />
    </div>
  );
}
