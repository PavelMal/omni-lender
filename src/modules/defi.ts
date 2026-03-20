import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../wallet-os/audit.js';
import { requestSpend, getBudget } from '../wallet-os/core.js';
import type { ModuleRole } from '../wallet-os/types.js';

const log = createLogger('DeFi');

const MODULE: ModuleRole = 'defi';

export interface YieldOpportunity {
  protocol: string;
  asset: 'USDT' | 'XAUT';
  apy: number;
  risk: 'low' | 'medium' | 'high';
  minDeposit: number;
  contractAddress: string;
}

interface ActivePosition {
  protocol: string;
  asset: 'USDT' | 'XAUT';
  deposited: number;
  currentApy: number;
  depositedAt: string;
  contractAddress: string;
}

const activePositions: ActivePosition[] = [];

// Simulated yield data (in production, fetch from on-chain or indexer)
function getAvailableYields(): YieldOpportunity[] {
  return [
    { protocol: 'Aave V3', asset: 'USDT', apy: 4.2, risk: 'low', minDeposit: 10, contractAddress: '0xaave...1' },
    { protocol: 'Compound', asset: 'USDT', apy: 3.8, risk: 'low', minDeposit: 10, contractAddress: '0xcomp...2' },
    { protocol: 'Velora', asset: 'USDT', apy: 6.1, risk: 'medium', minDeposit: 50, contractAddress: '0xvelo...3' },
    { protocol: 'Yearn', asset: 'USDT', apy: 5.5, risk: 'medium', minDeposit: 25, contractAddress: '0xyearn..4' },
  ];
}

export async function scanAndAllocate(
  llmReason: (prompt: string) => Promise<string>,
): Promise<void> {
  const budget = getBudget(MODULE);
  if (budget.remaining <= 0) {
    log.info('DeFi budget fully allocated');
    return;
  }

  const yields = getAvailableYields();
  const yieldSummary = yields
    .map(y => `${y.protocol}: ${y.apy}% APY (${y.risk} risk, min $${y.minDeposit})`)
    .join('\n');

  // Ask LLM to pick best strategy
  const reasoning = await llmReason(
    `DeFi allocation decision. Available budget: $${budget.remaining} USDT.\n\nYield opportunities:\n${yieldSummary}\n\nActive positions: ${activePositions.length > 0 ? activePositions.map(p => `${p.protocol}: $${p.deposited} at ${p.currentApy}%`).join(', ') : 'none'}\n\nRecommend allocation. Consider risk vs return. Be specific: which protocol, how much. Brief reasoning.`
  );

  log.info('LLM allocation reasoning', { reasoning });

  // Simple allocation: pick best risk-adjusted yield
  const sorted = [...yields]
    .filter(y => y.minDeposit <= budget.remaining)
    .sort((a, b) => {
      // Risk-adjusted: low risk = full APY, medium = 80%, high = 60%
      const riskMultiplier = { low: 1, medium: 0.8, high: 0.6 };
      return (b.apy * riskMultiplier[b.risk]) - (a.apy * riskMultiplier[a.risk]);
    });

  if (sorted.length === 0) {
    log.info('No suitable yield opportunities for current budget');
    return;
  }

  const best = sorted[0];
  const perTxMax = config.policyLimits.perTxMax;
  const depositAmount = Math.min(budget.remaining, budget.allocated * 0.5, perTxMax); // Respect per-tx limit

  const result = await requestSpend({
    moduleRole: MODULE,
    to: best.contractAddress,
    amount: depositAmount,
    asset: best.asset,
    reason: `Deposit to ${best.protocol} at ${best.apy}% APY (${best.risk} risk). ${reasoning}`,
  });

  if (result.approved) {
    activePositions.push({
      protocol: best.protocol,
      asset: best.asset,
      deposited: depositAmount,
      currentApy: best.apy,
      depositedAt: new Date().toISOString(),
      contractAddress: best.contractAddress,
    });
    log.info(`Deposited ${depositAmount} ${best.asset} to ${best.protocol}`, { txHash: result.txHash });
  }
}

export async function checkPositions(
  llmReason: (prompt: string) => Promise<string>,
): Promise<void> {
  if (activePositions.length === 0) {
    log.info('No active DeFi positions');
    return;
  }

  const currentYields = getAvailableYields();

  for (const position of activePositions) {
    const currentYield = currentYields.find(y => y.protocol === position.protocol);
    if (!currentYield) continue;

    // Check if yield dropped significantly
    if (currentYield.apy < position.currentApy * 0.7) {
      const reasoning = await llmReason(
        `DeFi position review: ${position.protocol} APY dropped from ${position.currentApy}% to ${currentYield.apy}%. Deposited: $${position.deposited}. Should we withdraw and reallocate?`
      );

      log.info(`Yield drop detected on ${position.protocol}`, {
        was: position.currentApy,
        now: currentYield.apy,
        reasoning,
      });

      logAudit({
        timestamp: new Date().toISOString(),
        module: MODULE,
        action: 'yield_drop_detected',
        amount: position.deposited,
        asset: position.asset,
        reasoning: `${position.protocol} APY: ${position.currentApy}% → ${currentYield.apy}%. ${reasoning}`,
        status: 'info',
      });
    }

    // Update current APY
    position.currentApy = currentYield.apy;
  }
}

export function getActivePositions(): ActivePosition[] {
  return [...activePositions];
}

export function getModuleStats() {
  const budget = getBudget(MODULE);
  return {
    budget,
    activePositions: activePositions.length,
    totalDeposited: activePositions.reduce((sum, p) => sum + p.deposited, 0),
  };
}
