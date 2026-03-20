/**
 * AgentManager — per-user agent lifecycle for the web API.
 * Allowance model: users keep their wallet, agent operates within approved amount.
 */

import { UserAgent } from '../agent/user-agent.js';
import type { AuditEntry } from '../agent/user-agent.js';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { broadcast } from './ws.js';
import { getWdkAddress, initWdkWallet } from '../wallet-os/wdk-wallet.js';
import { setDefaultTipAddress } from '../tipping/rumble.js';

const log = createLogger('AgentManager');

const agents = new Map<string, UserAgent>();
const cycleTimers = new Map<string, ReturnType<typeof setInterval>>();

const CYCLE_INTERVAL_MS = 60_000;

let operatorAddress = '';

/** Initialize the global operator wallet (used for signing transactions) */
export async function initOperator(): Promise<string> {
  if (!operatorAddress) {
    const { address } = await initWdkWallet();
    operatorAddress = address;
    // For testing: tips go to operator wallet instead of burn address
    setDefaultTipAddress(operatorAddress);
    log.info(`Operator wallet initialized: ${operatorAddress}`);
  }
  return operatorAddress;
}

export function getOperatorAddress(): string {
  return operatorAddress;
}

export async function createAgent(ownerAddress: string): Promise<UserAgent> {
  if (agents.has(ownerAddress)) {
    return agents.get(ownerAddress)!;
  }

  if (!operatorAddress) {
    await initOperator();
  }

  const agent = new UserAgent(ownerAddress, config.sepoliaRpcUrl, operatorAddress);
  await agent.init();

  // Wire audit events to WebSocket broadcast
  agent.onAudit = async (entry: AuditEntry) => {
    broadcast(ownerAddress, { type: 'audit', data: entry });
  };

  agents.set(ownerAddress, agent);
  log.info(`Agent created for ${ownerAddress}, allowance: ${agent.allowance} USDT`);
  return agent;
}

export function getAgent(ownerAddress: string): UserAgent | undefined {
  return agents.get(ownerAddress);
}

export function getAllAgents(): Map<string, UserAgent> {
  return agents;
}

export function startCycle(ownerAddress: string): boolean {
  const agent = agents.get(ownerAddress);
  if (!agent || !agent.isActive) return false;
  if (cycleTimers.has(ownerAddress)) return true;

  // Run first cycle immediately
  const runOnce = async () => {
    try {
      broadcast(ownerAddress, { type: 'cycle_start' });
      await agent.runCycle();
      broadcast(ownerAddress, { type: 'cycle_end' });

      const usdt = agent.balance;
      const eth = await agent.getNativeBalance();
      broadcast(ownerAddress, { type: 'balance', data: { usdt, eth, allowance: agent.allowance } });
    } catch (err) {
      log.error(`Cycle error for ${ownerAddress}`, { error: String(err) });
    }
  };

  runOnce();
  const timer = setInterval(runOnce, CYCLE_INTERVAL_MS);

  cycleTimers.set(ownerAddress, timer);
  log.info(`Auto-cycle started for ${ownerAddress}`);
  return true;
}

export function stopCycle(ownerAddress: string): void {
  const timer = cycleTimers.get(ownerAddress);
  if (timer) {
    clearInterval(timer);
    cycleTimers.delete(ownerAddress);
    log.info(`Auto-cycle stopped for ${ownerAddress}`);
  }
}

export function isCycleRunning(ownerAddress: string): boolean {
  return cycleTimers.has(ownerAddress);
}

export function removeAgent(ownerAddress: string): void {
  stopCycle(ownerAddress);
  const agent = agents.get(ownerAddress);
  if (agent) {
    agent.dispose();
    agents.delete(ownerAddress);
    log.info(`Agent removed for ${ownerAddress}`);
  }
}

export function shutdown(): void {
  for (const [addr] of cycleTimers) {
    stopCycle(addr);
  }
  for (const [, agent] of agents) {
    agent.dispose();
  }
  agents.clear();
  log.info('All agents shut down');
}
