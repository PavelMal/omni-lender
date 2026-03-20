/**
 * Uniswap V3 swap integration on Sepolia.
 *
 * Verified pools with liquidity (Sepolia):
 *   USDT/WETH 0.3%  — 0x46bb6bb1b27069C652AA40ddbF47854b1C426428
 *   USDT/WBTC 0.3%  — 0x4b053461dd564CF8e0d2F9E3b73D78BD837de765
 *   USDT/DAI  0.05% — 0x0A9F4c21AcD09227108788bF264cD3FaF4DCEF2a
 *   USDT/USDC 0.05% — 0xd50312339C01a50ccf98D92B995e5A4E86A6Ce11
 *   USDT/LINK 0.3%  — 0x7A27BdD32A15c7dFD77cFa54DA21A097Ab45B11b
 *
 * Flow:
 *   1. approve(Router, amount) on tokenIn
 *   2. Router.exactInputSingle(params)
 *   3. Recipient receives tokenOut
 */

import { encodeFunctionData, type Hex, type Address } from 'viem';

// ─── Addresses (Sepolia) ────────────────────────────────

export const SWAP_ROUTER: Address = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E';

export const TOKENS: Record<string, { address: Address; decimals: number; fee: number }> = {
  USDT: { address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', decimals: 6, fee: 0 },
  WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18, fee: 3000 },
  WBTC: { address: '0x29f2D40B0605204364af54EC677bD022dA425d03', decimals: 8, fee: 3000 },
  DAI:  { address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357', decimals: 18, fee: 500 },
  USDC: { address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', decimals: 6, fee: 500 },
  LINK: { address: '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5', decimals: 18, fee: 3000 },
};

// Supported swap targets for portfolio rebalancing
export const SWAP_ASSETS = ['WETH', 'WBTC', 'DAI', 'LINK'] as const;
export type SwapAsset = typeof SWAP_ASSETS[number];

// ─── ABIs ───────────────────────────────────────────────

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

const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
  },
] as const;

// ─── Swap builders ──────────────────────────────────────

/**
 * Build calldata for swapping USDT → any supported token.
 * Returns two calls: approve USDT + swap.
 */
export function buildSwapFromUsdt(
  tokenOut: SwapAsset,
  amountUsdt: number,
  recipient: Address,
): Array<{ to: Address; data: Hex }> {
  const outToken = TOKENS[tokenOut];
  if (!outToken) throw new Error(`Unsupported token: ${tokenOut}`);

  const rawAmount = BigInt(Math.round(amountUsdt * 10 ** TOKENS.USDT.decimals));

  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [SWAP_ROUTER, rawAmount],
  });

  const swapData = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: TOKENS.USDT.address,
      tokenOut: outToken.address,
      fee: outToken.fee,
      recipient,
      amountIn: rawAmount,
      amountOutMinimum: BigInt(0), // testnet — no MEV
      sqrtPriceLimitX96: BigInt(0),
    }],
  });

  return [
    { to: TOKENS.USDT.address, data: approveData },
    { to: SWAP_ROUTER, data: swapData },
  ];
}

/**
 * Build calldata for swapping any token → USDT.
 */
export function buildSwapToUsdt(
  tokenIn: SwapAsset,
  rawAmountIn: bigint,
  recipient: Address,
): Array<{ to: Address; data: Hex }> {
  const inToken = TOKENS[tokenIn];
  if (!inToken) throw new Error(`Unsupported token: ${tokenIn}`);

  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [SWAP_ROUTER, rawAmountIn],
  });

  const swapData = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: inToken.address,
      tokenOut: TOKENS.USDT.address,
      fee: inToken.fee,
      recipient,
      amountIn: rawAmountIn,
      amountOutMinimum: BigInt(0),
      sqrtPriceLimitX96: BigInt(0),
    }],
  });

  return [
    { to: inToken.address, data: approveData },
    { to: SWAP_ROUTER, data: swapData },
  ];
}

export { ERC20_ABI as UNISWAP_ERC20_ABI };
