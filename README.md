# OmniLender — Autonomous AI Lending Agent

An autonomous AI agent that issues collateralized USDT loans to other AI agents, negotiates terms via LLM, builds trust profiles over time, and reinvests earned revenue — all settled on-chain via a purpose-built smart contract on Ethereum Sepolia.

Built for **Hackathon Galactica: WDK Edition 1 — Lending Bot Track**.

## Architecture

```
┌─────────────────────┐     MCP Protocol      ┌──────────────────────────┐
│  Borrower AI Agent   │ ◄───────────────────► │     OmniLender Agent     │
│  (any MCP client)    │   stdio / HTTP SSE    │                          │
└──────────┬──────────┘                        │  Claude AI Brain         │
           │                                    │  WDK Wallet (BIP-39)    │
           │  depositCollateral()               │  Policy Engine           │
           │  repayLoan()                       │  Credit Scoring          │
           ▼                                    │  Trust Tier System       │
    ┌───────────────────────────────────────────┴──────────────────────────┐
    │              LendingEscrow Smart Contract (Solidity)                  │
    │              0xe30Bfb13D17311c79216531e1716a077F9770a3E              │
    │                                                                      │
    │  depositCollateral() → approveLoan() → repayLoan() / liquidate()    │
    └──────────────────────────────────────────────────────────────────────┘
                              Ethereum Sepolia
```

**On-chain state**: All loan data lives in the LendingEscrow contract. On server startup, `syncLoansFromChain()` reads all loans via `nextLoanId()` + `getLoan(i)` to restore state from the blockchain — no database needed.

**Key insight**: Neither the agent nor the borrower can steal funds. Collateral is locked in a trustless smart contract. The agent calls `approveLoan()` to disburse USDT and lock ETH; the borrower calls `repayLoan()` to get collateral back. If overdue, the agent calls `liquidate()` to seize collateral.

## Features vs Track Requirements

### Must Have
| Requirement | Implementation |
|---|---|
| Agent makes lending decisions without human prompts | Claude AI evaluates every loan — credit score, collateral ratio, market conditions. Autonomous loop in `main.ts` checks overdue loans and liquidates. |
| All transactions settle on-chain using USDT | Real USDT transfers on Sepolia via Tether WDK. LendingEscrow contract handles collateral locking and USDT disbursement. |
| Agent autonomously tracks and collects repayments | `checkOverdueLoans()` runs every 30s. Overdue loans trigger `liquidate()` on the escrow contract — collateral seized automatically. |

### Nice to Have
| Requirement | Implementation |
|---|---|
| On-chain history for credit scores | Persistent credit history in `data/credit/{address}.json`. Survives server restarts. `getCreditScore()` uses repayment rate + loan count bonus (0-100 scale). |
| LLMs to negotiate loan terms | `wdk_negotiate_loan` MCP tool. Multi-round (up to 5) negotiation — borrower proposes, Claude counter-offers based on credit score, trust tier, budget. Actions: accept/counter/reject. |
| Reallocate capital to higher-yield | Interest from repaid loans automatically deposited into SimpleYieldVault (ERC-4626). DeFi module scans DeFiLlama for real mainnet yields, deposits on Sepolia. Dynamic interest rates adjust based on pool utilization (base × (1 + utilization)). |
| Lending with minimal or no collateral | 5 Trust Tiers: New (150%) → Bronze (120%) → Silver (80%) → Gold (50%) → Platinum (0%). Anti-abuse: any default resets to Tier 0, exposure-capped at 20% of repaid volume, max single loan 3× avg size. |

### Bonus
| Requirement | Implementation |
|---|---|
| Agents borrow from other agents | MCP protocol (stdio + HTTP SSE). Any AI agent connects and uses lending tools. `borrower-demo.ts` demonstrates full borrower agent flow. |
| Revenue to service debt | `processRepayment()` deposits earned interest into SimpleYieldVault (ERC-4626, 5% APY). Audit: "Reinvested $0.10 interest into yield vault". |

## Tech Stack

| Component | Technology |
|---|---|
| Agent Wallet | **Tether WDK** (`@tetherto/wdk` + `@tetherto/wdk-wallet-evm`) — BIP-39 seed, self-custodial |
| AI Brain | **Claude API** (Anthropic SDK) — risk assessment, negotiation, credit evaluation |
| Agent Protocol | **MCP** (Model Context Protocol) — 15 tools, stdio + SSE transport |
| Smart Contracts | **Solidity** (Foundry) — LendingEscrow, SimpleYieldVault (ERC-4626), UsdtPaymaster |
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

## Quick Start

### Prerequisites
- Node.js 20+
- MetaMask with Sepolia ETH

### Setup

```bash
git clone https://github.com/anthropics/omni-lender.git
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

### Run the Lending Agent (backend + UI)

```bash
# Terminal 1: Start the agent web server
npm run web

# Terminal 2: Build and open the dashboard
cd frontend && npm install && npm run build
# Open http://localhost:3001
```

### Run the Borrower Demo

The borrower demo simulates an AI agent requesting a loan through the full lifecycle:

```bash
# Terminal 3: Run borrower agent (connects via MCP SSE, events appear in dashboard)
npm run demo:borrower:web
```

**Demo flow:**
1. Check credit profile (score, trust tier)
2. Negotiate loan terms (3 rounds of LLM bargaining)
3. Deposit ETH collateral into LendingEscrow contract
4. Request rejected — no collateral
5. Request rejected — insufficient collateral
6. Request approved — $2 USDT loan, Claude explains reasoning
7. Borrower repays on-chain — collateral returned
8. Credit score improves, trust tier upgrades
9. Interest reinvested into yield vault

### Run Standalone (no UI)

```bash
# MCP server mode (for external agent integration)
npm run mcp

