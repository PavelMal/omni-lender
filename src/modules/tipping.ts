import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../wallet-os/audit.js';
import { requestSpend, getBudget } from '../wallet-os/core.js';
import type { ModuleRole } from '../wallet-os/types.js';

const log = createLogger('Tipping');

const MODULE: ModuleRole = 'tipping';

export interface RumbleEvent {
  type: 'watch_complete' | 'milestone' | 'like' | 'comment';
  creatorAddress: string;
  creatorName: string;
  watchPercent?: number;        // 0-100 for watch_complete
  milestoneType?: string;       // e.g. "1000_viewers", "1_hour_stream"
  videoTitle?: string;
}

export interface TipSplit {
  address: string;
  name: string;
  percent: number;
}

// Default splits: 100% to creator. Can be configured per creator.
const creatorSplits: Record<string, TipSplit[]> = {};

export function configureSplits(creatorAddress: string, splits: TipSplit[]): void {
  const total = splits.reduce((sum, s) => sum + s.percent, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Splits must sum to 100%, got ${total}%`);
  }
  creatorSplits[creatorAddress] = splits;
  log.info(`Splits configured for ${creatorAddress}`, { splits });
}

export async function handleRumbleEvent(
  event: RumbleEvent,
  llmReason: (prompt: string) => Promise<string>,
): Promise<void> {
  const budget = getBudget(MODULE);
  if (budget.remaining <= 0) {
    log.warn('Tipping budget exhausted, skipping event');
    logAudit({
      timestamp: new Date().toISOString(),
      module: MODULE,
      action: 'tip_skipped',
      reasoning: 'Budget exhausted — waiting for next allocation cycle',
      status: 'info',
    });
    return;
  }

  let tipAmount = 0;
  let reason = '';

  switch (event.type) {
    case 'watch_complete': {
      if ((event.watchPercent ?? 0) < config.tipping.minWatchPercent) {
        log.debug(`Watch ${event.watchPercent}% below threshold ${config.tipping.minWatchPercent}%, skipping`);
        return;
      }
      tipAmount = config.tipping.defaultAmount;
      reason = `Auto-tip: watched ${event.watchPercent}% of "${event.videoTitle}" by ${event.creatorName}`;
      break;
    }

    case 'milestone': {
      tipAmount = config.tipping.milestoneBonus;
      reason = `Milestone tip: ${event.creatorName} hit ${event.milestoneType}`;
      break;
    }

    case 'like':
    case 'comment': {
      tipAmount = Math.round(config.tipping.defaultAmount * 0.5 * 100) / 100;
      reason = `Engagement tip: ${event.type} on ${event.creatorName}'s content`;
      break;
    }
  }

  if (tipAmount <= 0) return;

  // Ask LLM for reasoning
  const llmInput = `Rumble tipping decision: ${reason}. Amount: $${tipAmount} USDT. Budget remaining: $${budget.remaining}. Should we tip? Brief reasoning.`;
  const llmReasoning = await llmReason(llmInput);

  // Apply splits
  const splits = creatorSplits[event.creatorAddress] ?? [
    { address: event.creatorAddress, name: event.creatorName, percent: 100 },
  ];

  for (const split of splits) {
    const splitAmount = Math.round((tipAmount * split.percent / 100) * 100) / 100;
    if (splitAmount <= 0) continue;

    const result = await requestSpend({
      moduleRole: MODULE,
      to: split.address,
      amount: splitAmount,
      asset: 'USDT',
      reason: `${reason} [split: ${split.percent}% to ${split.name}]. AI reasoning: ${llmReasoning}`,
    });

    if (result.approved) {
      log.info(`Tipped ${splitAmount} USDT to ${split.name}`, { txHash: result.txHash });
    } else {
      log.warn(`Tip failed: ${result.rejectionReason}`);
    }
  }
}

export function getModuleStats() {
  const budget = getBudget(MODULE);
  return {
    budget,
    configuredSplits: Object.keys(creatorSplits).length,
  };
}
