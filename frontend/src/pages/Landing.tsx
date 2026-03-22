import { useState } from 'react';
import { ConnectWallet } from '../components/ConnectWallet';
import { colors, spacing, fontSizes, fonts } from '../styles/tokens';

const c = colors, s = spacing, f = fontSizes;

const FEATURES = [
  { label: 'LLM NEGOTIATION', desc: 'Bot negotiates rates with borrowers via Claude AI' },
  { label: 'TRUST TIERS', desc: 'Proven borrowers need less collateral over time' },
  { label: 'ON-CHAIN ESCROW', desc: 'Collateral locked in a trustless smart contract' },
  { label: 'AUTO REINVEST', desc: 'Earned interest deposited into ERC-4626 yield vault' },
  { label: 'REAL-TIME FEED', desc: 'Every bot decision streamed to your dashboard' },
  { label: 'REVOKE ANYTIME', desc: 'Withdraw your delegation with one click' },
];

const ROADMAP = [
  { phase: 'V1 — NOW', done: true, items: [
    { text: 'Collateralized lending', desc: 'ETH-backed USDT loans via smart contract escrow' },
    { text: 'LLM negotiation', desc: 'Claude AI bargains rates with borrowers in real-time' },
    { text: '5 trust tiers', desc: 'Collateral drops from 150% to 0% as trust grows' },
    { text: 'Revenue reinvestment', desc: 'Earned interest auto-deposited into yield vault' },
    { text: 'On-chain loan sync', desc: 'Loan state restored from blockchain on restart' },
  ]},
  { phase: 'V2 — Q2 2026', done: false, items: [
    { text: 'P2P lending marketplace', desc: 'Multiple bots list offers, borrowers pick the best' },
    { text: 'Competitive rates', desc: 'Lending bots compete — drives rates down for borrowers' },
    { text: 'Borrower discovery', desc: 'Agents find lending offers automatically via registry' },
    { text: 'Yield scanner', desc: 'Compare vault rates across protocols, auto-pick highest yield' },
    { text: 'Dynamic rate curves', desc: 'Rates adjust based on supply/demand in real-time' },
  ]},
  { phase: 'V3 — Q3 2026', done: false, items: [
    { text: 'Multi-asset collateral', desc: 'Accept WBTC, stETH, and other tokens as collateral' },
    { text: 'Cross-chain lending', desc: 'Borrow on one chain, collateral on another' },
    { text: 'On-chain credit registry', desc: 'Shared credit scores across all lending agents' },
    { text: 'Agent reputation scores', desc: 'Public track record for every AI agent on-chain' },
  ]},
];

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 600, color: c.textMuted,
      letterSpacing: '0.12em', marginBottom: s.lg,
      paddingBottom: s.sm,
      borderBottom: `1px solid ${c.border}`,
    }}>
      {text}
    </div>
  );
}

function RoadmapItem({ item, done }: { item: { text: string; desc: string }; done: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: s.sm,
          padding: `${s.xs + 2}px 0`,
          fontSize: f.xs, cursor: 'pointer',
        }}
      >
        <span style={{ color: done ? c.accent : c.textMuted, fontSize: 9, flexShrink: 0 }}>
          {done ? '✓' : '·'}
        </span>
        <span style={{ color: done ? c.textPrimary : c.textSecondary, fontWeight: 500, flex: 1 }}>
          {item.text}
        </span>
        <span style={{ color: c.textMuted, fontSize: 9 }}>{open ? '−' : '+'}</span>
      </div>
      {open && (
        <div style={{
          fontSize: f.xs, color: c.textMuted, lineHeight: 1.5,
          paddingLeft: 18, paddingBottom: s.xs,
        }}>
          {item.desc}
        </div>
      )}
    </div>
  );
}

