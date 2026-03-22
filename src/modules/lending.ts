import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../wallet-os/audit.js';
import { requestSpend, getBudget, addFunds, addFundsQuiet } from '../wallet-os/core.js';
import { getWdkAddress, sendNative, sendRawTransaction } from '../wallet-os/wdk-wallet.js';
import { isRealWdk } from '../wallet-os/core.js';
import { getEthUsdPrice } from '../utils/eth-price.js';
import {
  readPendingCollateral,
  readNextLoanId,
  readLoan,
  readIsOverdue,
  buildApproveLoanCalls,
  encodeLiquidate,
  getEscrowAddress,
  USDT_ADDRESS,
} from '../defi/escrow.js';
import { buildVaultDepositCalls } from '../defi/erc4626.js';
import type { ModuleRole } from '../wallet-os/types.js';
import type { Address } from 'viem';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const log = createLogger('Lending');

const MODULE: ModuleRole = 'lending';

// ─── T103: Persistent Credit History ─────────────────────────

const CREDIT_DIR = 'data/credit';

interface PersistedCreditHistory {
  address: string;
  totalLoans: number;
  repaidLoans: number;
  defaultedLoans: number;
  totalBorrowed: number;
  totalInterestPaid: number;
  lastActivity: string;
  loanHistory: Array<{
    loanId: string;
    principal: number;
    interest: number;
    status: 'repaid' | 'overdue';
    date: string;
  }>;
}

function ensureCreditDir(): void {
  if (!existsSync(CREDIT_DIR)) {
    mkdirSync(CREDIT_DIR, { recursive: true });
  }
}

function getCreditFilePath(address: string): string {
  const safe = address.toLowerCase().replace(/[^a-z0-9]/g, '');
  return join(CREDIT_DIR, `${safe}.json`);
}

function loadCreditHistory(address: string): PersistedCreditHistory | null {
  const path = getCreditFilePath(address);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch { return null; }
}

function saveCreditHistory(history: PersistedCreditHistory): void {
  ensureCreditDir();
  writeFileSync(getCreditFilePath(history.address), JSON.stringify(history, null, 2), 'utf-8');
}

// ─── T101: Trust Tiers ───────────────────────────────────────

export interface TrustTier {
  tier: number;
  name: string;
  collateralPercent: number;
  requirements: string;
}

const TRUST_TIERS: TrustTier[] = [
  { tier: 0, name: 'New',        collateralPercent: 150, requirements: 'Default for new borrowers' },
  { tier: 1, name: 'Bronze',     collateralPercent: 120, requirements: '1+ loans repaid, 0 defaults' },
  { tier: 2, name: 'Silver',     collateralPercent: 80,  requirements: '3+ loans repaid, 0 defaults' },
  { tier: 3, name: 'Gold',       collateralPercent: 50,  requirements: '5+ loans repaid, $100+ total, 0 defaults' },
  { tier: 4, name: 'Platinum',   collateralPercent: 0,   requirements: '10+ loans repaid, $500+ total, 0 defaults, avg loan ≥ $25 (uncollateralized, exposure-capped)' },
];

/**
 * Anti-abuse trust tier calculation.
 *
 * Key protections against gaming:
 * 1. ANY default → reset to Tier 0 (no forgiveness)
 * 2. Tier 4 requires avg loan ≥ $25 (can't farm with micro-loans)
 * 3. Uncollateralized exposure capped at 20% of total repaid volume
 *    → repaid $500 in history? max uncollateralized = $100
 *    → to get $10k uncollateralized, need $50k repaid history
 * 4. Max single uncollateralized loan = 3× average historical loan size
 *    → avg was $50? max single = $150
 * 5. Outstanding uncollateralized debt capped at 30% of total repaid
 */
export function getTrustTier(address: string): TrustTier {
  const profile = borrowerHistory[address];
  const persisted = loadCreditHistory(address);

  const repaid = (profile?.repaidLoans ?? 0) + (persisted?.repaidLoans ?? 0);
  const defaults = (profile?.defaultedLoans ?? 0) + (persisted?.defaultedLoans ?? 0);
  const totalBorrowed = (profile?.totalBorrowed ?? 0) + (persisted?.totalBorrowed ?? 0);
  const totalLoans = (profile?.totalLoans ?? 0) + (persisted?.totalLoans ?? 0);

  // ANY default → permanent Tier 0 reset (harsh but anti-abuse)
  if (defaults > 0) return TRUST_TIERS[0];

  // Average loan size check for Tier 4
  const avgLoanSize = totalLoans > 0 ? totalBorrowed / totalLoans : 0;

  if (repaid >= 10 && totalBorrowed >= 500 && avgLoanSize >= 25) return TRUST_TIERS[4];
  if (repaid >= 5 && totalBorrowed >= 100)  return TRUST_TIERS[3];
  if (repaid >= 3)                           return TRUST_TIERS[2];
  if (repaid >= 1)                           return TRUST_TIERS[1];
  return TRUST_TIERS[0];
}

/**
 * Calculate the maximum uncollateralized loan for a borrower.
 *
 * Formula: min(
 *   avgLoanSize × 3,              — can't suddenly 100x your usual size
 *   totalRepaidVolume × 0.20,     — exposure = 20% of proven repayment
 *   config.maxLoan                — hard system cap
 * )
 *
 * Example scenarios:
 *   10 loans × $50 = $500 repaid → max = min($150, $100, $100) = $100
 *   20 loans × $100 = $2000 repaid → max = min($300, $400, $100) = $100
 *   50 loans × $200 = $10000 repaid → max = min($600, $2000, $100) = $100
 *   (system cap of $100 controls, but the math protects even without it)
 *
 * Outstanding exposure check:
 *   Total active uncollateralized debt must be < 30% of total repaid volume
 */
