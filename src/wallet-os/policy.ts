import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from './audit.js';
import type { ModuleRole, PolicyRule, SpendRequest } from './types.js';

const log = createLogger('Policy');

// Track daily spend per module
const dailySpend: Record<ModuleRole, number> = {
  treasury: 0,
  defi: 0,
  lending: 0,
  tipping: 0,
};

let lastResetDate = new Date().toDateString();

function resetDailyIfNeeded(): void {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    for (const key of Object.keys(dailySpend) as ModuleRole[]) {
      dailySpend[key] = 0;
    }
    lastResetDate = today;
    log.info('Daily spend counters reset');
  }
}

export function getPolicies(): Record<ModuleRole, PolicyRule> {
  return {
    treasury: {
      moduleRole: 'treasury',
      dailyLimit: Infinity,
      perTxMax: Infinity,
      whitelistAddresses: [],
    },
    defi: {
      moduleRole: 'defi',
      dailyLimit: config.policyLimits.defiDailyLimit,
      perTxMax: config.policyLimits.perTxMax,
      whitelistAddresses: [],
    },
    lending: {
      moduleRole: 'lending',
      dailyLimit: config.policyLimits.lendingDailyLimit,
      perTxMax: config.policyLimits.perTxMax,
      whitelistAddresses: [],
    },
    tipping: {
      moduleRole: 'tipping',
      dailyLimit: config.policyLimits.tippingDailyLimit,
      perTxMax: config.policyLimits.perTxMax,
      whitelistAddresses: [],
    },
  };
}

export function evaluateSpendRequest(request: SpendRequest): { approved: boolean; reason: string } {
  resetDailyIfNeeded();

  const policies = getPolicies();
  const policy = policies[request.moduleRole];

  // Check per-transaction limit
  if (request.amount > policy.perTxMax) {
    const reason = `Per-tx limit exceeded: ${request.amount} > ${policy.perTxMax}`;
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
    return { approved: false, reason };
  }

  // Check daily limit
  const projectedDaily = dailySpend[request.moduleRole] + request.amount;
  if (projectedDaily > policy.dailyLimit) {
    const reason = `Daily limit exceeded: ${projectedDaily} > ${policy.dailyLimit}`;
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
    return { approved: false, reason };
  }

  // Check whitelist (if configured)
  if (policy.whitelistAddresses.length > 0 && !policy.whitelistAddresses.includes(request.to)) {
    const reason = `Address ${request.to} not in whitelist for ${request.moduleRole}`;
    log.warn(reason);
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
    return { approved: false, reason };
  }

  // Anomaly detection: flag if > 2x average
  const avgSpend = dailySpend[request.moduleRole] / Math.max(1, Object.values(dailySpend).filter(v => v > 0).length);
  if (avgSpend > 0 && request.amount > avgSpend * 3) {
    log.warn(`Anomaly detected: ${request.amount} is >3x average spend`, { module: request.moduleRole });
    // Log warning but still approve — anomaly is a flag, not a block
    logAudit({
      timestamp: new Date().toISOString(),
      module: request.moduleRole,
      action: 'anomaly_warning',
      amount: request.amount,
      asset: request.asset,
      reasoning: `Transaction amount ${request.amount} is >3x average — flagged for review`,
      status: 'info',
    });
  }

  // Approved
  dailySpend[request.moduleRole] += request.amount;

  logAudit({
    timestamp: new Date().toISOString(),
    module: request.moduleRole,
    action: 'spend_approved',
    amount: request.amount,
    asset: request.asset,
    to: request.to,
    reasoning: request.reason,
    status: 'approved',
  });

  return { approved: true, reason: 'Policy check passed' };
}

export function getDailySpend(): Record<ModuleRole, number> {
  return { ...dailySpend };
}