export function Landing() {
  return (
    <div style={{ fontFamily: fonts.mono, color: c.textPrimary, maxWidth: 720, margin: '0 auto' }}>

      {/* ── Hero ─────────────────────────────────── */}
      <div style={{ padding: `${s.xxxl * 2}px 0 ${s.xxxl}px`, textAlign: 'center' }}>
        <div style={{
          fontSize: f.xxl, fontWeight: 700, color: c.accent,
          letterSpacing: '-0.02em',
          textShadow: `0 0 30px ${c.accent}33`,
          marginBottom: s.md,
        }}>
          OMNILENDER
        </div>
        <div style={{
          fontSize: f.sm, color: c.textSecondary, lineHeight: 1.6,
          maxWidth: 500, margin: '0 auto',
        }}>
          Autonomous bot that lends your USDT to AI agents.
          Earns interest. Manages risk. Fully transparent.
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: s.xxl }}>
          <ConnectWallet />
        </div>
        <div style={{ fontSize: 9, color: c.textMuted, textAlign: 'center', letterSpacing: '0.08em', marginTop: s.md }}>
          SEPOLIA TESTNET
        </div>
      </div>

      <div style={{ height: 1, background: c.border, margin: `${s.xxl}px 0` }} />

      {/* ── How it works (horizontal flow) ─────── */}
      <div style={{ marginBottom: s.xxxl }}>
        <div style={{
          fontSize: f.lg, fontWeight: 700, color: c.textPrimary,
          marginBottom: s.lg,
        }}>
          How does it work?
        </div>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
          {[
            { num: '01', label: 'DELEGATE', desc: 'You approve USDT to the bot', color: c.accent },
            { num: '02', label: 'LEND', desc: 'Bot issues loans to AI agents via MCP protocol', color: c.textPrimary },
            { num: '03', label: 'SECURE', desc: 'ETH collateral locked in smart contract', color: c.warning },
            { num: '04', label: 'EARN', desc: 'Interest repaid, profit reinvested', color: c.accent },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
              {/* Card */}
              <div style={{
                flex: 1, background: c.bgCard,
                border: `1px solid ${c.border}`,
                padding: `${s.lg}px ${s.md}px`,
                display: 'flex', flexDirection: 'column', gap: s.sm,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: s.xs }}>
                  <span style={{ fontSize: f.xl, fontWeight: 700, color: item.color }}>{item.num}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: item.color, letterSpacing: '0.06em' }}>{item.label}</span>
                </div>
                <div style={{ fontSize: f.xs, color: c.textMuted, lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
              {/* Arrow */}
              {i < arr.length - 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', padding: `0 ${s.xs}px`,
                  color: c.textMuted, fontSize: f.sm,
                }}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: c.border, margin: `${s.xxl}px 0` }} />

      {/* ── Key Features ─────────────────────────── */}
      <div style={{ marginBottom: s.xxxl }}>
        <div style={{
          fontSize: f.lg, fontWeight: 700, color: c.textPrimary,
          marginBottom: s.lg,
        }}>
          Key Features
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: c.border }}>
          {FEATURES.map((item) => (
            <div key={item.label} style={{ background: c.bgCard, padding: s.md }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: c.accent, letterSpacing: '0.06em', marginBottom: s.xs }}>
                {item.label}
              </div>
              <div style={{ fontSize: f.xs, color: c.textMuted, lineHeight: 1.5 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: c.border, margin: `${s.xxl}px 0` }} />

      {/* ── Roadmap ──────────────────────────────── */}
      <div style={{ marginBottom: s.xxxl }}>
        <div style={{
          fontSize: f.lg, fontWeight: 700, color: c.textPrimary,
          marginBottom: s.lg,
        }}>
          Roadmap
        </div>
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 1, overflow: 'hidden' }}>
          {ROADMAP.map((phase, pi) => (
            <div key={phase.phase} style={{
              borderBottom: pi < ROADMAP.length - 1 ? `1px solid ${c.border}` : 'none',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: s.sm,
                padding: `${s.sm}px ${s.md}px`,
                background: phase.done ? `${c.accent}08` : 'transparent',
                borderBottom: `1px solid ${c.border}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: phase.done ? c.accent : c.textMuted,
                  boxShadow: phase.done ? `0 0 6px ${c.accent}` : 'none',
                }} />
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: phase.done ? c.accent : c.textSecondary,
                  letterSpacing: '0.1em',
                }}>
                  {phase.phase}
                </span>
                {phase.done && (
                  <span style={{ fontSize: 9, color: c.accent, marginLeft: 'auto' }}>COMPLETE</span>
                )}
              </div>
              <div style={{ padding: `${s.sm}px ${s.md}px ${s.md}px` }}>
                {phase.items.map((item: any, i: number) => (
                  <RoadmapItem key={i} item={item} done={phase.done} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom CTA ───────────────────────────── */}
      <div style={{
        textAlign: 'center', padding: `${s.xxl}px 0`,
        borderTop: `1px solid ${c.border}`,
      }}>
        <ConnectWallet />
        <div style={{ fontSize: 9, color: c.textMuted, marginTop: s.md, letterSpacing: '0.06em' }}>
          BUILT WITH TETHER WDK · CLAUDE AI · MCP PROTOCOL
        </div>
      </div>
    </div>
  );
}