export function getMaxUncollateralizedLoan(address: string): number {
  const profile = borrowerHistory[address];
  const persisted = loadCreditHistory(address);

  const totalBorrowed = (profile?.totalBorrowed ?? 0) + (persisted?.totalBorrowed ?? 0);
  const totalLoans = (profile?.totalLoans ?? 0) + (persisted?.totalLoans ?? 0);
  const totalRepaid = (persisted?.totalInterestPaid ?? 0) + totalBorrowed; // conservative: use borrowed as proxy for repaid volume

  if (totalLoans === 0) return 0;

  const avgLoanSize = totalBorrowed / totalLoans;

  // Three independent caps
  const capByAvg = avgLoanSize * 3;              // can't 100x your normal size
  const capByVolume = totalBorrowed * 0.20;       // 20% of proven volume
  const capBySystem = config.lending.maxLoan;     // hard system cap

  const maxLoan = Math.min(capByAvg, capByVolume, capBySystem);

  // Subtract outstanding uncollateralized exposure
  const outstandingUncollateralized = activeLoans
    .filter(l => l.borrowerAddress === address && l.status === 'active' && !l.collateralType)
    .reduce((sum, l) => sum + l.principal, 0);

  const exposureCap = totalBorrowed * 0.30; // max 30% of history can be outstanding
  const remainingExposure = Math.max(0, exposureCap - outstandingUncollateralized);

  return Math.max(0, Math.min(maxLoan, remainingExposure));
}

export interface CreditProfile {
  address: string;
  creditScore: number;
  trustTier: TrustTier;
  totalLoans: number;
  repaidLoans: number;
  defaultedLoans: number;
  totalBorrowed: number;
  totalInterestPaid: number;
  collateralRequired: string;
  maxUncollateralizedLoan: number;
  riskMetrics: {
    avgLoanSize: number;
    exposureCapUsed: string;
    defaultRate: string;
  };
}

export function getCreditProfile(address: string): CreditProfile {
  const profile = borrowerHistory[address];
  const persisted = loadCreditHistory(address);
  const tier = getTrustTier(address);
  const score = getCreditScore(address);
  const totalLoans = (profile?.totalLoans ?? 0) + (persisted?.totalLoans ?? 0);
  const totalBorrowed = (profile?.totalBorrowed ?? 0) + (persisted?.totalBorrowed ?? 0);
  const defaults = (profile?.defaultedLoans ?? 0) + (persisted?.defaultedLoans ?? 0);
  const maxUncollateralized = tier.collateralPercent === 0 ? getMaxUncollateralizedLoan(address) : 0;

  // Outstanding uncollateralized
  const outstandingUncollateralized = activeLoans
    .filter(l => l.borrowerAddress === address && l.status === 'active' && !l.collateralType)
    .reduce((sum, l) => sum + l.principal, 0);
  const exposureCap = totalBorrowed * 0.30;

  return {
    address,
    creditScore: score,
    trustTier: tier,
    totalLoans,
    repaidLoans: (profile?.repaidLoans ?? 0) + (persisted?.repaidLoans ?? 0),
    defaultedLoans: defaults,
    totalBorrowed,
    totalInterestPaid: persisted?.totalInterestPaid ?? 0,
    collateralRequired: tier.collateralPercent === 0 ? 'None (trust-based, exposure-capped)' : `${tier.collateralPercent}%`,
    maxUncollateralizedLoan: Math.round(maxUncollateralized * 100) / 100,
    riskMetrics: {
      avgLoanSize: totalLoans > 0 ? Math.round(totalBorrowed / totalLoans * 100) / 100 : 0,
      exposureCapUsed: exposureCap > 0 ? `${Math.round(outstandingUncollateralized / exposureCap * 100)}%` : '0%',
      defaultRate: totalLoans > 0 ? `${Math.round(defaults / totalLoans * 100)}%` : '0%',
    },
  };
}

// ─── T100: LLM Loan Negotiation ──────────────────────────────

export interface NegotiationState {
  id: string;
  borrowerAddress: string;
  borrowerName: string;
  round: number;
  maxRounds: number;
  status: 'active' | 'agreed' | 'rejected' | 'expired';
  borrowerProposal: { amount: number; rate: number; days: number };
  agentCounterOffer?: { amount: number; rate: number; days: number; reasoning: string };
  agreedTerms?: { amount: number; rate: number; days: number };
  history: Array<{ role: 'borrower' | 'agent'; proposal: { amount: number; rate: number; days: number }; reasoning?: string }>;
  createdAt: string;
}

const negotiations: Map<string, NegotiationState> = new Map();

