/**
 * Real Aave V3 integration on Sepolia.
 *
 * Addresses:
 *   Pool:  0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
 *   USDT:  0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0
 *   aUSDT: 0xAF0F6e8b0Dc5c913bbF4d14c22B4E78Dd14310B6
 *
 * Flow:
 *   1. approve(Pool, amount) on USDT
 *   2. Pool.supply(USDT, amount, onBehalfOf=user, referralCode=0)
 *   3. User receives aUSDT (yield-bearing)
 *   4. Pool.withdraw(USDT, amount, to=user) to exit
 */

import { encodeFunctionData, type Hex, type Address } from 'viem';

// ─── Addresses (Sepolia) ────────────────────────────────

export const AAVE_POOL: Address = '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';
export const USDT_ADDRESS: Address = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
export const A_USDT_ADDRESS: Address = '0xAF0F6e8b0Dc5c913bbF4d14c22B4E78Dd14310B6';

const USDT_DECIMALS = 6;

// ─── ABIs (minimal) ─────────────────────────────────────

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
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const AAVE_POOL_ABI = [
  {
    name: 'supply',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'withdraw',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

// ─── Encode functions ───────────────────────────────────

/** Encode USDT.approve(AavePool, amount) */
export function encodeApproveForPool(amount: number): Hex {
  const rawAmount = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [AAVE_POOL, rawAmount],
  });
}

/** Encode AavePool.supply(USDT, amount, onBehalfOf, 0) */
export function encodeSupply(amount: number, onBehalfOf: Address): Hex {
  const rawAmount = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
  return encodeFunctionData({
    abi: AAVE_POOL_ABI,
    functionName: 'supply',
    args: [USDT_ADDRESS, rawAmount, onBehalfOf, 0],
  });
}

/** Encode AavePool.withdraw(USDT, amount, to) */
export function encodeWithdraw(amount: number, to: Address): Hex {
  const rawAmount = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
  return encodeFunctionData({
    abi: AAVE_POOL_ABI,
    functionName: 'withdraw',
    args: [USDT_ADDRESS, rawAmount, to],
  });
}

/** Encode AavePool.withdraw(USDT, type(uint256).max, to) — withdraw all */
export function encodeWithdrawAll(to: Address): Hex {
  const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  return encodeFunctionData({
    abi: AAVE_POOL_ABI,
    functionName: 'withdraw',
    args: [USDT_ADDRESS, MAX_UINT256, to],
  });
}

// ─── Multicall helper ───────────────────────────────────

/**
 * Build the two-step calldata for depositing into Aave:
 *   1. USDT.approve(Pool, amount)
 *   2. Pool.supply(USDT, amount, user, 0)
 *
 * Returns array of {to, data} calls to be batched in a UserOperation.
 */
export function buildSupplyCalls(amount: number, userAddress: Address): Array<{ to: Address; data: Hex }> {
  return [
    { to: USDT_ADDRESS, data: encodeApproveForPool(amount) },
    { to: AAVE_POOL, data: encodeSupply(amount, userAddress) },
  ];
}

/**
 * Build calldata for withdrawing from Aave:
 *   Pool.withdraw(USDT, amount, user)
 */
export function buildWithdrawCalls(amount: number, userAddress: Address): Array<{ to: Address; data: Hex }> {
  return [
    { to: AAVE_POOL, data: encodeWithdraw(amount, userAddress) },
  ];
}

// ─── Read helpers ───────────────────────────────────────

export { ERC20_ABI as AAVE_ERC20_ABI };

/** ABI for reading aUSDT balance (same as ERC20 balanceOf) */
export const A_TOKEN_ABI = ERC20_ABI;
