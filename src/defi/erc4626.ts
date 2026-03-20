/**
 * Universal ERC-4626 Tokenized Vault adapter.
 *
 * Any vault implementing ERC-4626 can be used without custom code:
 *   deposit(assets, receiver) → shares
 *   withdraw(assets, receiver, owner) → shares
 *   asset() → underlying token address
 *   totalAssets() → total deposited
 *   convertToAssets(shares) → current value
 */

import { encodeFunctionData, type Hex, type Address } from 'viem';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ERC4626');

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'),
});

// ─── ABI (ERC-4626 standard) ────────────────────────────

const ERC4626_ABI = [
  {
    name: 'deposit',
    type: 'function',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'withdraw',
    type: 'function',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'asset',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'totalAssets',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'convertToAssets',
    type: 'function',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

const ERC20_APPROVE_ABI = [
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

// ─── Check if contract is ERC-4626 ─────────────────────

export async function isERC4626(vaultAddress: Address): Promise<boolean> {
  try {
    // Try calling asset() — if it returns an address, it's ERC-4626
    const asset = await client.readContract({
      address: vaultAddress,
      abi: ERC4626_ABI,
      functionName: 'asset',
    });
    // Also verify deposit exists by checking totalAssets
    await client.readContract({
      address: vaultAddress,
      abi: ERC4626_ABI,
      functionName: 'totalAssets',
    });
    return !!asset;
  } catch {
    return false;
  }
}

// ─── Read vault info ────────────────────────────────────

export interface VaultInfo {
  address: Address;
  asset: Address;       // underlying token
  totalAssets: bigint;  // total deposited in vault
  decimals: number;
}

export async function getVaultInfo(vaultAddress: Address): Promise<VaultInfo | null> {
  try {
    const [asset, totalAssets, decimals] = await Promise.all([
      client.readContract({ address: vaultAddress, abi: ERC4626_ABI, functionName: 'asset' }),
      client.readContract({ address: vaultAddress, abi: ERC4626_ABI, functionName: 'totalAssets' }),
      client.readContract({ address: vaultAddress, abi: ERC4626_ABI, functionName: 'decimals' }),
    ]);
    return { address: vaultAddress, asset, totalAssets, decimals };
  } catch (err) {
    log.warn(`Failed to read vault info for ${vaultAddress}: ${String(err).slice(0, 80)}`);
    return null;
  }
}

/** Get user's current value in vault (shares → assets) */
export async function getUserVaultBalance(vaultAddress: Address, userAddress: Address): Promise<bigint> {
  try {
    const shares = await client.readContract({
      address: vaultAddress,
      abi: ERC4626_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    });
    if (shares === BigInt(0)) return BigInt(0);
    return client.readContract({
      address: vaultAddress,
      abi: ERC4626_ABI,
      functionName: 'convertToAssets',
      args: [shares],
    });
  } catch {
    return BigInt(0);
  }
}

// ─── Build transaction calls ────────────────────────────

/**
 * Build calls for depositing into any ERC-4626 vault:
 *   1. underlying.approve(vault, amount)
 *   2. vault.deposit(amount, receiver)
 */
export function buildVaultDepositCalls(
  vaultAddress: Address,
  underlyingToken: Address,
  rawAmount: bigint,
  receiver: Address,
): Array<{ to: Address; data: Hex }> {
  return [
    {
      to: underlyingToken,
      data: encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [vaultAddress, rawAmount],
      }),
    },
    {
      to: vaultAddress,
      data: encodeFunctionData({
        abi: ERC4626_ABI,
        functionName: 'deposit',
        args: [rawAmount, receiver],
      }),
    },
  ];
}

/**
 * Build call for withdrawing from any ERC-4626 vault:
 *   vault.withdraw(amount, receiver, owner)
 */
export function buildVaultWithdrawCalls(
  vaultAddress: Address,
  rawAmount: bigint,
  receiver: Address,
): Array<{ to: Address; data: Hex }> {
  return [
    {
      to: vaultAddress,
      data: encodeFunctionData({
        abi: ERC4626_ABI,
        functionName: 'withdraw',
        args: [rawAmount, receiver, receiver],
      }),
    },
  ];
}