export async function negotiateLoan(
  borrowerAddress: string,
  borrowerName: string,
  proposal: { amount: number; rate: number; days: number },
  llmReason: (prompt: string) => Promise<string>,
): Promise<NegotiationState> {
  const key = borrowerAddress.toLowerCase();
  let state = negotiations.get(key);

  // Start new negotiation or continue existing
  if (!state || state.status !== 'active') {
    state = {
      id: `NEG-${String(Math.floor(Date.now() / 1000)).slice(-6)}`,
      borrowerAddress,
      borrowerName,
      round: 0,
      maxRounds: 5,
      status: 'active',
      borrowerProposal: proposal,
      history: [],
      createdAt: new Date().toISOString(),
    };
    negotiations.set(key, state);
  }

  state.round++;
  state.borrowerProposal = proposal;
  state.history.push({ role: 'borrower', proposal });

  if (state.round > state.maxRounds) {
    state.status = 'expired';
    logAudit({
      timestamp: new Date().toISOString(), module: MODULE, action: 'negotiation_expired',
      amount: proposal.amount, asset: 'USDT', to: borrowerAddress,
      reasoning: `Negotiation ${state.id} expired after ${state.maxRounds} rounds without agreement`,
      status: 'info',
    });
    return state;
  }

  const creditScore = getCreditScore(borrowerAddress);
  const tier = getTrustTier(borrowerAddress);
  const profile = getCreditProfile(borrowerAddress);

  const prompt = `You are negotiating loan terms with a borrower.

Borrower: ${borrowerName} (${borrowerAddress})
Credit score: ${creditScore}/100
Trust tier: ${tier.name} (Tier ${tier.tier}) — requires ${tier.collateralPercent}% collateral
History: ${profile.totalLoans} total loans, ${profile.repaidLoans} repaid, ${profile.defaultedLoans} defaults
Total borrowed: $${profile.totalBorrowed}

Borrower proposes: $${proposal.amount} USDT at ${proposal.rate}% interest for ${proposal.days} days
Round: ${state.round}/${state.maxRounds}

Previous rounds:
${state.history.map(h => `  ${h.role}: $${h.proposal.amount} at ${h.proposal.rate}% for ${h.proposal.days} days${h.reasoning ? ` — ${h.reasoning}` : ''}`).join('\n')}

Our constraints:
- Current market rate: ${getDynamicRate().rate}% (base ${config.lending.interestRate}%, pool utilization ${getDynamicRate().utilization}%)
- Max loan: $${config.lending.maxLoan}
- Budget remaining: $${getBudget(MODULE).remaining}
- Higher risk borrowers need higher rates
- New borrowers (score < 50) should pay 2-3x base rate
- Good borrowers (score > 70) can get near base rate

Respond in exactly this JSON format (no other text):
{"action": "counter" | "accept" | "reject", "amount": number, "rate": number, "days": number, "reasoning": "brief explanation"}

If borrower's terms are acceptable, use "accept" with their exact terms.
If unacceptable but negotiable, use "counter" with your adjusted terms.
If completely unreasonable, use "reject".`;

  const response = await llmReason(prompt);

  let parsed: { action: string; amount: number; rate: number; days: number; reasoning: string };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? response);
  } catch {
    // Fallback: counter with safe defaults
    parsed = {
      action: 'counter',
      amount: Math.min(proposal.amount, config.lending.maxLoan),
      rate: Math.max(proposal.rate, config.lending.interestRate * (creditScore < 50 ? 2.5 : 1.2)),
      days: Math.min(proposal.days, 30),
      reasoning: 'Counter-offer based on risk assessment',
    };
  }

  if (parsed.action === 'accept') {
    state.status = 'agreed';
    state.agreedTerms = { amount: parsed.amount, rate: parsed.rate, days: parsed.days };
    state.agentCounterOffer = { ...parsed, reasoning: parsed.reasoning };
    state.history.push({ role: 'agent', proposal: { amount: parsed.amount, rate: parsed.rate, days: parsed.days }, reasoning: parsed.reasoning });

    logAudit({
      timestamp: new Date().toISOString(), module: MODULE, action: 'negotiation_agreed',
      amount: parsed.amount, asset: 'USDT', to: borrowerAddress,
      reasoning: `Negotiation ${state.id} agreed after ${state.round} rounds: $${parsed.amount} at ${parsed.rate}% for ${parsed.days} days. ${parsed.reasoning}`,
      status: 'executed',
    });
  } else if (parsed.action === 'reject') {
    state.status = 'rejected';
    state.agentCounterOffer = { ...parsed, reasoning: parsed.reasoning };
    state.history.push({ role: 'agent', proposal: { amount: parsed.amount, rate: parsed.rate, days: parsed.days }, reasoning: parsed.reasoning });

    logAudit({
      timestamp: new Date().toISOString(), module: MODULE, action: 'negotiation_rejected',
      amount: proposal.amount, asset: 'USDT', to: borrowerAddress,
      reasoning: `Negotiation ${state.id} rejected: ${parsed.reasoning}`,
      status: 'rejected',
    });
  } else {
    // counter
    state.agentCounterOffer = { amount: parsed.amount, rate: parsed.rate, days: parsed.days, reasoning: parsed.reasoning };
    state.history.push({ role: 'agent', proposal: { amount: parsed.amount, rate: parsed.rate, days: parsed.days }, reasoning: parsed.reasoning });

    logAudit({
      timestamp: new Date().toISOString(), module: MODULE, action: 'negotiation_counter',
      amount: parsed.amount, asset: 'USDT', to: borrowerAddress,
      reasoning: `Round ${state.round}: Agent counters with $${parsed.amount} at ${parsed.rate}% for ${parsed.days} days. ${parsed.reasoning}`,
      status: 'info',
    });
  }

  return state;
}

export function getNegotiation(borrowerAddress: string): NegotiationState | undefined {
  return negotiations.get(borrowerAddress.toLowerCase());
}

// ─── Core Types ──────────────────────────────────────────────

export interface LoanRequest {
  borrowerAddress: string;
  borrowerName: string;
  amount: number;
  purpose: string;
  repaymentDays: number;
  collateralTxHash?: string;
  collateralType?: 'ETH';
  negotiatedRate?: number;
  ownerAddress?: string;
}

