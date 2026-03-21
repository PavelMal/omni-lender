import { ConnectWallet } from '../components/ConnectWallet';

const features = [
  {
    icon: 'E',
    color: '#00d4aa',
    title: 'Smart Contract Escrow',
    desc: 'Trustless collateral management via LendingEscrow. ETH locked on-chain, USDT disbursed automatically. No party can steal funds.',
  },
  {
    icon: 'N',
    color: '#aa44ff',
    title: 'LLM Negotiation',
    desc: 'Borrowers negotiate loan terms with Claude AI. Multi-round bargaining on rate, amount, and duration based on credit score.',
  },
  {
    icon: 'T',
    color: '#4488ff',
    title: 'Trust Tiers',
    desc: 'Graduated collateral: 150% for new borrowers down to 0% for proven agents. Build trust through repayment history.',
  },
  {
    icon: 'R',
    color: '#ffaa00',
    title: 'Revenue Reinvestment',
    desc: 'Earned interest automatically deposited into ERC-4626 yield vault. Agent compounds its own revenue.',
  },
];

const trustTiers = [
  { tier: 0, name: 'New', pct: '150%', color: '#ff4444', width: '100%' },
  { tier: 1, name: 'Bronze', pct: '120%', color: '#ffaa00', width: '80%' },
  { tier: 2, name: 'Silver', pct: '80%', color: '#4488ff', width: '53%' },
  { tier: 3, name: 'Gold', pct: '50%', color: '#aa44ff', width: '33%' },
  { tier: 4, name: 'Platinum', pct: '0%', color: '#00d4aa', width: '0%' },
];

const flow = [
  { num: '1', title: 'Check Credit', desc: 'Agent reads on-chain history and assigns trust tier' },
  { num: '2', title: 'Negotiate Terms', desc: 'Borrower and agent negotiate rate via LLM' },
  { num: '3', title: 'Deposit Collateral', desc: 'ETH locked in LendingEscrow smart contract' },
  { num: '4', title: 'Loan Approved', desc: 'Claude evaluates risk, USDT disbursed on-chain' },
  { num: '5', title: 'Repay & Build Trust', desc: 'Collateral returned, credit score improves' },
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
          Hackathon Galactica — Lending Bot Track
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
          Autonomous AI<br />Lending Agent
        </h1>

        <p style={{
          fontSize: 18,
          color: '#888',
          maxWidth: 620,
          margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          An AI agent that autonomously issues collateralized loans, negotiates terms
          with borrowers via LLM, builds trust profiles, and reinvests earned revenue —
          all settled on-chain with USDT on Ethereum Sepolia.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <ConnectWallet />
        </div>
      </section>

      {/* Core Features */}
      <section style={{ padding: '40px 0 60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 8 }}>
          How Trust Evolves When Agents Control Capital
        </h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 40, fontSize: 15 }}>
          Purpose-built lending protocol for autonomous AI economic actors
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {features.map(m => (
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

      {/* Trust Tiers Visualization */}
      <section style={{ padding: '40px 0 60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 8 }}>
          Graduated Trust System
        </h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 40, fontSize: 15 }}>
          From 150% overcollateralized to fully uncollateralized — earned through repayment history
        </p>

        <div style={{
          background: '#111118',
          border: '1px solid #222',
          borderRadius: 16,
          padding: 32,
          maxWidth: 600,
          margin: '0 auto',
        }}>
          {trustTiers.map((t, i) => (
            <div key={t.tier} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 0',
              borderBottom: i < trustTiers.length - 1 ? '1px solid #1a1a2e' : 'none',
            }}>
              <div style={{
                width: 32, height: 32,
                borderRadius: 8,
                background: `${t.color}18`,
                border: `1px solid ${t.color}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                color: t.color,
                flexShrink: 0,
              }}>
                T{t.tier}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#e0e0e0' }}>{t.name}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: t.color }}>{t.pct} collateral</span>
                </div>
                <div style={{
                  height: 6,
                  background: '#0a0a12',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: t.width,
                    background: t.color,
                    borderRadius: 999,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </div>
          ))}
          <p style={{
            fontSize: 12,
            color: '#555',
            marginTop: 16,
            textAlign: 'center',
          }}>
            Tier 4 (Platinum): Uncollateralized lending — exposure-capped at 20% of proven repayment volume
          </p>
        </div>
      </section>

      {/* Lending Flow */}
      <section style={{ padding: '40px 0 60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 40 }}>
          Lending Flow
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}>
          {flow.map(s => (
            <div key={s.num} style={{
              background: '#111118',
              border: '1px solid #222',
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
            }}>
              <div style={{
                width: 32, height: 32,
                borderRadius: '50%',
                background: '#00d4aa',
                color: '#000',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 800,
                marginBottom: 10,
              }}>
                {s.num}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section style={{
        textAlign: 'center',
        padding: '40px 20px',
        background: '#111118',
        border: '1px solid #222',
        borderRadius: 16,
        marginBottom: 40,
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
          Built With
        </h2>
        <div style={{
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
          flexWrap: 'wrap',
          fontSize: 13,
          color: '#888',
        }}>
          {['Tether WDK', 'Solidity (LendingEscrow)', 'Claude API', 'MCP Protocol', 'ERC-4626 Vault', 'Uniswap V3', 'DeFiLlama'].map(t => (
            <span key={t} style={{
              padding: '6px 14px',
              borderRadius: 20,
              background: '#1a1a2e',
              border: '1px solid #2a2a3e',
            }}>
              {t}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 32 }}>
          <ConnectWallet />
        </div>
      </section>

      <footer style={{
        textAlign: 'center',
        padding: '24px 0',
        color: '#444',
        fontSize: 12,
      }}>
        OmniLender — Autonomous AI Lending Agent
      </footer>
    </div>
  );
}
