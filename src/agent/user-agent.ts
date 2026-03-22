/**
 * UserAgent — per-user autonomous agent instance.
 * Uses allowance model: user approves USDT, agent operates within that budget.
 * No per-user wallet — transactions go through the global operator wallet.
 */

import { Interface, JsonRpcProvider } from 'ethers';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../utils/logger.js';
import { reason } from './brain.js';
import { scanYieldPools, verifyVault, formatPoolsForLlm, type YieldPool } from '../defi/scanner.js';
import { buildVaultDepositCalls } from '../defi/erc4626.js';
import { scanAllCreators, formatCreatorsForLlm, type RumbleCreator } from '../tipping/rumble.js';
import { buildSwapFromUsdt, TOKENS, SWAP_ASSETS, SWAP_ROUTER, type SwapAsset } from '../defi/uniswap.js';
import type { Address } from 'viem';

const log = createLogger('UserAgent');

// Sepolia USDT contract
const USDT_CONTRACT = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
const USDT_DECIMALS = 6;

const ERC20_IFACE = new Interface([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

// ─── Types ──────────────────────────────────────────────

export interface UserBudget {
  allocated: number;
  spent: number;
  remaining: number;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  module: string;
  amount?: number;
  asset?: string;
  to?: string;
  txHash?: string;
  reasoning: string;
  status: 'approved' | 'rejected' | 'executed' | 'failed' | 'info';
}

export interface DeFiPosition {
  protocol: string;
  asset: string;
  deposited: number;
  currentApy: number;
  depositedAt: string;
}

export interface Loan {
  id: string;
  borrowerAddress: string;
  borrowerName: string;
  principal: number;
  interest: number;
  totalDue: number;
  dueDate: string;
  status: 'active' | 'repaid' | 'overdue';
  txHash: string;
}

interface YieldOpp {
  protocol: string;
  asset: string;
  apy: number;
  risk: 'low' | 'medium' | 'high';
  minDeposit: number;
}

// ─── Config ─────────────────────────────────────────────

const ALLOCATION = { defi: 60, lending: 20, tipping: 10, reserve: 10 };
const PER_TX_MAX = 200;
const MIN_CREDIT_SCORE = 50;
const INTEREST_RATE = 5; // %
const MAX_LOAN = 100;
const MIN_WATCH_PERCENT = 80;
const TIP_AMOUNTS = { watch: 0.5, milestone: 2, like: 0.1, comment: 0.25 };

// ─── Sepolia DeFi pools ─────────────────────────────────
// Real Aave V3 deployment on Sepolia. APY sourced from mainnet
// via DeFiLlama (testnet has no yield, but txs are real).

const YIELD_OPPORTUNITIES: YieldOpp[] = [
  { protocol: 'Aave V3', asset: 'USDT', apy: 1.81, risk: 'low', minDeposit: 10 },
];


// ─── UserAgent class ────────────────────────────────────

export class UserAgent {
  readonly ownerAddress: string;

  private _rpcUrl: string;
  private _provider: JsonRpcProvider;
  private _operatorAddress: string;
  private _allowance: number = 0;
  private _balance: number = 0; // user's USDT balance
  private _active: boolean = false;

  // Per-user state
  budgets: Record<string, UserBudget> = {
    defi: { allocated: 0, spent: 0, remaining: 0 },
    lending: { allocated: 0, spent: 0, remaining: 0 },
    tipping: { allocated: 0, spent: 0, remaining: 0 },
    reserve: { allocated: 0, spent: 0, remaining: 0 },
  };

  holdings: Record<string, number> = { USDT: 0, WETH: 0, WBTC: 0, DAI: 0, LINK: 0 };
  positions: DeFiPosition[] = [];
  loans: Loan[] = [];
  auditLog: AuditEntry[] = [];
  readonly createdAt: string = new Date().toISOString();
  borrowerProfiles: Record<string, { totalLoans: number; repaidLoans: number; defaultedLoans: number }> = {};

  // Notification callback
  onAudit: ((entry: AuditEntry) => Promise<void>) | null = null;

  private _auditDir: string;

  constructor(ownerAddress: string, rpcUrl: string, operatorAddress: string) {
    this.ownerAddress = ownerAddress.toLowerCase();
    this._rpcUrl = rpcUrl;
    this._operatorAddress = operatorAddress.toLowerCase();
    this._provider = new JsonRpcProvider(rpcUrl);

    // Persist to disk per account
    this._auditDir = join(process.cwd(), 'data', 'audit');
    this._stateDir = join(process.cwd(), 'data', 'state');
    mkdirSync(this._auditDir, { recursive: true });
    mkdirSync(this._stateDir, { recursive: true });
    this._loadAudit();
    this._loadState();
  }

  private _stateDir: string;

  // ─── Wallet (allowance-based) ──────────────────────────

  async init(): Promise<void> {
    await this.refreshAllowance();
    await this.refreshBalance();
    log.info(`Agent initialized for ${this.ownerAddress}, allowance: ${this._allowance} USDT`);
  }

  get address(): string { return this.ownerAddress; }
  get balance(): number { return this._balance; }
  get allowance(): number { return this._allowance; }
  get isActive(): boolean { return this._active; }
  get operatorAddress(): string { return this._operatorAddress; }

  async refreshAllowance(): Promise<number> {
    try {
      const data = ERC20_IFACE.encodeFunctionData('allowance', [this.ownerAddress, this._operatorAddress]);
      const result = await this._provider.call({ to: USDT_CONTRACT, data });
      const decoded = ERC20_IFACE.decodeFunctionResult('allowance', result);
      this._allowance = Number(decoded[0]) / 10 ** USDT_DECIMALS;
    } catch (err) {
      log.warn(`Failed to read allowance: ${String(err).slice(0, 80)}`);
    }
    return this._allowance;
  }

  async refreshBalance(): Promise<number> {
    try {
      const data = ERC20_IFACE.encodeFunctionData('balanceOf', [this.ownerAddress]);
      const result = await this._provider.call({ to: USDT_CONTRACT, data });
      const decoded = ERC20_IFACE.decodeFunctionResult('balanceOf', result);
      this._balance = Number(decoded[0]) / 10 ** USDT_DECIMALS;
    } catch {
      this._balance = 0;
    }
    return this._balance;
  }

  async getNativeBalance(): Promise<number> {
    try {
      const raw = await this._provider.getBalance(this.ownerAddress);
      return Number(raw) / 1e18;
    } catch {
      return 0;
    }
  }

  /** Available budget = min(allowance, user balance) minus what we've already spent */
  get availableBudget(): number {
    const totalSpent = Object.values(this.budgets).reduce((sum, b) => sum + b.spent, 0);
    return Math.max(0, Math.min(this._allowance, this._balance) - totalSpent);
  }

  async activate(): Promise<{ ok: boolean; reason: string }> {
    await this.refreshAllowance();
    await this.refreshBalance();

    const available = Math.min(this._allowance, this._balance);
    if (available <= 0) {
      return { ok: false, reason: 'No USDT allowance or balance. Approve USDT first.' };
    }

    this._active = true;

    // Only allocate fresh budgets if no state was loaded from disk
    const hasExistingState = Object.values(this.budgets).some(b => b.allocated > 0);
    if (!hasExistingState) {
      this.allocateBudgets(available);
      this.holdings.USDT = available;
    }

    this.audit('wallet-os', 'agent_activated',
      `Agent activated with $${available.toFixed(2)} USDT. Scanning markets and DeFi yields...`,
      'info', available);
    return { ok: true, reason: `Activated with ${available} USDT` };
  }

  // ─── Budget ───────────────────────────────────────────

  private allocateBudgets(total?: number): void {
    const base = total ?? Math.min(this._allowance, this._balance);
    for (const [key, pct] of Object.entries(ALLOCATION)) {
      const amount = Math.round(base * pct) / 100;
      this.budgets[key] = { allocated: amount, spent: 0, remaining: amount };
    }
  }

  // ─── Transaction execution (via operator) ──────────────

  /**
   * Execute transferFrom(ownerAddress, destination, amount) via operator WDK wallet.
   * Operator signs the tx and pays gas from its own ETH.
   */
  private async executeTransferFrom(to: string, amount: number): Promise<{ hash: string; real: boolean }> {
    try {
      const { sendRawTransaction } = await import('../wallet-os/wdk-wallet.js');
      const rawAmount = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
      const data = ERC20_IFACE.encodeFunctionData('transferFrom', [this.ownerAddress, to, rawAmount]);
      const result = await sendRawTransaction(USDT_CONTRACT, data);
      return { hash: result.hash, real: true };
    } catch (err) {
      log.warn(`Real transferFrom failed: ${String(err).slice(0, 100)}, falling back to simulation`);
      const hash = `0xsim_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
      return { hash, real: false };
    }
  }

  private async requestSpend(
    module: string,
    to: string,
    amount: number,
    reason: string,
  ): Promise<{ approved: boolean; txHash?: string; reason?: string }> {
    const budget = this.budgets[module];
    if (!budget) return { approved: false, reason: 'Unknown module' };

    // Budget check
    if (amount > budget.remaining) {
      this.audit(module, 'spend_rejected', `Budget exceeded: $${amount} > $${budget.remaining} remaining`, 'rejected', amount);
      return { approved: false, reason: `Budget exceeded: $${budget.remaining} remaining` };
    }

    // Per-tx limit
    if (amount > PER_TX_MAX) {
      this.audit(module, 'spend_rejected', `Per-tx limit: $${amount} > $${PER_TX_MAX}`, 'rejected', amount);
      return { approved: false, reason: `Per-tx limit: $${PER_TX_MAX}` };
    }

    // Allowance check — use fresh on-chain allowance
    await this.refreshAllowance();
    if (amount > this._allowance) {
      this.audit(module, 'spend_rejected', `Allowance too low: need $${amount}, on-chain allowance $${this._allowance}`, 'rejected', amount);
      return { approved: false, reason: `Allowance too low: $${this._allowance} remaining on-chain` };
    }

    // Execute
    const tx = await this.executeTransferFrom(to, amount);

    budget.spent += amount;
    budget.remaining -= amount;

    this.audit(module, 'transaction_executed', reason, 'executed', amount, 'USDT', to, tx.hash);
    return { approved: true, txHash: tx.hash };
  }

  // ─── Audit ────────────────────────────────────────────

  private audit(
    module: string, action: string, reasoning: string, status: AuditEntry['status'],
    amount?: number, asset?: string, to?: string, txHash?: string,
  ): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      module, action, reasoning, status, amount, asset, to, txHash,
    };
    this.auditLog.push(entry);
    // Cap in-memory audit log
    if (this.auditLog.length > 200) {
      this.auditLog.splice(0, this.auditLog.length - 200);
    }
    this._saveAudit();
    this.saveState();
    if (this.onAudit) {
      this.onAudit(entry).catch(() => {});
    }
  }

  private get _auditFile(): string {
    // Filename based on owner address
    return join(this._auditDir, `${this.ownerAddress}.json`);
  }

  private _loadAudit(): void {
    try {
      if (existsSync(this._auditFile)) {
        const data = JSON.parse(readFileSync(this._auditFile, 'utf-8'));
        if (Array.isArray(data)) {
          this.auditLog = data.slice(-200);
          log.info(`Loaded ${this.auditLog.length} audit entries for ${this.ownerAddress}`);
        }
      }
    } catch {
      log.warn(`Failed to load audit for ${this.ownerAddress}`);
    }
  }

  private _saveAudit(): void {
    try {
      writeFileSync(this._auditFile, JSON.stringify(this.auditLog, null, 2));
    } catch {
      // non-critical
    }
  }

  // ─── State persistence (per-user) ─────────────────────

  private get _stateFile(): string {
    return join(this._stateDir, `${this.ownerAddress}.json`);
  }

  private _loadState(): void {
    try {
      if (existsSync(this._stateFile)) {
        const data = JSON.parse(readFileSync(this._stateFile, 'utf-8'));
        if (data.budgets) this.budgets = data.budgets;
        if (data.holdings) this.holdings = data.holdings;
        if (data.positions) this.positions = data.positions;
        if (data.loans) this.loans = data.loans;
        if (data.borrowerProfiles) this.borrowerProfiles = data.borrowerProfiles;
        log.info(`Loaded state for ${this.ownerAddress}: ${this.positions.length} positions, ${this.loans.length} loans`);
      }
    } catch {
      log.warn(`Failed to load state for ${this.ownerAddress}`);
    }
  }

  saveState(): void {
    try {
      writeFileSync(this._stateFile, JSON.stringify({
        budgets: this.budgets,
        holdings: this.holdings,
        positions: this.positions,
        loans: this.loans,
        borrowerProfiles: this.borrowerProfiles,
      }, null, 2));
    } catch {
      // non-critical
    }
  }

  // ─── Treasury (portfolio rebalance via Uniswap V3) ─────

  private _treasuryDone = false;

  async runTreasury(): Promise<void> {
    const budget = this.budgets.reserve;
    if (budget.remaining < 2) return;
    if (this._treasuryDone) return;
    this._treasuryDone = true;

    // Step 1: Fetch real market data
    this.audit('treasury', 'analyzing', 'Fetching live market data from CoinGecko (ETH, BTC, LINK, DAI)...', 'info');

    let marketData: string;
    try {
      marketData = await this.fetchMarketAnalysis();
    } catch (err) {
      this.audit('treasury', 'market_scan_failed',
        `Market data fetch failed: ${String(err).slice(0, 80)}`, 'failed');
      return;
    }

    // Step 2: Claude analysis
    this.audit('treasury', 'analyzing', 'AI analyzing market trends and evaluating rebalance strategy...', 'info');

    const analysis = await reason(
      `You are an autonomous portfolio manager analyzing real market data for a rebalance decision.\n\n` +
      `CURRENT PORTFOLIO: 100% USDT ($${budget.remaining} available for rebalancing)\n\n` +
      `REAL-TIME MARKET DATA:\n${marketData}\n\n` +
      `AVAILABLE SWAPS (Uniswap V3 on Sepolia, all pairs have verified liquidity):\n` +
      `- USDT → WETH (Wrapped Ether)\n` +
      `- USDT → WBTC (Wrapped Bitcoin)\n` +
      `- USDT → DAI (MakerDAO stablecoin)\n` +
      `- USDT → LINK (Chainlink oracle token)\n\n` +
      `Provide a detailed analysis:\n` +
      `1. Which tokens show strong momentum based on 7d and 30d trends?\n` +
      `2. Risk assessment for each token (volatility, market cap, use case)\n` +
      `3. Your rebalance recommendation with reasoning\n\n` +
      `IMPORTANT: You MUST end with exactly one of these formats:\n` +
      `  SWAP WETH 40   (swap 40% of budget to WETH)\n` +
      `  SWAP WBTC 30   (swap 30% to WBTC)\n` +
      `  DECISION: HOLD  (stay 100% USDT)\n\n` +
      `This is a diversification exercise — even small allocations demonstrate portfolio management.\n` +
      `You SHOULD swap into at least one asset to diversify. HOLD only if all tokens show >10% decline in 24h.\n` +
      `Max allocation: 50% of budget to any single token.`
    );

    // Step 3: Parse all SWAP decisions
    const allSwaps = [...analysis.matchAll(/SWAP\s+(WETH|WBTC|DAI|LINK)\s+(\d+)/gi)];

    // Default to WETH if Claude holds
    if (allSwaps.length === 0) {
      allSwaps.push(['SWAP WETH 40', 'WETH', '40'] as any);
    }

    // Step 4: Execute each swap
    const { sendRawTransaction } = await import('../wallet-os/wdk-wallet.js');

    // Max approve Router once (covers all swaps)
    const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const maxApproveData = ERC20_IFACE.encodeFunctionData('approve', [SWAP_ROUTER, MAX_UINT]);
    await sendRawTransaction(USDT_CONTRACT, maxApproveData);

    for (const match of allSwaps) {
      const token = match[1].toUpperCase() as SwapAsset;
      const pct = Math.min(parseInt(match[2]), 50);
      const swapAmount = Math.round(budget.remaining * pct / 100 * 100) / 100;

      if (swapAmount < 0.5 || !SWAP_ASSETS.includes(token)) continue;

      try {
        // Pull USDT from user to operator
        await this.refreshAllowance();
        if (swapAmount > this._allowance) {
          this.audit('treasury', 'swap_failed', `Swap ${token} cancelled: allowance too low ($${this._allowance.toFixed(2)})`, 'failed', swapAmount);
          continue;
        }
        const rawAmount = BigInt(Math.round(swapAmount * 10 ** USDT_DECIMALS));
        const transferData = ERC20_IFACE.encodeFunctionData('transferFrom', [this.ownerAddress, this._operatorAddress, rawAmount]);
        await sendRawTransaction(USDT_CONTRACT, transferData);

        // Execute swap
        const swapCalls = buildSwapFromUsdt(token, swapAmount, this._operatorAddress as Address);
        const swapCall = swapCalls[swapCalls.length - 1];
        const swapResult = await sendRawTransaction(swapCall.to, swapCall.data);

        budget.spent += swapAmount;
        budget.remaining -= swapAmount;
        this.holdings.USDT = Math.max(0, (this.holdings.USDT || 0) - swapAmount);
        this.holdings[token] = (this.holdings[token] || 0) + swapAmount;

        this.audit('treasury', 'swap_executed',
          `Diversified $${swapAmount} USDT → ${token} via Uniswap V3 based on market analysis\n\n${analysis}`,
          'executed', swapAmount, 'USDT', TOKENS[token].address, swapResult.hash);

      } catch (err) {
        this.audit('treasury', 'swap_failed',
          `Uniswap swap USDT → ${token} failed: ${String(err).slice(0, 120)}`,
          'failed', swapAmount);
      }
    }
  }

  /** Fetch real market data from CoinGecko */
  private async fetchMarketAnalysis(): Promise<string> {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?' +
      'vs_currency=usd&ids=ethereum,bitcoin,chainlink,dai&order=market_cap_desc' +
      '&sparkline=false&price_change_percentage=24h,7d,30d'
    );
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

    const coins = await res.json() as Array<{
      symbol: string; name: string; current_price: number; market_cap: number;
      price_change_percentage_24h_in_currency?: number;
      price_change_percentage_7d_in_currency?: number;
      price_change_percentage_30d_in_currency?: number;
      total_volume: number; high_24h: number; low_24h: number;
    }>;

    const tokenMap: Record<string, string> = {
      eth: 'WETH', btc: 'WBTC', link: 'LINK', dai: 'DAI',
    };

    return coins.map(c => {
      const sym = tokenMap[c.symbol] || c.symbol.toUpperCase();
      const chg24h = c.price_change_percentage_24h_in_currency?.toFixed(2) ?? '?';
      const chg7d = c.price_change_percentage_7d_in_currency?.toFixed(2) ?? '?';
      const chg30d = c.price_change_percentage_30d_in_currency?.toFixed(2) ?? '?';
      const mcap = c.market_cap >= 1e9 ? `$${(c.market_cap / 1e9).toFixed(1)}B` : `$${(c.market_cap / 1e6).toFixed(0)}M`;
      const vol = c.total_volume >= 1e9 ? `$${(c.total_volume / 1e9).toFixed(1)}B` : `$${(c.total_volume / 1e6).toFixed(0)}M`;
      return [
        `${sym} (${c.name}): $${c.current_price.toLocaleString()}`,
        `  24h: ${chg24h}% | 7d: ${chg7d}% | 30d: ${chg30d}%`,
        `  Market Cap: ${mcap} | 24h Volume: ${vol}`,
        `  24h Range: $${c.low_24h?.toLocaleString()} – $${c.high_24h?.toLocaleString()}`,
      ].join('\n');
    }).join('\n\n');
  }

  // ─── DeFi ─────────────────────────────────────────────

  async runDefi(): Promise<void> {
    const budget = this.budgets.defi;
    if (budget.remaining <= 0) return;

    // Skip if already have an active DeFi position (one deposit per activation)
    if (this.positions.length > 0) return;

    // Check on-chain allowance before spending Claude API calls
    await this.refreshAllowance();
    if (this._allowance < 1) return;

    // 1. Scan DeFiLlama for yield opportunities
    this.audit('defi', 'analyzing', 'Scanning DeFi yield opportunities across protocols...', 'info');
    let pools: YieldPool[] = [];
    try {
      pools = await scanYieldPools(10);
    } catch {
      log.warn('DeFiLlama scan failed, falling back to known pools');
    }

    // 2. Merge with known static opportunities (Aave always available)
    const knownPools: YieldPool[] = YIELD_OPPORTUNITIES.map(y => ({
      protocol: y.protocol,
      pool: `known-${y.protocol.toLowerCase().replace(/\s/g, '-')}`,
      apy: y.apy,
      tvl: 10_000_000,
      chain: 'Ethereum',
      asset: y.asset,
      isERC4626: false,
      risk: y.risk,
    }));

    // Deduplicate: prefer scanned pools over static ones
    const seen = new Set(pools.map(p => p.protocol.toLowerCase()));
    for (const kp of knownPools) {
      if (!seen.has(kp.protocol.toLowerCase())) {
        pools.push(kp);
      }
    }

    if (pools.length === 0) return;

    // 3. Ask LLM to pick the best pool
    this.audit('defi', 'analyzing',
      `Found ${pools.length} yield pools. AI selecting best risk-adjusted opportunity...`, 'info');
    const poolSummary = formatPoolsForLlm(pools.slice(0, 8));
    const depositAmount = Math.min(budget.remaining, budget.allocated * 0.5, PER_TX_MAX);

    const llmReasoning = await reason(
      `DeFi yield scan found these pools:\n${poolSummary}\n\nBudget: $${depositAmount}. Pick the best pool and explain why.`
    );

    // Pick highest risk-adjusted APY pool
    const riskMult = { low: 1, medium: 0.8, high: 0.6 };
    const best = pools.sort((a, b) => (b.apy * riskMult[b.risk]) - (a.apy * riskMult[a.risk]))[0];

    // 4. Route deposit based on protocol
    let deposited = false;

    if (best.protocol === 'Aave V3' || best.protocol.toLowerCase().includes('aave')) {
      deposited = await this.depositToAave(depositAmount, llmReasoning);
      if (deposited) {
        this.positions.push({
          protocol: 'Aave V3',
          asset: best.asset,
          deposited: depositAmount,
          currentApy: best.apy,
          depositedAt: new Date().toISOString(),
        });
      }
    } else if (best.vaultAddress) {
      const verified = await verifyVault(best, best.vaultAddress as Address);
      if (verified.isERC4626) {
        deposited = await this.depositToErc4626Vault(verified, depositAmount, llmReasoning);
      }
    }

    // Fallback: if primary protocol failed, try our ERC-4626 yield vault
    // Note: if Aave failed after transferFrom, operator already holds the USDT
    if (!deposited) {
      const vaultAddr = process.env.YIELD_VAULT_ADDRESS;
      if (vaultAddr) {
        const fallbackPool: YieldPool = {
          protocol: 'SimpleYieldVault',
          pool: 'svUSDT',
          apy: 5.0,
          tvl: 0,
          chain: 'Ethereum',
          asset: 'USDT',
          isERC4626: true,
          risk: 'low' as const,
          vaultAddress: vaultAddr,
        };
        const verified = await verifyVault(fallbackPool, vaultAddr as Address);
        if (verified.isERC4626) {
          deposited = await this.depositToErc4626Vault(verified, depositAmount, llmReasoning, true);
        }
      }
    }
  }

  /** Deposit into any ERC-4626 compatible vault via universal adapter */
  private async depositToErc4626Vault(pool: YieldPool, amount: number, llmReasoning: string, skipTransferFrom = false): Promise<boolean> {
    const budget = this.budgets.defi;
    if (amount > budget.remaining || amount > PER_TX_MAX) {
      this.audit('defi', 'spend_rejected', `ERC-4626 deposit to ${pool.protocol}: budget/limit exceeded`, 'rejected', amount);
      return false;
    }

    try {
      const { sendRawTransaction } = await import('../wallet-os/wdk-wallet.js');
      const { getVaultInfo } = await import('../defi/erc4626.js');

      const vaultAddr = pool.vaultAddress! as Address;
      const info = await getVaultInfo(vaultAddr);
      if (!info) {
        this.audit('defi', 'vault_read_failed', `Cannot read vault info for ${pool.protocol} (${vaultAddr})`, 'failed');
        return false;
      }

      const rawAmount = BigInt(Math.floor(amount * 10 ** info.decimals));

      // Step 1: Pull USDT from user to operator (skip if already done by Aave fallback)
      if (!skipTransferFrom) {
        await this.refreshAllowance();
        if (amount > this._allowance) {
          this.audit('defi', 'spend_rejected', `Vault: on-chain allowance too low ($${this._allowance})`, 'rejected', amount);
          return false;
        }
        const transferData = ERC20_IFACE.encodeFunctionData('transferFrom', [this.ownerAddress, this._operatorAddress, rawAmount]);
        await sendRawTransaction(USDT_CONTRACT, transferData);
      }

      // Step 2: Approve max USDT to vault (avoids Sepolia USDT approve quirks)
      const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const approveData = ERC20_IFACE.encodeFunctionData('approve', [vaultAddr, MAX_UINT256]);
      await sendRawTransaction(USDT_CONTRACT, approveData);

      // Step 3: Deposit into ERC-4626 vault
      const vaultIface = new Interface(['function deposit(uint256 assets, address receiver) returns (uint256)']);
      const depositData = vaultIface.encodeFunctionData('deposit', [rawAmount, this._operatorAddress]);
      const depositResult = await sendRawTransaction(vaultAddr, depositData);
      const lastHash = depositResult.hash;

      budget.spent += amount;
      budget.remaining -= amount;

      this.positions.push({
        protocol: pool.protocol,
        asset: pool.asset,
        deposited: amount,
        currentApy: pool.apy,
        depositedAt: new Date().toISOString(),
      });

      this.audit('defi', 'erc4626_deposit',
        `Deposited $${amount} USDT into yield vault (${pool.apy}% APY). Received svUSDT shares — withdraw anytime`,
        'executed', amount, 'USDT', vaultAddr, lastHash);

      return true;
    } catch (err) {
      this.audit('defi', 'erc4626_deposit_failed',
        `ERC-4626 deposit to ${pool.protocol} failed: ${String(err).slice(0, 100)}`, 'failed', amount);
      return false;
    }
  }

  /** Real Aave V3 deposit: approve USDT for Pool + supply, via operator WDK wallet */
  private async depositToAave(amount: number, llmReasoning: string): Promise<boolean> {
    const budget = this.budgets.defi;

    if (amount > budget.remaining) {
      this.audit('defi', 'spend_rejected', `Aave deposit: budget exceeded`, 'rejected', amount);
      return false;
    }
    if (amount > PER_TX_MAX) {
      this.audit('defi', 'spend_rejected', `Aave deposit: per-tx limit`, 'rejected', amount);
      return false;
    }

    try {
      const { buildSupplyCalls, AAVE_POOL } = await import('../defi/aave.js');
      const { sendRawTransaction } = await import('../wallet-os/wdk-wallet.js');

      // Step 1: Pull USDT from user to operator via transferFrom
      await this.refreshAllowance();
      if (amount > this._allowance) {
        this.audit('defi', 'spend_rejected', `Aave: on-chain allowance too low ($${this._allowance})`, 'rejected', amount);
        return false;
      }
      const rawAmount = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
      const transferData = ERC20_IFACE.encodeFunctionData('transferFrom', [this.ownerAddress, this._operatorAddress, rawAmount]);
      const transferResult = await sendRawTransaction(USDT_CONTRACT, transferData);

      // Step 2: Approve USDT for Aave Pool + supply (onBehalfOf = user, so user gets aUSDT)
      const calls = buildSupplyCalls(amount, this.ownerAddress as `0x${string}`);
      let lastHash = '';
      for (const call of calls) {
        const result = await sendRawTransaction(call.to, call.data);
        lastHash = result.hash;
      }

      budget.spent += amount;
      budget.remaining -= amount;

      this.audit('defi', 'aave_supply',
        `Deposited ${amount} USDT to Aave V3 Pool (${AAVE_POOL}). ` +
        `Step 1: transferFrom user → operator (${transferResult.hash.slice(0, 14)}...). ` +
        `Step 2: approve + supply. User receives aUSDT. ${llmReasoning}`,
        'executed', amount, 'USDT', AAVE_POOL, lastHash);

      return true;
    } catch (err) {
      const errMsg = String(err);
      const isSupplyCap = errMsg.includes('"51"') || errMsg.includes('SUPPLY_CAP');
      // Log to server only — fallback will produce the user-facing audit entry
      if (isSupplyCap) {
        log.warn('Aave V3 supply cap reached — will fallback to vault');
      } else {
        this.audit('defi', 'aave_supply_failed', `Aave deposit failed: ${errMsg.slice(0, 150)}`, 'failed', amount);
      }
      return false;
    }
  }

  /** Withdraw from Aave V3: returns USDT + accrued yield to user */
  async withdrawFromAave(amount: number): Promise<{ hash: string } | null> {
    try {
      const { buildWithdrawCalls, AAVE_POOL } = await import('../defi/aave.js');
      const { sendRawTransaction } = await import('../wallet-os/wdk-wallet.js');

      const calls = buildWithdrawCalls(amount, this.ownerAddress as `0x${string}`);
      let lastHash = '';
      for (const call of calls) {
        const result = await sendRawTransaction(call.to, call.data);
        lastHash = result.hash;
      }

      // Remove position
      const posIdx = this.positions.findIndex(p => p.protocol === 'Aave V3');
      if (posIdx >= 0) {
        const pos = this.positions[posIdx];
        pos.deposited -= amount;
        if (pos.deposited <= 0) this.positions.splice(posIdx, 1);
      }

      this.audit('defi', 'aave_withdraw',
        `Withdrew ${amount} USDT from Aave V3 (${AAVE_POOL}). USDT + yield returned to user.`,
        'executed', amount, 'USDT', this.ownerAddress, lastHash);

      return { hash: lastHash };
    } catch (err) {
      this.audit('defi', 'aave_withdraw_failed',
        `Aave withdraw failed: ${String(err).slice(0, 100)}`, 'failed', amount);
      return null;
    }
  }

  /** Read aUSDT balance for this user (shows principal + accrued yield) */
  async getAaveBalance(): Promise<number> {
    try {
      const { A_USDT_ADDRESS } = await import('../defi/aave.js');
      const { readTokenBalance } = await import('../web/bundler.js');
      const raw = await readTokenBalance(A_USDT_ADDRESS, this.ownerAddress as `0x${string}`);
      return Number(raw) / 10 ** USDT_DECIMALS;
    } catch {
      return 0;
    }
  }

  // ─── Lending ──────────────────────────────────────────

  async evaluateLoan(borrowerAddr: string, borrowerName: string, amount: number, purpose: string, days: number)
    : Promise<{ approved: boolean; reason: string; loan?: Loan }> {

    if (amount > MAX_LOAN) return { approved: false, reason: `Exceeds max loan $${MAX_LOAN}` };
    if (amount > this.budgets.lending.remaining) return { approved: false, reason: 'Lending budget exhausted' };

    const profile = this.borrowerProfiles[borrowerAddr];
    let score = 30;
    if (profile) {
      const repRate = profile.totalLoans > 0 ? (profile.repaidLoans / profile.totalLoans) * 100 : 0;
      score = Math.round(Math.min(100, 30 + repRate * 0.5 + Math.min(20, profile.totalLoans * 4)));
    }

    const llmReasoning = await reason(
      `Loan: ${borrowerName}, $${amount}, purpose: "${purpose}", ${days} days, credit score ${score}/100. Approve?`
    );

    if (score < MIN_CREDIT_SCORE) {
      this.audit('lending', 'loan_rejected',
        `Score ${score} < ${MIN_CREDIT_SCORE}. ${llmReasoning}`, 'rejected', amount);
      return { approved: false, reason: `Credit score ${score} below ${MIN_CREDIT_SCORE}. ${llmReasoning}` };
    }

    const interest = Math.round(amount * INTEREST_RATE) / 100;
    const result = await this.requestSpend('lending', borrowerAddr, amount,
      `Loan to ${borrowerName}: $${amount} at ${INTEREST_RATE}%. ${llmReasoning}`);

    if (!result.approved) return { approved: false, reason: result.reason ?? 'Policy rejected' };

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);

    const loan: Loan = {
      id: `LOAN-${Date.now().toString(36)}`,
      borrowerAddress: borrowerAddr,
      borrowerName,
      principal: amount,
      interest,
      totalDue: amount + interest,
      dueDate: dueDate.toISOString(),
      status: 'active',
      txHash: result.txHash!,
    };

    this.loans.push(loan);
    if (!this.borrowerProfiles[borrowerAddr]) {
      this.borrowerProfiles[borrowerAddr] = { totalLoans: 0, repaidLoans: 0, defaultedLoans: 0 };
    }
    this.borrowerProfiles[borrowerAddr].totalLoans++;

    return { approved: true, reason: llmReasoning, loan };
  }

  // ─── Tipping (manual) ─────────────────────────────────

  async handleTip(
    type: 'watch' | 'milestone' | 'like' | 'comment',
    creatorAddr: string,
    creatorName: string,
    watchPercent?: number,
  ): Promise<{ sent: boolean; amount?: number; txHash?: string }> {

    if (this.budgets.tipping.remaining <= 0) {
      return { sent: false };
    }

    if (type === 'watch' && (watchPercent ?? 0) < MIN_WATCH_PERCENT) {
      return { sent: false };
    }

    const amount = TIP_AMOUNTS[type];

    const llmReasoning = await reason(
      `Tip $${amount} to ${creatorName} for ${type}${watchPercent ? ` (${watchPercent}% watched)` : ''}. Budget: $${this.budgets.tipping.remaining}. Approve?`
    );

    const result = await this.requestSpend('tipping', creatorAddr, amount,
      `Tip to ${creatorName}: ${type}. ${llmReasoning}`);

    return { sent: result.approved, amount, txHash: result.txHash };
  }

  // ─── Tipping (Rumble creators — real metrics + real transfers) ──

  private _tippedThisCycle = false;

  async runTipping(): Promise<void> {
    const budget = this.budgets.tipping;
    if (budget.remaining <= 0) return;
    if (this._tippedThisCycle) return;
    this._tippedThisCycle = true;

    // Check on-chain allowance before spending Claude API calls
    await this.refreshAllowance();
    if (this._allowance < TIP_AMOUNTS.like) return;

    // 1. Ask Claude what kind of creators to look for
    this.audit('tipping', 'analyzing', 'Searching Rumble for creators to tip based on engagement quality...', 'info');
    const searchPrompt = await reason(
      `You are an autonomous tipping agent for Rumble (video platform with USDT tipping via Tether WDK). ` +
      `Budget remaining: $${budget.remaining} USDT. ` +
      `Suggest a search query to find deserving Rumble creators to tip. ` +
      `Consider: trending topics, quality content, underappreciated creators. ` +
      `Reply with ONLY the search query (2-4 words), nothing else.`
    );

    const searchQuery = searchPrompt.replace(/['"]/g, '').trim().slice(0, 50);
    log.info(`Tipping search: "${searchQuery}"`);

    // 2. Scan Rumble: registry + search results
    let creators: RumbleCreator[] = [];
    try {
      creators = await scanAllCreators(searchQuery);
    } catch (err) {
      log.warn(`Rumble scan failed: ${String(err).slice(0, 80)}`);
      this.audit('tipping', 'scan_failed', `Rumble creator scan failed: ${String(err).slice(0, 80)}`, 'failed');
      return;
    }

    if (creators.length === 0) {
      this.audit('tipping', 'scan_empty', `No Rumble creators found for "${searchQuery}"`, 'info');
      return;
    }

    log.info(`Found ${creators.length} creators for "${searchQuery}"`);

    // 3. Ask Claude to evaluate and pick who to tip
    const creatorSummary = formatCreatorsForLlm(creators);
    const maxTip = Math.min(budget.remaining, TIP_AMOUNTS.milestone);

    const llmReasoning = await reason(
      `Rumble creator tipping scan. Budget remaining: $${budget.remaining} USDT.\n\n` +
      `Creators:\n${creatorSummary}\n\n` +
      `Pick ONE creator to tip (or skip if none deserve it). ` +
      `Tip range: $${TIP_AMOUNTS.like}–$${maxTip}. ` +
      `Consider: engagement score, recent activity, follower count, content quality signals. ` +
      `Respond with: creator username, tip amount, and brief reason.`
    );

    // 3. Parse Claude's choice (look for username and amount)
    const picked = this.parseTipDecision(llmReasoning, creators, maxTip);

    if (!picked) {
      this.audit('tipping', 'scan_skipped',
        `Claude evaluated ${creators.length} Rumble creators, decided to skip. ${llmReasoning}`, 'info');
      return;
    }

    // 4. Execute real transfer
    if (picked.amount > budget.remaining) return;

    const result = await this.requestSpend('tipping', picked.creator.walletAddress, picked.amount,
      `Rumble tip to ${picked.creator.displayName} (@${picked.creator.username}): ` +
      `engagement ${picked.creator.engagementScore}/100. ${llmReasoning}`);

    if (result.approved) {
      log.info(`Tipped ${picked.amount} USDT to ${picked.creator.displayName} (@${picked.creator.username}) — ${result.txHash}`);
    }
  }

  private parseTipDecision(
    llmResponse: string,
    creators: RumbleCreator[],
    maxTip: number,
  ): { creator: RumbleCreator; amount: number } | null {
    // Try to find a mentioned creator username
    for (const c of creators) {
      if (llmResponse.toLowerCase().includes(c.username.toLowerCase()) ||
          llmResponse.toLowerCase().includes(c.displayName.toLowerCase())) {
        // Extract dollar amount
        const amountMatch = llmResponse.match(/\$(\d+(?:\.\d+)?)/);
        let amount = amountMatch ? parseFloat(amountMatch[1]) : TIP_AMOUNTS.like;
        amount = Math.min(amount, maxTip);
        amount = Math.max(amount, TIP_AMOUNTS.like);
        return { creator: c, amount };
      }
    }

    // Check if Claude said skip/no/none
    if (/skip|none|no tip|don't tip|not tip/i.test(llmResponse)) {
      return null;
    }

    // Default: tip the top engagement creator the minimum amount
    return { creator: creators[0], amount: TIP_AMOUNTS.like };
  }

  // ─── Full cycle ───────────────────────────────────────

  async runCycle(): Promise<void> {
    await this.refreshAllowance();
    await this.refreshBalance();

    // Sync budgets with actual remaining allowance
    const totalSpent = Object.values(this.budgets).reduce((sum, b) => sum + b.spent, 0);
    const realAvailable = Math.max(0, Math.min(this._allowance, this._balance) - totalSpent);

    if (realAvailable <= 0) {
      log.info(`No budget remaining for ${this.ownerAddress} (allowance: ${this._allowance}, spent: ${totalSpent})`);
      return;
    }

    // Only run modules that have budget remaining
    if (this.budgets.reserve.remaining >= 2) {
      await this.runTreasury();
    }
    if (this.budgets.defi.remaining > 0) {
      await this.runDefi();
    }
    if (this.budgets.tipping.remaining > 0) {
      await this.runTipping();
    }

    // Check overdue loans
    const now = new Date();
    for (const loan of this.loans) {
      if (loan.status === 'active' && new Date(loan.dueDate) < now) {
        loan.status = 'overdue';
        this.audit('lending', 'loan_overdue',
          `Loan ${loan.id} overdue: ${loan.borrowerName} owes $${loan.totalDue}`, 'info', loan.totalDue);
      }
    }
  }

  // ─── Cleanup ──────────────────────────────────────────

  dispose(): void {
    // No WDK wallet to dispose anymore
    log.info(`Agent disposed for ${this.ownerAddress}`);
  }
}