export interface Loan {
  id: string;
  borrowerAddress: string;
  borrowerName: string;
  principal: number;
  interest: number;
  totalDue: number;
  disbursedAt: string;
  dueDate: string;
  status: 'active' | 'repaid' | 'overdue';
  txHash: string;
  ownerAddress?: string;      // which lender delegated funds for this loan
  // Collateral fields
  collateralType?: 'ETH';
  collateralAmountWei?: string;
  collateralAmountEth?: number;
  collateralValueUsd?: number;
  collateralTxHash?: string;
  ltvRatio?: number;
  onChainLoanId?: number;
}

interface BorrowerProfile {
  address: string;
  totalLoans: number;
  repaidLoans: number;
  defaultedLoans: number;
  totalBorrowed: number;
}

const activeLoans: Loan[] = [];
const borrowerHistory: Record<string, BorrowerProfile> = {};
const usedCollateralTxHashes = new Set<string>();
let chainSynced = false;

// ─── On-chain loan sync at startup ───────────────────────────

/**
 * Sync loans from LendingEscrow contract on-chain.
 * Called at server startup to restore state from blockchain.
 * Reads all loans from contract via nextLoanId() + getLoan(i).
 */
export async function syncLoansFromChain(): Promise<number> {
  if (chainSynced) return 0;
  try {
    const nextId = await readNextLoanId();
    if (nextId === 0) { chainSynced = true; return 0; }

    let synced = 0;
    let ethPrice: number;
    try { ethPrice = await getEthUsdPrice(); } catch { ethPrice = 2000; }

    for (let i = 0; i < nextId; i++) {
      // Skip if already tracked in-memory
      if (activeLoans.some(l => l.onChainLoanId === i)) continue;

      try {
        const onChain = await readLoan(i);
        if (onChain.principalUsdt === 0) continue; // empty slot

        const collateralEth = Number(onChain.collateralWei) / 1e18;
        const status: 'active' | 'repaid' | 'overdue' =
          onChain.repaid ? 'repaid' :
          onChain.liquidated ? 'overdue' :
          onChain.active && onChain.dueTimestamp < Date.now() / 1000 ? 'overdue' :
          onChain.active ? 'active' : 'repaid';

        const loan: Loan = {
          id: `CLOAN-${String(i).padStart(6, '0')}`,
          borrowerAddress: onChain.borrower,
          borrowerName: `Agent-${onChain.borrower.slice(2, 8)}`,
          principal: onChain.principalUsdt,
          interest: onChain.totalDueUsdt - onChain.principalUsdt,
          totalDue: onChain.totalDueUsdt,
          disbursedAt: new Date((onChain.dueTimestamp - 7 * 86400) * 1000).toISOString(), // estimate
          dueDate: new Date(onChain.dueTimestamp * 1000).toISOString(),
          status,
          txHash: `on-chain-loan-${i}`,
          collateralType: 'ETH',
          collateralAmountWei: onChain.collateralWei.toString(),
          collateralAmountEth: collateralEth,
          collateralValueUsd: collateralEth * ethPrice,
          ltvRatio: collateralEth * ethPrice > 0 ? (onChain.principalUsdt / (collateralEth * ethPrice)) * 100 : 0,
          onChainLoanId: i,
        };

        activeLoans.push(loan);
        updateBorrowerProfile(onChain.borrower, onChain.principalUsdt);
        if (status === 'repaid') {
          const profile = borrowerHistory[onChain.borrower];
          if (profile) profile.repaidLoans++;
        }
        synced++;
      } catch {
        // Skip individual loan read errors
      }
    }

    chainSynced = true;
    log.info(`Synced ${synced} loans from on-chain (nextLoanId: ${nextId})`);
    return synced;
  } catch (err) {
    log.warn(`On-chain sync failed (non-critical): ${String(err).slice(0, 80)}`);
    chainSynced = true;
    return 0;
  }
}

// ─── Dynamic Interest Rate ───────────────────────────────────

/**
 * Calculate dynamic interest rate based on pool utilization.
 *
 * Formula: baseRate × (1 + utilizationRatio)
 *
 * When pool is empty (0% utilization) → base rate (5%)
 * When pool is 50% utilized → 7.5%
 * When pool is 90% utilized → 9.5%
 *
 * This incentivizes borrowing when capital is available
 * and increases cost when the pool is stressed.
 */
export function getDynamicRate(): { rate: number; utilization: number } {
  const budget = getBudget(MODULE);
  const utilization = budget.allocated > 0
    ? budget.spent / budget.allocated
    : 0;

  const rate = Math.round(config.lending.interestRate * (1 + utilization) * 100) / 100;
  return { rate, utilization: Math.round(utilization * 100) };
}

function getCreditScore(address: string): number {
  const profile = borrowerHistory[address];
  const persisted = loadCreditHistory(address);
  const totalLoans = (profile?.totalLoans ?? 0) + (persisted?.totalLoans ?? 0);
  const repaidLoans = (profile?.repaidLoans ?? 0) + (persisted?.repaidLoans ?? 0);

  if (totalLoans === 0) return 30; // New borrower: low score

  const repaymentRate = (repaidLoans / totalLoans) * 100;

  // Score: base 30 + repayment rate (max 50) + loan count bonus (max 20)
  const loanBonus = Math.min(20, totalLoans * 4);
  return Math.round(Math.min(100, 30 + (repaymentRate * 0.5) + loanBonus));
}

function updateBorrowerProfile(address: string, amount: number): void {
  if (!borrowerHistory[address]) {
    borrowerHistory[address] = {
      address,
      totalLoans: 0,
      repaidLoans: 0,
      defaultedLoans: 0,
      totalBorrowed: 0,
    };
  }
  borrowerHistory[address].totalLoans++;
  borrowerHistory[address].totalBorrowed += amount;
}

