/**
 * LendingEscrow contract interaction helpers.
 *
 * Contract: 0xe30Bfb13D17311c79216531e1716a077F9770a3E (Sepolia)
 *
 * Agent-side operations:
 *   - Read pendingCollateral(borrower)
 *   - approveLoan(borrower, collateral, principal, interest, duration)
 *   - liquidate(loanId)
 *
 * Borrower-side (for demo script):
 *   - depositCollateral() — send ETH to contract
 *   - repayLoan(loanId) — approve USDT + call repay
 */

import { encodeFunctionData, decodeFunctionResult, type Hex, type Address } from 'viem';
import { ethers } from 'ethers';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Escrow');

export const USDT_ADDRESS: Address = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
const USDT_DECIMALS = 6;

export function getEscrowAddress(): Address {
  const addr = process.env.LENDING_ESCROW_ADDRESS;
  if (!addr) throw new Error('LENDING_ESCROW_ADDRESS not set');
  return addr as Address;
}

// ─── ABI (minimal) ──────────────────────────────────────────

const ESCROW_ABI = [
  {
    name: 'pendingCollateral',
    type: 'function',
    inputs: [{ name: 'borrower', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'approveLoan',
    type: 'function',
    inputs: [
      { name: 'borrower', type: 'address' },
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'principalUsdt', type: 'uint256' },
      { name: 'interestUsdt', type: 'uint256' },
      { name: 'durationSeconds', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'liquidate',
    type: 'function',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'nextLoanId',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getLoan',
    type: 'function',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [
      { name: 'borrower', type: 'address' },
      { name: 'collateralWei', type: 'uint256' },
      { name: 'principalUsdt', type: 'uint256' },
      { name: 'totalDueUsdt', type: 'uint256' },
      { name: 'dueTimestamp', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'repaid', type: 'bool' },
      { name: 'liquidated', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'isOverdue',
    type: 'function',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'depositCollateral',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'repayLoan',
    type: 'function',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

// ─── Read helpers (via ethers provider) ─────────────────────

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(config.sepoliaRpcUrl);
}

function getContract(): ethers.Contract {
  return new ethers.Contract(
    getEscrowAddress(),
    [
      'function pendingCollateral(address) view returns (uint256)',
      'function nextLoanId() view returns (uint256)',
      'function getLoan(uint256) view returns (address,uint256,uint256,uint256,uint256,bool,bool,bool)',
      'function isOverdue(uint256) view returns (bool)',
    ],
    getProvider(),
  );
}

export async function readPendingCollateral(borrower: string): Promise<bigint> {
  const contract = getContract();
  const result = await contract.pendingCollateral(borrower);
  return BigInt(result.toString());
}

export async function readNextLoanId(): Promise<number> {
  const contract = getContract();
  const result = await contract.nextLoanId();
  return Number(result);
}

export interface OnChainLoan {
  borrower: string;
  collateralWei: bigint;
  principalUsdt: number;
  totalDueUsdt: number;
  dueTimestamp: number;
  active: boolean;
  repaid: boolean;
  liquidated: boolean;
}

export async function readLoan(loanId: number): Promise<OnChainLoan> {
  const contract = getContract();
  const r = await contract.getLoan(loanId);
  return {
    borrower: r[0],
    collateralWei: BigInt(r[1].toString()),
    principalUsdt: Number(r[2]) / 10 ** USDT_DECIMALS,
    totalDueUsdt: Number(r[3]) / 10 ** USDT_DECIMALS,
    dueTimestamp: Number(r[4]),
    active: r[5],
    repaid: r[6],
    liquidated: r[7],
  };
}

export async function readIsOverdue(loanId: number): Promise<boolean> {
  const contract = getContract();
  return contract.isOverdue(loanId);
}

// ─── Write helpers (encode calldata for sendRawTransaction) ─

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

/** Agent approves USDT spending by escrow (max approval to avoid per-tx approves) */
export function encodeApproveUsdtForEscrow(): Hex {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [getEscrowAddress(), MAX_UINT256],
  });
}

export function encodeApproveLoan(
  borrower: Address,
  collateralWei: bigint,
  principalUsdt: number,
  interestUsdt: number,
  durationSeconds: number,
): Hex {
  const principal = BigInt(Math.round(principalUsdt * 10 ** USDT_DECIMALS));
  const interest = BigInt(Math.round(interestUsdt * 10 ** USDT_DECIMALS));
  return encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'approveLoan',
    args: [borrower, collateralWei, principal, interest, BigInt(durationSeconds)],
  });
}

export function encodeLiquidate(loanId: number): Hex {
  return encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'liquidate',
    args: [BigInt(loanId)],
  });
}

// ─── Borrower-side encoders (for demo) ──────────────────────

export function encodeDepositCollateral(): Hex {
  return encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'depositCollateral',
    args: [],
  });
}

export function encodeApproveUsdtForRepay(amount: number): Hex {
  const raw = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [getEscrowAddress(), raw],
  });
}

export function encodeRepayLoan(loanId: number): Hex {
  return encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'repayLoan',
    args: [BigInt(loanId)],
  });
}

// ─── Build multi-step calls ─────────────────────────────────

/**
 * Agent: approve USDT to escrow + call approveLoan
 * Returns array of {to, data} for sequential execution
 */
export function buildApproveLoanCalls(
  borrower: Address,
  collateralWei: bigint,
  principalUsdt: number,
  interestUsdt: number,
  durationSeconds: number,
): Array<{ to: Address; data: Hex }> {
  return [
    { to: USDT_ADDRESS, data: encodeApproveUsdtForEscrow() },
    { to: getEscrowAddress(), data: encodeApproveLoan(borrower, collateralWei, principalUsdt, interestUsdt, durationSeconds) },
  ];
}
