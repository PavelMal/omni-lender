/**
 * DeFi yield scanner — discovers opportunities from DeFiLlama.
 *
 * DeFiLlama indexes mainnet only. We use mainnet APY data for
 * decision-making, then route real deposits to Sepolia deployments
 * of the same protocols (Aave V3, Compound V3, etc.).
 * Testnet yields are 0%, but the full tx pipeline is real.
 */

import { createLogger } from '../utils/logger.js';
import { isERC4626, getVaultInfo } from './erc4626.js';
import type { Address } from 'viem';

const log = createLogger('DeFiScanner');

// ─── Types ──────────────────────────────────────────────

export interface YieldPool {
  protocol: string;
  pool: string;
  apy: number;
  tvl: number;
  chain: string;
  asset: string;
  vaultAddress?: string;
  isERC4626: boolean;
  risk: 'low' | 'medium' | 'high';
}

// ─── DeFiLlama API ──────────────────────────────────────

interface LlamaPool {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase?: number;
  stablecoin?: boolean;
}

/**
 * Scan DeFiLlama for USDT yield opportunities on Ethereum.
 * Returns top pools sorted by risk-adjusted APY.
 */
export async function scanYieldPools(limit: number = 10): Promise<YieldPool[]> {
  try {
    const res = await fetch('https://yields.llama.fi/pools');
    if (!res.ok) throw new Error(`DeFiLlama API error: ${res.status}`);

    const data = await res.json() as { data: LlamaPool[] };

    // Protocols we can actually deposit into on Sepolia
    const SUPPORTED_PROTOCOLS = new Set([
      'aave-v3', 'aave-v2', 'spark', 'compound-v3', 'morpho',
    ]);

    // Filter: Ethereum, USDT-related, positive APY, minimum TVL, supported protocol
    const usdtPools = data.data
      .filter(p =>
        p.chain === 'Ethereum' &&
        (p.symbol.includes('USDT') || p.symbol.includes('USD')) &&
        p.apy > 0 &&
        p.apy < 50 && // Filter out suspicious >50% APY
        p.tvlUsd > 100_000 && // Minimum $100K TVL
        SUPPORTED_PROTOCOLS.has(p.project.toLowerCase())
      )
      .sort((a, b) => assessRiskAdjustedApy(b) - assessRiskAdjustedApy(a))
      .slice(0, limit);

    return usdtPools.map(p => ({
      protocol: p.project,
      pool: p.pool,
      apy: Math.round(p.apy * 100) / 100,
      tvl: Math.round(p.tvlUsd),
      chain: p.chain,
      asset: p.symbol,
      isERC4626: false, // will be checked on-chain
      risk: assessRisk(p),
    }));
  } catch (err) {
    log.warn(`DeFiLlama scan failed: ${String(err).slice(0, 100)}`);
    return [];
  }
}

/**
 * Verify if a vault address supports ERC-4626 on-chain.
 * If yes, it can be used directly without custom code.
 * If not, log that it needs an adapter.
 */
export async function verifyVault(pool: YieldPool, vaultAddress: Address): Promise<YieldPool> {
  const supported = await isERC4626(vaultAddress);
  if (supported) {
    const info = await getVaultInfo(vaultAddress);
    log.info(`Vault ${pool.protocol} (${vaultAddress}) is ERC-4626 compatible, TVL: ${info?.totalAssets ?? 'unknown'}`);
    return { ...pool, vaultAddress, isERC4626: true };
  } else {
    log.warn(`Vault ${pool.protocol} (${vaultAddress}) is NOT ERC-4626 — needs custom adapter`);
    return { ...pool, vaultAddress, isERC4626: false };
  }
}

// ─── Risk assessment ────────────────────────────────────

function assessRisk(pool: LlamaPool): 'low' | 'medium' | 'high' {
  // Low risk: stablecoins, high TVL, established protocols
  if (pool.tvlUsd > 10_000_000 && pool.apy < 8) return 'low';
  // High risk: low TVL, very high APY
  if (pool.tvlUsd < 1_000_000 || pool.apy > 20) return 'high';
  return 'medium';
}

function assessRiskAdjustedApy(pool: LlamaPool): number {
  const riskMult = assessRisk(pool) === 'low' ? 1 : assessRisk(pool) === 'medium' ? 0.8 : 0.5;
  return pool.apy * riskMult;
}

/**
 * Format pools for Claude to evaluate.
 * Returns a human-readable summary for LLM reasoning.
 */
export function formatPoolsForLlm(pools: YieldPool[]): string {
  if (pools.length === 0) return 'No yield pools found.';

  return pools.map((p, i) =>
    `${i + 1}. ${p.protocol} — ${p.asset} — ${p.apy}% APY — TVL $${(p.tvl / 1e6).toFixed(1)}M — Risk: ${p.risk}${p.isERC4626 ? ' [ERC-4626 ✓]' : ' [needs adapter]'}`
  ).join('\n');
}