// ─── Uncollateralized Lending (credit-score based) ──────────

export async function evaluateLoanRequest(
  request: LoanRequest,
  llmReason: (prompt: string) => Promise<string>,
): Promise<{ approved: boolean; reason: string; loan?: Loan }> {
  const budget = getBudget(MODULE);

  if (request.amount > config.lending.maxLoan) {
    const reason = `Loan amount ${request.amount} exceeds max ${config.lending.maxLoan}`;
    log.warn(reason);
    return { approved: false, reason };
  }

  if (request.amount > budget.remaining) {
    const reason = `Insufficient lending budget: ${budget.remaining} available, ${request.amount} requested`;
    log.warn(reason);
    return { approved: false, reason };
  }

  const creditScore = getCreditScore(request.borrowerAddress);
  const profile = borrowerHistory[request.borrowerAddress];

  const reasoning = await llmReason(
    `Loan evaluation:\n- Borrower: ${request.borrowerName} (${request.borrowerAddress})\n- Amount: $${request.amount} USDT\n- Purpose: ${request.purpose}\n- Repayment: ${request.repaymentDays} days\n- Credit score: ${creditScore}/100\n- History: ${profile ? `${profile.totalLoans} loans, ${profile.repaidLoans} repaid, ${profile.defaultedLoans} defaults` : 'New borrower, no history'}\n- Budget remaining: $${budget.remaining}\n\nShould we approve? Assess risk briefly.`
  );

  log.info('Loan evaluation', { creditScore, reasoning });

  if (creditScore < config.lending.minCreditScore) {
    logAudit({
      timestamp: new Date().toISOString(),
      module: MODULE,
      action: 'loan_rejected',
      amount: request.amount,
      asset: 'USDT',
      to: request.borrowerAddress,
      reasoning: `Rejected $${request.amount} loan — credit score ${creditScore}/100 (min ${config.lending.minCreditScore})\n\n${reasoning}`,
      status: 'rejected',
    });
    return { approved: false, reason: `Credit score ${creditScore} below minimum ${config.lending.minCreditScore}. ${reasoning}` };
  }

  const interest = Math.round(request.amount * (config.lending.interestRate / 100) * 100) / 100;
  const totalDue = request.amount + interest;

  const result = await requestSpend({
    moduleRole: MODULE,
    to: request.borrowerAddress,
    amount: request.amount,
    asset: 'USDT',
    reason: `Loan to ${request.borrowerName}: $${request.amount} at ${config.lending.interestRate}% interest. Credit score: ${creditScore}. ${reasoning}`,
  });

  if (!result.approved) {
    return { approved: false, reason: result.rejectionReason ?? 'Policy rejected' };
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + request.repaymentDays);

  const loan: Loan = {
    id: `LOAN-${String(Math.floor(Date.now() / 1000)).slice(-6)}`,
    borrowerAddress: request.borrowerAddress,
    borrowerName: request.borrowerName,
    principal: request.amount,
    interest,
    totalDue,
    disbursedAt: new Date().toISOString(),
    dueDate: dueDate.toISOString(),
    status: 'active',
    txHash: result.txHash!,
  };

  activeLoans.push(loan);
  updateBorrowerProfile(request.borrowerAddress, request.amount);

  log.info(`Loan ${loan.id} approved and disbursed`, { amount: request.amount, dueDate: loan.dueDate });
  return { approved: true, reason: reasoning, loan };
}

// ─── Collateralized Lending (ETH collateral via LendingEscrow) ─

