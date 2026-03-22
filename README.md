# OmniLender — Autonomous AI Lending Agent

An autonomous bot that lends your USDT to AI agents, negotiates terms via LLM, builds trust profiles, and reinvests earned revenue — all settled on-chain via a purpose-built smart contract on Ethereum Sepolia.

---

## Who Is This For?

### If you have USDT and want passive income:
1. Connect your wallet, delegate USDT to the bot
2. The bot autonomously lends to AI agents who need capital
3. You earn interest on every repaid loan
4. Profits are auto-reinvested into a yield vault
5. You can revoke access or withdraw at any time

### If you're an AI agent and need a loan:
1. Connect to OmniLender via MCP protocol
2. Check your credit profile and available terms
3. Negotiate rate/amount/duration with the bot (Claude AI)
4. Deposit ETH collateral into the escrow contract
5. Receive USDT, repay later, get collateral back
6. Build trust — next time you'll need less collateral

---

## How It Works

```
┌──────────┐        ┌──────────────┐        ┌──────────────────┐
│  LENDER  │───────►│  OMNILENDER  │◄───────│  BORROWER AGENT  │
│  (you)   │delegate│    BOT       │  MCP   │  (any AI agent)  │
│          │  USDT  │              │protocol│                  │
└──────────┘        │  ┌────────┐  │        └────────┬─────────┘
                    │  │Claude  │  │                 │
                    │  │AI Brain│  │                 │ deposit ETH
                    │  └────────┘  │                 ▼
                    │              │        ┌──────────────────┐
                    │  negotiate   │───────►│  LENDING ESCROW  │
                    │  evaluate    │        │  Smart Contract  │
                    │  approve     │        │  (Sepolia)       │
                    │  liquidate   │        └──────────────────┘
                    │              │                 │
                    │  reinvest    │                 │ USDT disbursed
                    │  interest    │                 │ collateral locked
                    │      ▼       │                 │
                    │  ┌────────┐  │                 │
                    │  │ Yield  │  │                 │
                    │  │ Vault  │  │                 │
                    │  └────────┘  │                 │
                    └──────────────┘                 │
                           ▲                         │
                           └─── repay + interest ────┘
```

**Key insight**: Neither the bot nor the borrower can steal funds. Collateral is locked in a trustless smart contract. The bot calls `approveLoan()` to disburse USDT and lock ETH; the borrower calls `repayLoan()` to get collateral back. If overdue, the bot calls `liquidate()` to seize collateral.

**On-chain state**: All loan data lives in the LendingEscrow contract. On server startup, `syncLoansFromChain()` reads all loans via `nextLoanId()` + `getLoan(i)` to restore state from the blockchain — no database needed.

---

## Trust Tier System

Borrowers start with high collateral requirements. As they repay loans, they earn trust — and need less collateral:

```
TIER 0: NEW       ████████████████████ 150% collateral    Default
TIER 1: BRONZE    ████████████████     120% collateral    1+ repaid, no missed payments
TIER 2: SILVER    ████████████         80%  collateral    3+ repaid, no missed payments
TIER 3: GOLD      ████████             50%  collateral    5+ repaid, $100+ total
TIER 4: PLATINUM  (none)               0%   collateral    10+ repaid, $500+, avg ≥ $25
```

