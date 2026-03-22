export type ModuleRole = 'treasury' | 'defi' | 'lending' | 'tipping';

export interface PolicyRule {
  moduleRole: ModuleRole;
  dailyLimit: number;
  perTxMax: number;
  whitelistAddresses: string[];
}

export interface SpendRequest {
  moduleRole: ModuleRole;
  to: string;
  amount: number;
  asset: 'USDT' | 'XAUT' | 'BTC';
  reason: string;
}

export interface SpendResult {
  approved: boolean;
  txHash?: string;
  rejectionReason?: string;
}

export interface AuditEntry {
  timestamp: string;
  module: ModuleRole | 'wallet-os';
  action: string;
  amount?: number;
  asset?: string;
  to?: string;
  txHash?: string;
  reasoning: string;
  status: 'approved' | 'rejected' | 'executed' | 'failed' | 'info';
  ownerAddress?: string;
}

export interface BudgetAllocation {
  defi: number;
  lending: number;
  tipping: number;
  reserve: number;
}

export interface ModuleBudget {
  allocated: number;
  spent: number;
  remaining: number;
}

export interface WalletState {
  address: string;
  totalBalance: number;
  budgets: Record<ModuleRole, ModuleBudget>;
  policies: Record<ModuleRole, PolicyRule>;
}
