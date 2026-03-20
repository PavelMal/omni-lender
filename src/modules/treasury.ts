import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../wallet-os/audit.js';
import { getWalletState, requestSpend } from '../wallet-os/core.js';
import type { ModuleRole } from '../wallet-os/types.js';

const log = createLogger('Treasury');

const MODULE: ModuleRole = 'treasury';

interface AssetAllocation {
  asset: 'USDT' | 'XAUT' | 'BTC';
  targetPercent: number;
  currentPercent: number;
  currentAmount: number;
}

// Simulated multi-asset holdings
const holdings: Record<string, number> = {
  USDT: 0,
  XAUT: 0,
  BTC: 0,
};

const TARGET_ALLOCATION = {
  USDT: 60,
  XAUT: 25,
  BTC: 15,
};

export function initTreasury(totalUsdt: number): void {
  holdings.USDT = totalUsdt;
  holdings.XAUT = 0;
  holdings.BTC = 0;

  log.info('Treasury initialized', { balance: totalUsdt });
  logAudit({
    timestamp: new Date().toISOString(),
    module: MODULE,
    action: 'treasury_initialized',
    amount: totalUsdt,
    asset: 'USDT',
    reasoning: `Treasury holds ${totalUsdt} USDT. Target: ${TARGET_ALLOCATION.USDT}% USDT, ${TARGET_ALLOCATION.XAUT}% XAU₮, ${TARGET_ALLOCATION.BTC}% BTC`,
    status: 'info',
  });
}

export function getHoldings(): Record<string, number> {
  return { ...holdings };
}

export function getAllocations(): AssetAllocation[] {
  const total = holdings.USDT + holdings.XAUT + holdings.BTC;
  if (total === 0) return [];

  return (['USDT', 'XAUT', 'BTC'] as const).map(asset => ({
    asset,
    targetPercent: TARGET_ALLOCATION[asset],
    currentPercent: Math.round((holdings[asset] / total) * 100),
    currentAmount: holdings[asset],
  }));
}

export async function checkAndRebalance(llmReason: (prompt: string) => Promise<string>): Promise<void> {
  const allocations = getAllocations();
  if (allocations.length === 0) {
    log.info('No holdings to rebalance');
    return;
  }

  // Check if rebalance needed (>10% drift from target)
  const drifts = allocations.filter(a => Math.abs(a.currentPercent - a.targetPercent) > 10);

  if (drifts.length === 0) {
    log.info('Portfolio within target allocation, no rebalance needed');
    return;
  }

  // Ask LLM for reasoning
  const driftDesc = drifts.map(d => `${d.asset}: current ${d.currentPercent}%, target ${d.targetPercent}%`).join('; ');
  const reasoning = await llmReason(
    `Treasury rebalance needed. Current drift: ${driftDesc}. Total holdings: USDT=${holdings.USDT}, XAU₮=${holdings.XAUT}, BTC=${holdings.BTC}. Should we rebalance now? Explain briefly.`
  );

  log.info('Rebalancing portfolio', { drifts: driftDesc, reasoning });

  // Execute rebalance (simulated swaps)
  const total = holdings.USDT + holdings.XAUT + holdings.BTC;
  for (const asset of ['USDT', 'XAUT', 'BTC'] as const) {
    const target = (total * TARGET_ALLOCATION[asset]) / 100;
    holdings[asset] = Math.round(target * 100) / 100;
  }

  logAudit({
    timestamp: new Date().toISOString(),
    module: MODULE,
    action: 'portfolio_rebalanced',
    reasoning: `Rebalanced to targets. ${reasoning}`,
    status: 'executed',
  });

  log.info('Rebalance complete', getHoldings());
}
