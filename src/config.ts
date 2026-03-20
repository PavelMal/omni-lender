import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing env var: ${key}`);
  return val;
}

function envInt(key: string, fallback: number): number {
  return parseInt(process.env[key] ?? String(fallback), 10);
}

export const config = {
  // Blockchain
  sepoliaRpcUrl: env('SEPOLIA_RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com'),
  operatorSeedPhrase: process.env.OPERATOR_SEED_PHRASE || '',

  // LLM
  anthropicApiKey: env('ANTHROPIC_API_KEY'),
  llmModel: env('LLM_MODEL', 'claude-sonnet-4-6'),

  // Treasury allocation (percentages, must sum to 100)
  treasuryAllocation: {
    defi: envInt('TREASURY_ALLOCATION_DEFI', 60),
    lending: envInt('TREASURY_ALLOCATION_LENDING', 20),
    tipping: envInt('TREASURY_ALLOCATION_TIPPING', 10),
    reserve: envInt('TREASURY_ALLOCATION_RESERVE', 10),
  },

  // Policy limits (in USDT units)
  policyLimits: {
    defiDailyLimit: envInt('DEFI_DAILY_LIMIT', 1000),
    lendingDailyLimit: envInt('LENDING_DAILY_LIMIT', 500),
    tippingDailyLimit: envInt('TIPPING_DAILY_LIMIT', 100),
    perTxMax: envInt('PER_TX_MAX', 200),
  },

  // Tipping
  tipping: {
    minWatchPercent: envInt('TIPPING_MIN_WATCH_PERCENT', 80),
    defaultAmount: envInt('TIPPING_DEFAULT_AMOUNT', 2),
    milestoneBonus: envInt('TIPPING_MILESTONE_BONUS', 5),
  },

  // Lending
  lending: {
    maxLoan: envInt('LENDING_MAX_LOAN', 100),
    minCreditScore: envInt('LENDING_MIN_CREDIT_SCORE', 50),
    interestRate: envInt('LENDING_INTEREST_RATE', 5),
    collateralRatio: envInt('LENDING_COLLATERAL_RATIO', 150), // 150% = deposit $150 ETH for $100 USDT
  },

  // Logging
  logLevel: env('LOG_LEVEL', 'info'),
  auditLogPath: env('AUDIT_LOG_PATH', 'logs/audit.json'),
} as const;

export type Config = typeof config;