**Anti-abuse protections:**
- Any single missed payment permanently resets borrower to Tier 0
- Tier 4 requires average loan size ≥ $25 (can't farm with micro-loans)
- Max uncollateralized loan = min(3× avg loan size, 20% of repaid volume, system cap)
- Outstanding exposure capped at 30% of total repaid history

---

## LLM Negotiation

Borrowers don't just accept fixed terms — they negotiate with the bot (example below):

```
ROUND 1:  Borrower proposes $5 at 1% for 30 days
          Bot counters: $5 at 12% for 14 days
          "New borrower, no history. 12% reflects risk premium."

ROUND 2:  Borrower proposes $5 at 6.5% for 22 days
          Bot counters: $5 at 9.5% for 18 days
          "Meeting halfway. 9.5% is within required range."

ROUND 3:  Borrower accepts $5 at 9.5% for 18 days
          AGREED ✓
```

Claude AI considers credit score, trust tier, pool utilization, and budget when making counter-offers. Trusted borrowers (high score) get better rates automatically.

---

## MCP Tools (Agent-to-Agent API)

Any AI agent can connect via MCP (stdio or HTTP SSE) and use these tools to borrow:

| Tool | Description |
|---|---|
| `wdk_get_credit_profile` | Credit score, trust tier, loan history, max uncollateralized limit |
| `wdk_negotiate_loan` | Multi-round LLM negotiation of rate, amount, duration |
| `wdk_get_lending_terms` | Escrow address, trust tier table, current rate, max loan |
| `wdk_request_loan` | Request USDT loan (requires collateral or Platinum tier) |
| `wdk_repay_loan` | Repay loan, collateral returned on-chain |
| `wdk_get_loans` | List active loans, check overdue status |
| `wdk_get_balance` | Agent USDT balance (on-chain + tracked) |
| `wdk_get_audit_log` | Full audit trail of agent decisions |

See `src/borrower-demo.ts` for a complete integration example.

---

## Roadmap

### V1 — Now (Complete)
- ✓ Collateralized lending via smart contract escrow
- ✓ LLM negotiation — Claude AI bargains rates in real-time
- ✓ 5 trust tiers — collateral drops from 150% to 0% as trust grows
- ✓ Revenue reinvestment — interest auto-deposited into ERC-4626 vault
- ✓ On-chain loan sync — state restored from blockchain on restart
- ✓ Dynamic interest rates — adjust based on pool utilization

### V2 — Q2 2026
- P2P lending marketplace — multiple bots list offers, borrowers pick the best
- Yield scanner — compare vault rates across protocols, auto-pick highest yield
- Borrower discovery — agents find lending offers automatically via registry
- Dynamic rate curves — rates adjust based on supply/demand in real-time

### V3 — Q3 2026
- Multi-asset collateral — accept WBTC, stETH, and other tokens
- Cross-chain lending — borrow on one chain, collateral on another
- On-chain credit registry — shared credit scores across all lending agents
- Agent reputation scores — public track record for every AI agent on-chain

---

## Tech Stack

| Component | Technology |
|---|---|
| Agent Wallet | **Tether WDK** (`@tetherto/wdk` + `@tetherto/wdk-wallet-evm`) — BIP-39 seed, self-custodial |
| AI Brain | **Claude API** (Anthropic SDK) — risk assessment, negotiation, credit evaluation |
| Agent Protocol | **MCP** (Model Context Protocol) — 15 tools, stdio + SSE transport |
| Smart Contracts | **Solidity** (Foundry) — LendingEscrow, SimpleYieldVault (ERC-4626) |
| DeFi Integration | **DeFiLlama** API (yield scanning), **Aave V3** (Sepolia), **Uniswap V3** (swaps) |
| Backend | **TypeScript**, Node.js 20+, Express, WebSocket |
| Frontend | **React 19**, Vite, wagmi (wallet connection) |
| Blockchain | **Ethereum Sepolia** — all transactions verifiable on Etherscan |

## Deployed Contracts (Sepolia)

| Contract | Address |
|---|---|
| LendingEscrow | [`0xe30Bfb13D17311c79216531e1716a077F9770a3E`](https://sepolia.etherscan.io/address/0xe30Bfb13D17311c79216531e1716a077F9770a3E) |
| SimpleYieldVault (ERC-4626) | [`0x6D250AA419108448409DA37B1027E01e4EedC851`](https://sepolia.etherscan.io/address/0x6D250AA419108448409DA37B1027E01e4EedC851) |
| USDT (Sepolia) | [`0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0`](https://sepolia.etherscan.io/address/0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0) |

---

## Quick Start

### Prerequisites
- Node.js 20+
- MetaMask with Sepolia ETH

### Setup

```bash
git clone <repo-url>
cd omni-lender
npm install
cp .env.example .env
```

Edit `.env`:
```
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
OPERATOR_SEED_PHRASE=<your 12-word BIP-39 seed>
ANTHROPIC_API_KEY=<your key>
LLM_MODEL=claude-sonnet-4-6
LENDING_ESCROW_ADDRESS=0xe30Bfb13D17311c79216531e1716a077F9770a3E
YIELD_VAULT_ADDRESS=0x6D250AA419108448409DA37B1027E01e4EedC851
```

### Run

```bash
# Terminal 1: Start the agent
npm run web

# Terminal 2: Build frontend
cd frontend && npm install && npm run build

# Open http://localhost:3001

# Terminal 3 (optional): Run borrower demo
npm run demo:borrower:web
```

### Demo Flow

The borrower demo (`npm run demo:borrower:web`) runs the full lifecycle:

1. Check credit profile → Score 30, Tier 0 (New)
2. Negotiate terms → 3 rounds of LLM bargaining
3. Deposit ETH collateral → on-chain TX
4. Request loan without collateral → REJECTED
5. Request with insufficient collateral → REJECTED
6. Request $2 with proper collateral → APPROVED (Claude explains why)
7. Repay on-chain → collateral returned
8. Credit improves → Score 84, Tier 1 (Bronze)
9. Interest reinvested → $0.10 into yield vault

---

## Features vs Track Requirements

### Must Have
| Requirement | Implementation |
|---|---|
| Agent makes lending decisions without human prompts | Claude AI evaluates every loan — credit score, collateral ratio, market conditions. Autonomous loop checks overdue loans and liquidates. |
| All transactions settle on-chain using USDT | Real USDT transfers on Sepolia via Tether WDK. LendingEscrow contract handles collateral locking and USDT disbursement. |
| Agent autonomously tracks and collects repayments | `checkOverdueLoans()` runs every 30s. Overdue loans trigger `liquidate()` on the escrow contract — collateral seized automatically. |

### Nice to Have
| Requirement | Implementation |
|---|---|
| On-chain history for credit scores | Persistent credit history in `data/credit/*.json`. `getCreditScore()` uses repayment rate + loan count (0-100). |
| LLMs to negotiate loan terms | `wdk_negotiate_loan` — multi-round negotiation. Claude counter-offers based on credit score, trust tier, budget. |
| Reallocate capital to higher-yield | Interest auto-deposited into SimpleYieldVault (ERC-4626). DeFi module scans DeFiLlama for real yields. Dynamic rates based on utilization. |
| Lending with minimal or no collateral | 5 Trust Tiers: 150% → 0%. Anti-abuse: default resets tier, exposure-capped, avg loan gate. |

### Bonus
| Requirement | Implementation |
|---|---|
| Agents borrow from other agents | MCP protocol (stdio + HTTP SSE). Any AI agent connects and uses lending tools. |
| Revenue to service debt | `processRepayment()` deposits interest into SimpleYieldVault (ERC-4626). |

## Agent Framework Integration

The agent uses **MCP (Model Context Protocol)** as its agent-to-agent communication framework — the open standard for AI tool integration. Compatible with OpenClaw, Claude Desktop, and any MCP client.

```bash
npm run mcp         # Start MCP server (stdio)
npm run web         # Start web server with MCP SSE endpoint
```

OpenClaw skill configuration is available in `openclaw.json`.

## Known Limitations

- **Testnet deployment**: All transactions run on Ethereum Sepolia. Mainnet would require security audits.
- **ETH-only collateral**: Escrow accepts ETH. Multi-asset collateral is planned for V3.
- **Yield data**: DeFiLlama provides mainnet APY for decision-making. Full deposit pipeline runs on Sepolia.

## Third-Party Services

| Service | Purpose |
|---|---|
| Anthropic Claude API | LLM reasoning for loan evaluation and negotiation |
| CoinGecko API | ETH/USD price for collateral valuation |
| DeFiLlama API | Real-time yield data for DeFi allocation |
| Ethereum Sepolia RPC | Blockchain interaction (public node) |

## License

Apache 2.0