# Autonomous loop (treasury + DeFi + lending + overdue checks)
npm start
```

## MCP Tools (Agent-to-Agent API)

External AI agents connect via MCP (stdio or SSE) and use these tools:

| Tool | Description |
|---|---|
| `wdk_get_credit_profile` | Credit score, trust tier, loan history, max uncollateralized limit |
| `wdk_negotiate_loan` | Multi-round LLM negotiation of rate, amount, duration |
| `wdk_get_lending_terms` | Escrow address, trust tier table, base rate, max loan |
| `wdk_request_loan` | Request USDT loan (requires collateral or Platinum tier) |
| `wdk_repay_loan` | Repay loan, collateral returned on-chain |
| `wdk_get_loans` | List active loans, check overdue status |
| `wdk_get_balance` | Agent USDT balance (on-chain + tracked) |
| `wdk_get_audit_log` | Full audit trail of agent decisions |

## Trust Tier System

Collateral requirements decrease as borrowers build repayment history:

| Tier | Name | Collateral | Requirements |
|---|---|---|---|
| 0 | New | 150% | Default for first-time borrowers |
| 1 | Bronze | 120% | 1+ loans repaid, 0 defaults |
| 2 | Silver | 80% | 3+ loans repaid, 0 defaults |
| 3 | Gold | 50% | 5+ loans repaid, $100+ total, 0 defaults |
| 4 | Platinum | 0% | 10+ loans repaid, $500+ total, avg ≥ $25, 0 defaults |

**Anti-abuse protections:**
- Any single default permanently resets borrower to Tier 0
- Tier 4 requires average loan size ≥ $25 (can't farm with micro-loans)
- Max uncollateralized loan = min(3× avg loan size, 20% of repaid volume, system cap)
- Outstanding exposure capped at 30% of total repaid history

## Project Structure

```
src/
├── agent/brain.ts          # Claude AI reasoning (risk assessment, negotiation)
├── modules/lending.ts      # Credit scoring, trust tiers, negotiation, loan lifecycle
├── modules/defi.ts         # DeFiLlama scanning, Aave/vault deposits
├── wallet-os/core.ts       # Budget allocation, policy engine, spend requests
├── wallet-os/policy.ts     # Daily limits, per-tx caps, anomaly detection
├── wallet-os/audit.ts      # In-memory + disk audit logging
├── wallet-os/wdk-wallet.ts # Tether WDK integration (BIP-39, EVM)
├── defi/escrow.ts          # LendingEscrow contract interaction
├── defi/erc4626.ts         # ERC-4626 vault adapter (SimpleYieldVault)
├── defi/aave.ts            # Aave V3 Sepolia integration
├── defi/uniswap.ts         # Uniswap V3 swap builder
├── defi/scanner.ts         # DeFiLlama yield scanning
├── mcp-tools.ts            # 15 MCP tool definitions
├── mcp-server.ts           # Standalone MCP server (stdio)
├── web/server.ts           # Express + WebSocket + MCP SSE
├── borrower-demo.ts        # Borrower agent demo script
└── main.ts                 # Autonomous agent loop

contracts/src/
├── LendingEscrow.sol       # Trustless collateral escrow (5/5 tests)
├── SimpleYieldVault.sol    # ERC-4626 yield vault
└── UsdtPaymaster.sol       # Account abstraction paymaster

frontend/src/
├── App.tsx                 # Main layout with tab navigation
├── pages/OverviewTab.tsx   # Dashboard: metrics, trust tiers, activity feed
├── pages/BorrowersTab.tsx  # Borrower table: score, tier, history
├── pages/LendingTab.tsx    # Loan list with filters
└── pages/Landing.tsx       # Landing page
```

## OpenClaw Integration

The agent exposes its lending capabilities as an OpenClaw skill via `openclaw.json`. External agents can discover and use the lending tools through the OpenClaw gateway:

```bash
# Run via OpenClaw gateway
npm run openclaw

# Or connect directly via MCP
npm run mcp
```

The MCP server exposes 15 tools that any MCP-compatible agent framework (OpenClaw, Claude Desktop, custom clients) can use to interact with the lending system.

## Known Limitations

- **Testnet deployment**: All transactions run on Ethereum Sepolia. Mainnet deployment would require security audits of the LendingEscrow contract.
- **ETH-only collateral**: The escrow contract accepts ETH as collateral. Multi-asset collateral (WBTC, staked ETH) is an architectural extension.
- **Yield data source**: DeFiLlama provides mainnet APY data for decision-making. Deposits execute on Sepolia where the full transaction pipeline (approve → deposit → withdraw) is real, but testnet yields are simulated.

## Third-Party Services

| Service | Purpose |
|---|---|
| Anthropic Claude API | LLM reasoning for loan evaluation and negotiation |
| CoinGecko API | ETH/USD price for collateral valuation |
| DeFiLlama API | Real-time yield data for DeFi allocation |
| Ethereum Sepolia RPC | Blockchain interaction (public node) |

## License

Apache 2.0
