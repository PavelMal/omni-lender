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
import type { ModuleRole } from '../wallet-os/types.js';
import type { Address } from 'viem';

const log = createLogger('Lending');

const MODULE: ModuleRole = 'lending';

export interface LoanRequest {
  borrowerAddress: string;
  borrowerName: string;
  amount: number;
  purpose: string;
  repaymentDays: number;
  collateralTxHash?: string;
  collateralType?: 'ETH';
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
  // Collateral fields
  collateralType?: 'ETH';
  collateralAmountWei?: string;   // stored as string for JSON safety with bigint
  collateralAmountEth?: number;
  collateralValueUsd?: number;
  collateralTxHash?: string;
  ltvRatio?: number;
  onChainLoanId?: number;     // LendingEscrow contract loan ID
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

function getCreditScore(address: string): number {
  const profile = borrowerHistory[address];
  if (!profile) return 30; // New borrower: low score

  const repaymentRate = profile.totalLoans > 0
    ? (profile.repaidLoans / profile.totalLoans) * 100
    : 0;

  // Score: base 30 + repayment rate (max 50) + loan count bonus (max 20)
  const loanBonus = Math.min(20, profile.totalLoans * 4);
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
    id: `LOAN-${Date.now().toString(36)}`,
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
  const requiredRatio = config.lending.collateralRatio / 100;
  const maxLoan = collateralValueUsd / requiredRatio;

  if (request.amount > maxLoan) {
    const reason = `Rejected $${request.amount} loan — insufficient collateral. ${collateralAmountEth.toFixed(4)} ETH ($${collateralValueUsd.toFixed(2)}) covers max $${maxLoan.toFixed(2)} at ${config.lending.collateralRatio}% ratio`;
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
  const actualLtv = (request.amount / collateralValueUsd) * 100;

  const reasoning = await llmReason(
    `Collateralized loan evaluation:\n` +
    `- Borrower: ${request.borrowerName} (${request.borrowerAddress})\n` +
    `- Collateral: ${collateralAmountEth.toFixed(4)} ETH ($${collateralValueUsd.toFixed(2)} at $${ethPrice}/ETH)\n` +
    `- Collateral held in: LendingEscrow smart contract (trustless)\n` +
    `- Requested: $${request.amount} USDT\n` +
    `- LTV: ${actualLtv.toFixed(1)}% (max ${((1 / requiredRatio) * 100).toFixed(0)}%)\n` +
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
  const interest = Math.round(request.amount * (config.lending.interestRate / 100) * 100) / 100;
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
    id: `CLOAN-${Date.now().toString(36)}`,
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

  // Single consolidated audit entry
  logAudit({
    timestamp: new Date().toISOString(),
    module: MODULE,
    action: 'loan_repaid',
    amount,
    asset: 'USDT',
    txHash: collateralReturned?.txHash,
    reasoning: `Received $${amount} USDT ($${loan.principal} principal + $${loan.interest} interest). Profit: +$${loan.interest} USDT${collateralReturned ? `. Collateral ${collateralReturned.amountEth} ETH returned` : ''}`,
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

// ─── Queries ────────────────────────────────────────────────

export function getActiveLoans(): Loan[] {
  return activeLoans.filter(l => l.status === 'active');
}

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