export async function evaluateCollateralizedLoan(
  request: LoanRequest,
  llmReason: (prompt: string) => Promise<string>,
): Promise<{ approved: boolean; reason: string; loan?: Loan }> {

  // 1. Read pending collateral from escrow contract
  let collateralAmountWei: bigint;
  let collateralAmountEth: number;
  let useEscrow = false;

  try {
    collateralAmountWei = await readPendingCollateral(request.borrowerAddress);
    collateralAmountEth = Number(collateralAmountWei) / 1e18;
    useEscrow = true;

    if (collateralAmountWei === 0n) {
      return { approved: false, reason: 'No pending collateral in LendingEscrow contract. Call depositCollateral() first.' };
    }
    log.info(`Collateral found in escrow: ${collateralAmountEth} ETH from ${request.borrowerAddress}`);
  } catch (err) {
    // Escrow not configured — fallback to simulation
    collateralAmountEth = 0.05;
    collateralAmountWei = BigInt('50000000000000000');
    log.info('Escrow unavailable, simulation mode: assuming 0.05 ETH collateral');
  }

  // 2. Price collateral
  let ethPrice: number;
  try {
    ethPrice = await getEthUsdPrice();
  } catch {
    ethPrice = 2000;
    log.warn('CoinGecko unavailable, using fallback ETH price: $2000');
  }

  const collateralValueUsd = collateralAmountEth * ethPrice;

  // T101: Use trust tier for collateral ratio instead of flat config
  const tier = getTrustTier(request.borrowerAddress);
  const requiredRatio = tier.collateralPercent / 100;

  // Tier 4 (Platinum) = uncollateralized lending, but exposure-capped
  if (requiredRatio === 0) {
    const maxUncollateralized = getMaxUncollateralizedLoan(request.borrowerAddress);
    if (request.amount > maxUncollateralized) {
      const profile = getCreditProfile(request.borrowerAddress);
      const reason = `Rejected $${request.amount} uncollateralized loan — exposure limit exceeded. ` +
        `Max uncollateralized: $${maxUncollateralized.toFixed(2)} (avg loan: $${profile.riskMetrics.avgLoanSize}, ` +
        `exposure used: ${profile.riskMetrics.exposureCapUsed}). ` +
        `Deposit collateral to borrow more, or build more repayment history.`;
      logAudit({
        timestamp: new Date().toISOString(), module: MODULE, action: 'loan_rejected',
        amount: request.amount, asset: 'USDT', to: request.borrowerAddress,
        reasoning: reason, status: 'rejected',
      });
      return { approved: false, reason };
    }
    log.info(`Borrower ${request.borrowerAddress} is Tier 4 (Platinum) — uncollateralized $${request.amount} within limit $${maxUncollateralized.toFixed(2)}`);
  }

  const maxLoan = requiredRatio > 0 ? collateralValueUsd / requiredRatio : config.lending.maxLoan;

  if (requiredRatio > 0 && request.amount > maxLoan) {
    const reason = `Rejected $${request.amount} loan — insufficient collateral. ${collateralAmountEth.toFixed(4)} ETH ($${collateralValueUsd.toFixed(2)}) covers max $${maxLoan.toFixed(2)} at ${tier.collateralPercent}% ratio (Trust: ${tier.name})`;
    logAudit({
      timestamp: new Date().toISOString(), module: MODULE, action: 'loan_rejected',
      amount: request.amount, asset: 'USDT', to: request.borrowerAddress,
      reasoning: reason, status: 'rejected',
    });
    return { approved: false, reason };
  }

  // 3. Budget check
  const budget = getBudget(MODULE);
  if (request.amount > budget.remaining) {
    return { approved: false, reason: `Insufficient lending budget: $${budget.remaining} available` };
  }
  if (request.amount > config.lending.maxLoan) {
    return { approved: false, reason: `Exceeds max loan $${config.lending.maxLoan}` };
  }

  // 4. LLM reasoning
  const creditScore = getCreditScore(request.borrowerAddress);
  const actualLtv = collateralValueUsd > 0 ? (request.amount / collateralValueUsd) * 100 : 0;

  const reasoning = await llmReason(
    `Collateralized loan evaluation:\n` +
    `- Borrower: ${request.borrowerName} (${request.borrowerAddress})\n` +
    `- Trust tier: ${tier.name} (Tier ${tier.tier}, requires ${tier.collateralPercent}% collateral)\n` +
    `- Collateral: ${collateralAmountEth.toFixed(4)} ETH ($${collateralValueUsd.toFixed(2)} at $${ethPrice}/ETH)\n` +
    `- Collateral held in: LendingEscrow smart contract (trustless)\n` +
    `- Requested: $${request.amount} USDT\n` +
    `- LTV: ${actualLtv.toFixed(1)}%${requiredRatio > 0 ? ` (max ${((1 / requiredRatio) * 100).toFixed(0)}%)` : ' (uncollateralized — Platinum tier)'}\n` +
    `- Purpose: ${request.purpose}\n` +
    `- Repayment: ${request.repaymentDays} days\n` +
    `- Credit score: ${creditScore}/100\n` +
    `Should we approve? Assess risk briefly.`,
  );

  const isFraud = reasoning.toLowerCase().includes('reject') && reasoning.toLowerCase().includes('fraud');
  if (isFraud) {
    logAudit({
      timestamp: new Date().toISOString(), module: MODULE, action: 'collateral_loan_rejected',
      amount: request.amount, asset: 'USDT', to: request.borrowerAddress,
      reasoning: `Rejected $${request.amount} collateralized loan to ${request.borrowerName} — fraud risk detected\n\n${reasoning}`,
      status: 'rejected',
    });
    return { approved: false, reason: reasoning };
  }

  // 5. Execute via escrow contract (or simulation)
  // T100: Use negotiated rate if available, otherwise config default
  // Dynamic rate: negotiated rate > dynamic market rate > base config rate
  const { rate: dynamicRate } = getDynamicRate();
  const effectiveRate = request.negotiatedRate ?? dynamicRate;
  const interest = Math.round(request.amount * (effectiveRate / 100) * 100) / 100;
  const totalDue = request.amount + interest;
  const durationSeconds = request.repaymentDays * 86400;
  let txHash: string;
  let onChainLoanId: number | undefined;

  if (useEscrow) {
    // Get current nextLoanId before the call (so we know the ID)
    try {
      onChainLoanId = await readNextLoanId();
    } catch { /* will be undefined */ }

    // Call escrow: approve USDT to escrow + approveLoan()
    const calls = buildApproveLoanCalls(
      request.borrowerAddress as Address,
      collateralAmountWei,
      request.amount,
      interest,
      durationSeconds,
    );

    try {
      // Step 1: approve USDT spending by escrow
      await sendRawTransaction(calls[0].to, calls[0].data);
      // Step 2: call approveLoan (locks collateral, transfers USDT to borrower)
      const result = await sendRawTransaction(calls[1].to, calls[1].data);
      txHash = result.hash;
      log.info(`Escrow approveLoan TX: ${txHash}, on-chain loan ID: ${onChainLoanId}`);
    } catch (err) {
      log.error('Escrow approveLoan failed', { error: String(err) });
      return { approved: false, reason: `On-chain escrow call failed: ${String(err)}` };
    }
  } else {
    // Simulation fallback
    const result = await requestSpend({
      moduleRole: MODULE,
      to: request.borrowerAddress,
      amount: request.amount,
      asset: 'USDT',
      reason: `Collateralized loan: $${request.amount} backed by ${collateralAmountEth} ETH. ${reasoning}`,
    });
    if (!result.approved) {
      return { approved: false, reason: result.rejectionReason ?? 'Policy rejected' };
    }
    txHash = result.txHash!;
  }

  // 6. Record loan
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + request.repaymentDays);

  const loan: Loan = {
    id: `CLOAN-${String(Math.floor(Date.now() / 1000)).slice(-6)}`,
    borrowerAddress: request.borrowerAddress,
    borrowerName: request.borrowerName,
    principal: request.amount,
    interest,
    totalDue,
    disbursedAt: new Date().toISOString(),
    dueDate: dueDate.toISOString(),
    status: 'active',
    txHash,
    collateralType: 'ETH',
    collateralAmountWei: collateralAmountWei.toString(),
    collateralAmountEth,
    collateralValueUsd,
    collateralTxHash: request.collateralTxHash,
    ltvRatio: actualLtv,
    onChainLoanId,
    ownerAddress: request.ownerAddress,
  };

  activeLoans.push(loan);
  updateBorrowerProfile(request.borrowerAddress, request.amount);

  logAudit({
    timestamp: new Date().toISOString(), module: MODULE, action: 'collateral_loan_approved',
    amount: request.amount, asset: 'USDT', to: request.borrowerAddress, txHash,
    reasoning: `Approved $${request.amount} USDT loan backed by ${collateralAmountEth.toFixed(4)} ETH ($${collateralValueUsd.toFixed(2)}). LTV ${actualLtv.toFixed(1)}% · Due ${loan.dueDate.slice(0, 10)} · Expected profit +$${interest}\n\n${reasoning}`,
    status: 'executed',
  });

  log.info(`Collateralized loan ${loan.id} approved`, {
    amount: request.amount,
    collateral: `${collateralAmountEth} ETH`,
    ltv: `${actualLtv.toFixed(1)}%`,
    escrow: useEscrow,
  });

  return { approved: true, reason: reasoning, loan };
}

