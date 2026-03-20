/**
 * Shared MCP tool definitions — used by both standalone mcp-server and web server.
 * Registers all wallet + lending tools on a given McpServer instance.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { config } from './config.js';
import {
  requestSpend,
  getWalletState,
  getBudget,
  isRealWdk,
} from './wallet-os/core.js';
import { getAuditLog } from './wallet-os/audit.js';
import {
  getNativeBalance,
  getUsdtBalance,
  estimateUsdtTransfer,
  usdtToRaw,
  rawToUsdt,
} from './wallet-os/wdk-wallet.js';
import type { ModuleRole } from './wallet-os/types.js';
import {
  evaluateLoanRequest,
  evaluateCollateralizedLoan,
  processRepayment,
  getActiveLoans,
  checkOverdueLoans,
} from './modules/lending.js';
import { reason } from './agent/brain.js';

export function registerMcpTools(server: McpServer): void {

  // ─── Wallet Tools ─────────────────────────────────────────

  server.tool(
    'wdk_get_address',
    'Get the current WDK wallet address',
    {},
    async () => {
      const state = getWalletState();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            address: state.address,
            mode: isRealWdk() ? 'REAL_WDK' : 'SIMULATION',
          }),
        }],
      };
    },
  );

  server.tool(
    'wdk_get_balance',
    'Get USDT balance (both on-chain and tracked)',
    {},
    async () => {
      const state = getWalletState();
      let onChainBalance: string | null = null;
      if (isRealWdk()) {
        try {
          const raw = await getUsdtBalance();
          onChainBalance = rawToUsdt(raw).toString();
        } catch { onChainBalance = null; }
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ trackedBalance: state.totalBalance, onChainBalance, mode: isRealWdk() ? 'REAL_WDK' : 'SIMULATION' }),
        }],
      };
    },
  );

  server.tool(
    'wdk_get_native_balance',
    'Get native ETH balance on Sepolia',
    {},
    async () => {
      if (!isRealWdk()) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Not in WDK mode' }) }] };
      }
      try {
        const balance = await getNativeBalance();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ balanceWei: balance.toString(), balanceEth: Number(balance) / 1e18 }) }],
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(err) }) }] };
      }
    },
  );

  server.tool(
    'wdk_get_budget',
    'Get budget status for a module',
    { module: z.enum(['treasury', 'defi', 'lending', 'tipping']).describe('Module to check budget for') },
    async ({ module }) => ({
      content: [{ type: 'text' as const, text: JSON.stringify(getBudget(module as ModuleRole)) }],
    }),
  );

  server.tool(
    'wdk_get_all_budgets',
    'Get budget status for all modules',
    {},
    async () => {
      const state = getWalletState();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ totalBalance: state.totalBalance, budgets: state.budgets }) }],
      };
    },
  );

  server.tool(
    'wdk_request_spend',
    'Request a policy-checked spend from a module budget.',
    {
      module: z.enum(['treasury', 'defi', 'lending', 'tipping']).describe('Which module budget to charge'),
      to: z.string().describe('Recipient address'),
      amount: z.number().positive().describe('Amount in USDT'),
      asset: z.string().default('USDT').describe('Asset type'),
      reason: z.string().describe('Reasoning for this spend'),
    },
    async ({ module, to, amount, asset, reason: spendReason }) => {
      const result = await requestSpend({ moduleRole: module as ModuleRole, to, amount, asset: asset as any, reason: spendReason });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'wdk_estimate_fee',
    'Estimate gas fee for a USDT transfer',
    {
      to: z.string().describe('Recipient address'),
      amount: z.number().positive().describe('Amount in USDT'),
    },
    async ({ to, amount }) => {
      if (!isRealWdk()) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ estimatedFeeWei: '21000000000000', note: 'Simulation estimate' }) }] };
      }
      try {
        const fee = await estimateUsdtTransfer(to, usdtToRaw(amount));
        return { content: [{ type: 'text' as const, text: JSON.stringify({ estimatedFeeWei: fee.toString() }) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: String(err) }) }] };
      }
    },
  );

  server.tool(
    'wdk_get_audit_log',
    'Get recent audit trail entries',
    { limit: z.number().int().positive().default(20).describe('Number of entries (default: 20)') },
    async ({ limit }) => ({
      content: [{ type: 'text' as const, text: JSON.stringify(getAuditLog().slice(-limit)) }],
    }),
  );

  server.tool(
    'wdk_get_policies',
    'Get current spending policies and limits',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(getWalletState().policies) }],
    }),
  );

  // ─── Lending Tools ────────────────────────────────────────

  server.tool(
    'wdk_get_lending_terms',
    'Get lending terms: escrow contract address, collateral ratio, interest rate, max loan.',
    {},
    async () => {
      let escrowAddress: string | null = null;
      try {
        const { getEscrowAddress } = await import('./defi/escrow.js');
        escrowAddress = getEscrowAddress();
      } catch { /* not configured */ }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            escrowContract: escrowAddress,
            agentWallet: getWalletState().address,
            acceptedCollateral: ['ETH'],
            collateralRatio: `${config.lending.collateralRatio}%`,
            maxLoan: config.lending.maxLoan,
            interestRate: `${config.lending.interestRate}%`,
            flow: escrowAddress
              ? 'Call depositCollateral() on escrow contract with ETH, then call wdk_request_loan.'
              : 'Escrow not deployed. Loans run in simulation mode.',
          }),
        }],
      };
    },
  );

  server.tool(
    'wdk_request_loan',
    'Request a USDT loan. For collateralized loans: first deposit ETH into LendingEscrow, then set collateralized=true.',
    {
      borrowerAddress: z.string().describe('Your wallet address'),
      borrowerName: z.string().describe('Identifier for the borrowing agent'),
      amount: z.number().positive().describe('Loan amount in USDT'),
      purpose: z.string().describe('Why you need this loan'),
      repaymentDays: z.number().int().positive().describe('Repayment period in days'),
      collateralized: z.boolean().optional().describe('Set true if you deposited ETH collateral'),
    },
    async ({ borrowerAddress, borrowerName, amount, purpose, repaymentDays, collateralized }) => {
      try {
        if (!collateralized) {
          const { logAudit } = await import('./wallet-os/audit.js');
          logAudit({
            timestamp: new Date().toISOString(),
            module: 'lending',
            action: 'loan_rejected',
            amount,
            asset: 'USDT',
            to: borrowerAddress,
            reasoning: `Rejected $${amount} loan — no collateral provided`,
            status: 'rejected',
          });
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                approved: false,
                reason: 'Collateral required. Deposit ETH into the LendingEscrow contract first (see wdk_get_lending_terms), then set collateralized=true.',
              }),
            }],
          };
        }

        const result = await evaluateCollateralizedLoan(
          { borrowerAddress, borrowerName, amount, purpose, repaymentDays, collateralType: 'ETH' },
          reason,
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              approved: result.approved,
              reason: result.reason,
              loan: result.loan ? {
                id: result.loan.id,
                principal: result.loan.principal,
                interest: result.loan.interest,
                totalDue: result.loan.totalDue,
                dueDate: result.loan.dueDate,
                txHash: result.loan.txHash,
                onChainLoanId: result.loan.onChainLoanId,
                collateral: result.loan.collateralType ? {
                  type: result.loan.collateralType,
                  amountEth: result.loan.collateralAmountEth,
                  valueUsd: result.loan.collateralValueUsd,
                  ltvRatio: result.loan.ltvRatio,
                } : undefined,
              } : undefined,
            }),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ approved: false, reason: `Internal error: ${String(err)}` }) }],
        };
      }
    },
  );

  server.tool(
    'wdk_repay_loan',
    'Repay an active loan. For collateralized loans, ETH collateral is returned on-chain.',
    {
      loanId: z.string().describe('The loan ID'),
      amount: z.number().positive().describe('Repayment amount in USDT (must be >= totalDue)'),
    },
    async ({ loanId, amount }) => {
      const result = await processRepayment(loanId, amount);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: result.success,
            message: result.success ? `Loan ${loanId} fully repaid` : 'Repayment failed',
            collateralReturned: result.collateralReturned,
          }),
        }],
      };
    },
  );

  server.tool(
    'wdk_get_loans',
    'Get all active loans. Also checks and flags overdue loans.',
    {},
    async () => {
      const overdue = await checkOverdueLoans();
      const active = getActiveLoans();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ activeLoans: active, newlyOverdue: overdue.length }) }],
      };
    },
  );
}
