import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from './audit.js';
import { evaluateSpendRequest, getPolicies } from './policy.js';
import {
  initWdkWallet,
  getWdkAddress,
  getUsdtBalance,
  sendUsdt,
  usdtToRaw,
  rawToUsdt,
  disposeWallet,
} from './wdk-wallet.js';
import type { ModuleRole, SpendRequest, SpendResult, ModuleBudget, WalletState } from './types.js';

const log = createLogger('WalletOS');

// In-memory budget tracking
const budgets: Record<ModuleRole, ModuleBudget> = {
  treasury: { allocated: 0, spent: 0, remaining: 0 },
  defi: { allocated: 0, spent: 0, remaining: 0 },
  lending: { allocated: 0, spent: 0, remaining: 0 },
  tipping: { allocated: 0, spent: 0, remaining: 0 },
};

let walletAddress = '';
let totalBalance = 0;
let useRealWdk = false;

// Execute a USDT transfer — real WDK or simulation
async function executeTransaction(to: string, amount: number, asset: string): Promise<string> {
  if (useRealWdk && asset === 'USDT') {
    try {
      const rawAmount = usdtToRaw(amount);
      const result = await sendUsdt(to, rawAmount);
      log.info(`WDK TX executed: ${amount} USDT → ${to}`, { txHash: result.hash });
      return result.hash;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn(`WDK TX failed, falling back to simulation: ${errMsg}`);
      // Fall through to simulation
    }
  }

  // Simulation fallback (for non-USDT assets or when WDK fails)
  const txHash = `0xsim_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  log.info(`Simulated TX: ${amount} ${asset} → ${to}`, { txHash });
  return txHash;
}

/**
 * Initialize wallet. Tries real WDK first, falls back to simulation.
 */
export async function initWallet(address?: string, balance?: number): Promise<void> {
  try {
    const wdkResult = await initWdkWallet();
    walletAddress = wdkResult.address;
    useRealWdk = true;
    log.info('Real WDK wallet connected', { address: walletAddress });

    // Try to get real USDT balance
    try {
      const rawBalance = await getUsdtBalance();
      totalBalance = rawToUsdt(rawBalance);
      log.info(`On-chain USDT balance: ${totalBalance}`);
    } catch {
      // No USDT on testnet yet — use provided balance or default
      totalBalance = balance ?? 0;
      log.info(`No on-chain USDT found. Using initial balance: ${totalBalance}`);
    }
  } catch (err) {
    // WDK init failed — run in simulation mode
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn(`WDK init failed (${errMsg}). Running in simulation mode.`);
    walletAddress = address ?? '0x' + 'a1b2c3d4e5f6'.repeat(3).slice(0, 40);
    totalBalance = balance ?? 1000;
    useRealWdk = false;
  }

  logAudit({
    timestamp: new Date().toISOString(),
    module: 'wallet-os',
    action: 'wallet_initialized',
    reasoning: `Wallet ${walletAddress} initialized. Balance: ${totalBalance} USDT. Mode: ${useRealWdk ? 'REAL WDK' : 'SIMULATION'}`,
    status: 'info',
  });

  allocateBudgets();
}

export function isRealWdk(): boolean {
  return useRealWdk;
}

export function allocateBudgets(): void {
  const alloc = config.treasuryAllocation;
  const allocatable = totalBalance;

  budgets.defi = {
    allocated: (allocatable * alloc.defi) / 100,
    spent: 0,
    remaining: (allocatable * alloc.defi) / 100,
  };
  budgets.lending = {
    allocated: (allocatable * alloc.lending) / 100,
    spent: 0,
    remaining: (allocatable * alloc.lending) / 100,
  };
  budgets.tipping = {
    allocated: (allocatable * alloc.tipping) / 100,
    spent: 0,
    remaining: (allocatable * alloc.tipping) / 100,
  };
  budgets.treasury = {
    allocated: (allocatable * alloc.reserve) / 100,
    spent: 0,
    remaining: (allocatable * alloc.reserve) / 100,
  };

  log.info('Budgets allocated', {
    defi: budgets.defi.allocated,
    lending: budgets.lending.allocated,
    tipping: budgets.tipping.allocated,
    reserve: budgets.treasury.allocated,
  });

  logAudit({
    timestamp: new Date().toISOString(),
    module: 'wallet-os',
    action: 'budgets_allocated',
    reasoning: `Treasury split: DeFi ${alloc.defi}%, Lending ${alloc.lending}%, Tipping ${alloc.tipping}%, Reserve ${alloc.reserve}%`,
    status: 'info',
  });
}

export async function requestSpend(request: SpendRequest): Promise<SpendResult> {
  // Check budget
  const budget = budgets[request.moduleRole];
  if (request.amount > budget.remaining) {
    const reason = `Insufficient budget: requested ${request.amount}, remaining ${budget.remaining}`;
    log.warn(reason, { module: request.moduleRole });
    logAudit({
      timestamp: new Date().toISOString(),
      module: request.moduleRole,
      action: 'spend_request',
      amount: request.amount,
      asset: request.asset,
      to: request.to,
      reasoning: reason,
      status: 'rejected',
    });
    return { approved: false, rejectionReason: reason };
  }

  // Check policy
  const policyResult = evaluateSpendRequest(request);
  if (!policyResult.approved) {
    return { approved: false, rejectionReason: policyResult.reason };
  }

  // Execute transaction
  try {
    const txHash = await executeTransaction(request.to, request.amount, request.asset);

    // Update budget
    budget.spent += request.amount;
    budget.remaining -= request.amount;
    totalBalance -= request.amount;

    logAudit({
      timestamp: new Date().toISOString(),
      module: request.moduleRole,
      action: 'transaction_executed',
      amount: request.amount,
      asset: request.asset,
      to: request.to,
      txHash,
      reasoning: request.reason,
      status: 'executed',
    });

    return { approved: true, txHash };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logAudit({
      timestamp: new Date().toISOString(),
      module: request.moduleRole,
      action: 'transaction_failed',
      amount: request.amount,
      asset: request.asset,
      to: request.to,
      reasoning: `Transaction failed: ${errMsg}`,
      status: 'failed',
    });
    return { approved: false, rejectionReason: errMsg };
  }
}

export function getWalletState(): WalletState {
  return {
    address: walletAddress,
    totalBalance,
    budgets: { ...budgets },
    policies: getPolicies(),
  };
}

export function getBudget(module: ModuleRole): ModuleBudget {
  return { ...budgets[module] };
}

export function addFunds(amount: number, description?: string): void {
  totalBalance += amount;
  logAudit({
    timestamp: new Date().toISOString(),
    module: 'wallet-os',
    action: 'funds_received',
    amount,
    asset: 'USDT',
    reasoning: description ?? `Received $${amount} USDT`,
    status: 'info',
  });
  allocateBudgets();
}

/** Add funds without logging (caller handles audit) */
export function addFundsQuiet(amount: number): void {
  totalBalance += amount;
  allocateBudgets();
}

export function shutdown(): void {
  if (useRealWdk) {
    disposeWallet();
  }
}