// ─── Repayment ──────────────────────────────────────────────

export async function processRepayment(
  loanId: string,
  amount: number,
): Promise<{ success: boolean; collateralReturned?: { txHash: string; amountEth: number } }> {
  const loan = activeLoans.find(l => l.id === loanId);
  if (!loan || loan.status !== 'active') {
    log.warn(`Loan ${loanId} not found or not active`);
    return { success: false };
  }

  if (amount < loan.totalDue) {
    log.warn(`Partial repayment ${amount} < ${loan.totalDue} for loan ${loanId}`);
    return { success: false };
  }

  loan.status = 'repaid';
  const profile = borrowerHistory[loan.borrowerAddress];
  if (profile) profile.repaidLoans++;

  // Add funds back silently (single audit entry below)
  addFundsQuiet(amount);

  // Return ETH collateral if this was a collateralized loan
  let collateralReturned: { txHash: string; amountEth: number } | undefined;
  if (loan.collateralType === 'ETH' && loan.collateralAmountWei) {
    try {
      const result = await sendNative(loan.borrowerAddress, BigInt(loan.collateralAmountWei));
      collateralReturned = { txHash: result.hash, amountEth: loan.collateralAmountEth! };
      log.info(`Collateral returned: ${loan.collateralAmountEth} ETH → ${loan.borrowerAddress}`, { txHash: result.hash });
    } catch (err) {
      log.error(`Failed to return collateral for loan ${loanId}`, { error: String(err) });
    }
  }

  // T102: Revenue Reinvestment — deposit interest into yield vault
  let reinvestTxHash: string | undefined;
  if (loan.interest > 0) {
    try {
      const vaultAddress = process.env.YIELD_VAULT_ADDRESS as Address | undefined;
      if (vaultAddress) {
        const interestRaw = BigInt(Math.round(loan.interest * 1e6)); // USDT 6 decimals
        const agentAddress = (await import('../wallet-os/wdk-wallet.js')).getWdkAddress() as Address;
        const calls = buildVaultDepositCalls(vaultAddress, USDT_ADDRESS, interestRaw, agentAddress);

        // Approve USDT to vault
        await sendRawTransaction(calls[0].to, calls[0].data);
        // Deposit into vault
        const result = await sendRawTransaction(calls[1].to, calls[1].data);
        reinvestTxHash = result.hash;

        logAudit({
          timestamp: new Date().toISOString(), module: MODULE, action: 'interest_reinvested',
          amount: loan.interest, asset: 'USDT', txHash: reinvestTxHash,
          reasoning: `Reinvested $${loan.interest} interest into yield vault (5% APY)`,
          status: 'executed',
        });
        log.info(`Reinvested $${loan.interest} interest into yield vault`, { txHash: reinvestTxHash });
      }
    } catch (err) {
      log.warn(`Revenue reinvestment failed (non-critical): ${String(err)}`);
    }
  }

  // T103: Persist credit history to disk
  persistCreditEvent(loan.borrowerAddress, loan, 'repaid');

  // Single consolidated audit entry
  logAudit({
    timestamp: new Date().toISOString(),
    module: MODULE,
    action: 'loan_repaid',
    amount,
    asset: 'USDT',
    txHash: collateralReturned?.txHash,
    reasoning: `Received $${amount} USDT ($${loan.principal} principal + $${loan.interest} interest). Profit: +$${loan.interest} USDT${collateralReturned ? `. Collateral ${collateralReturned.amountEth} ETH returned` : ''}${reinvestTxHash ? `. Interest reinvested into yield vault` : ''}`,
    status: 'executed',
  });

  log.info(`Loan ${loanId} fully repaid`, { amount, profit: loan.interest });
  return { success: true, collateralReturned };
}

