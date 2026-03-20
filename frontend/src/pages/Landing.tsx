import { ConnectWallet } from '../components/ConnectWallet';
import { ArchDiagram } from '../components/ArchDiagram';

const modules = [
  {
    icon: 'P',
    color: '#00d4aa',
    title: 'Smart Portfolio',
    desc: 'Multi-asset allocation across USDT, gold-backed XAU₮, and BTC with automatic rebalancing when drift exceeds targets',
  },
  {
    icon: 'Y',
    color: '#aa44ff',
    title: 'Yield Optimization',
    desc: 'Continuously scans DeFi protocols for best risk-adjusted returns and allocates capital with per-position monitoring',
  },
  {
    icon: 'C',
    color: '#4488ff',
    title: 'Credit & Lending',
    desc: 'On-chain credit scoring for peer-to-peer micro-loans with automated interest collection and repayment tracking',
  },
  {
    icon: 'R',
    color: '#ffaa00',
    title: 'Rewards & Tips',
    desc: 'Automatically rewards content creators based on engagement metrics with configurable budgets and revenue splits',
  },
];

const steps = [
  { num: '1', title: 'Connect Wallet', desc: 'Link your wallet on Sepolia' },
  { num: '2', title: 'Fund Your Agent', desc: 'Approve USDT and deposit to agent wallet' },
  { num: '3', title: 'Set & Forget', desc: 'Agent allocates budgets and operates autonomously' },
  { num: '4', title: 'Stay in Control', desc: 'Monitor actions in real time, chat, intervene anytime' },
];

const features = [
  { title: 'Explainable Decisions', desc: 'Every transaction includes AI reasoning — you always know why your money moved' },
  { title: 'Self-Custodial', desc: 'Agent runs its own WDK wallet with BIP-39 seed. Your keys delegate, not transfer, control' },
  { title: 'Spending Guardrails', desc: 'Per-module daily limits, per-transaction caps, and anomaly detection protect against runaway agents' },
  { title: 'Live Audit Stream', desc: 'WebSocket-powered real-time feed of every agent action — nothing happens in the dark' },
  { title: 'On-Chain Verifiable', desc: 'All transactions executed on Ethereum Sepolia and verifiable on Etherscan' },
  { title: 'Conversational Control', desc: 'Chat with your agent to ask about strategy, override decisions, or request manual actions' },
];

export function Landing() {
  return (
    <div>
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '80px 20px 60px' }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          borderRadius: 20,
          background: '#00d4aa15',
          border: '1px solid #00d4aa33',
          color: '#00d4aa',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 24,
        }}>
          Powered by Tether WDK
        </div>

        <h1 style={{
          fontSize: 48,
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 20,
          background: 'linear-gradient(135deg, #00d4aa 0%, #4488ff 50%, #aa44ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Your Personal<br />AI Finance Agent
        </h1>

        <p style={{
          fontSize: 18,
          color: '#888',
          maxWidth: 580,
          margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          Delegate funds to an autonomous agent that manages your portfolio,
          finds yield, issues micro-loans, and rewards creators — 24/7,
          with full transparency and your approval on every dollar.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <ConnectWallet />
        </div>
      </section>

      {/* What it does */}
      <section style={{ padding: '40px 0 60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 8 }}>
          One agent, complete financial autonomy
        </h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 40, fontSize: 15 }}>
          Managing money well requires constant attention. OmniAgent does the work so you don't have to.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {modules.map(m => (
            <div key={m.title} style={{
              background: '#111118',
              border: '1px solid #222',
              borderRadius: 12,
              padding: 24,
            }}>
              <div style={{
                width: 40, height: 40,
                borderRadius: 10,
                background: `${m.color}18`,
                border: `1px solid ${m.color}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800,
                color: m.color,
                marginBottom: 16,
              }}>
                {m.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{m.title}</h3>
              <p style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '40px 0 60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 40 }}>
          How It Works
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}>
          {steps.map(s => (
            <div key={s.num} style={{
              background: '#111118',
              border: '1px solid #222',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center',
            }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: '50%',
                background: '#00d4aa',
                color: '#000',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 12,
              }}>
                {s.num}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: '#888' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section style={{ padding: '40px 0 60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 24 }}>
          Under the Hood
        </h2>
        <div style={{
          background: '#0d0d14',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          <ArchDiagram />
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '40px 0 60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 40 }}>
          Trust, but Verify
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: '#111118',
              border: '1px solid #222',
              borderRadius: 12,
              padding: 20,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        textAlign: 'center',
        padding: '60px 20px',
        background: '#111118',
        border: '1px solid #222',
        borderRadius: 16,
        marginBottom: 40,
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
          Ready to put your money to work?
        </h2>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 15 }}>
          Connect on Sepolia testnet — zero risk, real on-chain execution.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ConnectWallet />
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px 0',
        color: '#444',
        fontSize: 12,
      }}>
        OmniAgent — Built with Tether WDK, OpenClaw, and Claude
      </footer>
    </div>
  );
}