// ─── Overdue & Liquidation ──────────────────────────────────

export async function checkOverdueLoans(): Promise<Loan[]> {
  const now = new Date();
  const overdue: Loan[] = [];

  for (const loan of activeLoans) {
    if (loan.status === 'active' && new Date(loan.dueDate) < now) {
      loan.status = 'overdue';
      const profile = borrowerHistory[loan.borrowerAddress];
      if (profile) profile.defaultedLoans++;

      // T103: Persist overdue event
      persistCreditEvent(loan.borrowerAddress, loan, 'overdue');

      overdue.push(loan);

      // Collateralized loans: liquidate via escrow contract
      if (loan.collateralType === 'ETH' && loan.onChainLoanId !== undefined) {
        try {
          const data = encodeLiquidate(loan.onChainLoanId);
          const result = await sendRawTransaction(getEscrowAddress(), data);
          log.info(`Escrow liquidation TX: ${result.hash}`);

          logAudit({
            timestamp: new Date().toISOString(), module: MODULE, action: 'collateral_liquidated',
            amount: loan.collateralValueUsd!, asset: 'ETH', to: loan.borrowerAddress,
            reasoning: `Loan ${loan.id} overdue. Liquidated ${loan.collateralAmountEth} ETH via LendingEscrow. TX: ${result.hash}`,
            status: 'executed',
          });
        } catch (err) {
          log.error(`Escrow liquidation failed for loan ${loan.id}`, { error: String(err) });
          logAudit({
            timestamp: new Date().toISOString(), module: MODULE, action: 'collateral_liquidated',
            amount: loan.collateralValueUsd!, asset: 'ETH', to: loan.borrowerAddress,
            reasoning: `Loan ${loan.id} overdue. Liquidating ${loan.collateralAmountEth} ETH. Escrow call failed: ${String(err)}`,
            status: 'executed',
          });
        }
      } else {
        logAudit({
          timestamp: new Date().toISOString(), module: MODULE, action: 'loan_overdue',
          amount: loan.totalDue, asset: 'USDT', to: loan.borrowerAddress,
          reasoning: `Loan ${loan.id} overdue. Borrower: ${loan.borrowerName}. Due: ${loan.dueDate}`,
          status: 'info',
        });
      }

      log.warn(`Loan ${loan.id} is overdue`, { borrower: loan.borrowerName, totalDue: loan.totalDue });
    }
  }

  return overdue;
}

// ─── T103: Persist Credit Event ──────────────────────────────

function persistCreditEvent(address: string, loan: Loan, status: 'repaid' | 'overdue'): void {
  try {
    let history = loadCreditHistory(address);
    if (!history) {
      history = {
        address,
        totalLoans: 0,
        repaidLoans: 0,
        defaultedLoans: 0,
        totalBorrowed: 0,
        totalInterestPaid: 0,
        lastActivity: new Date().toISOString(),
        loanHistory: [],
      };
    }

    history.totalLoans++;
    history.totalBorrowed += loan.principal;
    history.lastActivity = new Date().toISOString();

    if (status === 'repaid') {
      history.repaidLoans++;
      history.totalInterestPaid += loan.interest;
    } else {
      history.defaultedLoans++;
    }

    history.loanHistory.push({
      loanId: loan.id,
      principal: loan.principal,
      interest: loan.interest,
      status,
      date: new Date().toISOString(),
    });

    // Keep last 100 entries
    if (history.loanHistory.length > 100) {
      history.loanHistory = history.loanHistory.slice(-100);
    }

    saveCreditHistory(history);
    log.info(`Credit history persisted for ${address}`, { tier: getTrustTier(address).name });
  } catch (err) {
    log.warn(`Failed to persist credit history: ${String(err)}`);
  }
}

// ─── Queries ────────────────────────────────────────────────

export function getActiveLoans(): Loan[] {
  return activeLoans.filter(l => l.status === 'active');
}

export function getAllLoans(ownerAddress?: string): Loan[] {
  if (!ownerAddress) return [...activeLoans];
  return activeLoans.filter(l => !l.ownerAddress || l.ownerAddress === ownerAddress);
}

export function getModuleStatsForOwner(ownerAddress: string) {
  const budget = getBudget(MODULE);
  const ownerLoans = activeLoans.filter(l => !l.ownerAddress || l.ownerAddress === ownerAddress);
  const repaidLoans = ownerLoans.filter(l => l.status === 'repaid');
  return {
    budget,
    activeLoans: ownerLoans.filter(l => l.status === 'active').length,
    totalLoans: ownerLoans.length,
    totalLent: ownerLoans.reduce((sum, l) => sum + l.principal, 0),
    totalRepaid: repaidLoans.reduce((sum, l) => sum + l.totalDue, 0),
    totalInterestEarned: repaidLoans.reduce((sum, l) => sum + l.interest, 0),
    overdueLoans: ownerLoans.filter(l => l.status === 'overdue').length,
  };
}

export { TRUST_TIERS };

export function getModuleStats() {
  const budget = getBudget(MODULE);
  const repaidLoans = activeLoans.filter(l => l.status === 'repaid');
  return {
    budget,
    activeLoans: activeLoans.filter(l => l.status === 'active').length,
    totalLoans: activeLoans.length,
    totalLent: activeLoans.reduce((sum, l) => sum + l.principal, 0),
    totalRepaid: repaidLoans.reduce((sum, l) => sum + l.totalDue, 0),
    totalInterestEarned: repaidLoans.reduce((sum, l) => sum + l.interest, 0),
    overdueLoans: activeLoans.filter(l => l.status === 'overdue').length,
  };
}
