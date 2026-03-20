/**
 * ERC-4337 Bundler integration.
 * Constructs and sends UserOperations via a bundler RPC.
 *
 * For Sepolia we use a public bundler endpoint.
 * In production, use Pimlico, Stackup, or Alchemy bundler.
 */

import { createPublicClient, http, encodeFunctionData, type Hex, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Bundler');

// ─── Constants ──────────────────────────────────────────

const ENTRY_POINT: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const USDT_CONTRACT: Address = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';

// Bundler RPC — using public endpoint for Sepolia
// In production: use Pimlico (pimlico.io) or Stackup (stackup.sh)
const BUNDLER_RPC = process.env.BUNDLER_RPC_URL || 'https://public.stackup.sh/api/v1/node/ethereum-sepolia';

// Paymaster address — set after deployment
let paymasterAddress: Address = (process.env.PAYMASTER_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;

export function setPaymasterAddress(addr: string): void {
  paymasterAddress = addr as Address;
  log.info(`Paymaster address set: ${paymasterAddress}`);
}

export function getPaymasterAddress(): Address {
  return paymasterAddress;
}

// ─── Public client for on-chain reads ───────────────────

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'),
});

// ─── ERC-20 transferFrom encoding ───────────────────────

const ERC20_ABI = [
  {
    name: 'transferFrom',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/**
 * Build calldata for transferFrom(owner, destination, amount).
 */
export function encodeTransferFrom(from: Address, to: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transferFrom',
    args: [from, to, amount],
  });
}

// ─── UserOperation types ────────────────────────────────

interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

/**
 * Send a UserOperation to transfer USDT from user to destination.
 *
 * NOTE: For the hackathon MVP, this is partially simulated.
 * Real implementation requires:
 * 1. User's smart account (SimpleAccount from AA)
 * 2. Bundler that accepts UserOps
 * 3. Paymaster staked in EntryPoint
 *
 * Current approach: construct the UserOp structure and attempt to send.
 * Falls back to simulation hash if bundler rejects.
 */
export async function sendUserOperation(
  userAddress: Address,
  destinationAddress: Address,
  usdtAmount: number,
): Promise<{ hash: string; simulated: boolean }> {
  const rawAmount = BigInt(Math.round(usdtAmount * 1_000_000)); // 6 decimals

  const callData = encodeTransferFrom(userAddress, destinationAddress, rawAmount);

  try {
    // Get current gas price
    const gasPrice = await publicClient.getGasPrice();

    const userOp: UserOperation = {
      sender: userAddress,
      nonce: BigInt(0), // TODO: read from EntryPoint.getNonce()
      initCode: '0x',
      callData: encodeFunctionData({
        abi: [{
          name: 'execute',
          type: 'function',
          inputs: [
            { name: 'dest', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'func', type: 'bytes' },
          ],
          outputs: [],
        }],
        functionName: 'execute',
        args: [USDT_CONTRACT, BigInt(0), callData],
      }),
      callGasLimit: BigInt(100_000),
      verificationGasLimit: BigInt(100_000),
      preVerificationGas: BigInt(50_000),
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: gasPrice / BigInt(10),
      paymasterAndData: paymasterAddress !== '0x0000000000000000000000000000000000000000'
        ? paymasterAddress as Hex
        : '0x',
      signature: '0x', // TODO: sign with operator key
    };

    // Try sending to bundler
    const response = await fetch(BUNDLER_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [
          {
            sender: userOp.sender,
            nonce: `0x${userOp.nonce.toString(16)}`,
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
            verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
            preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
            maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
            maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
          },
          ENTRY_POINT,
        ],
      }),
    });

    const result = await response.json() as { result?: string; error?: { message: string } };

    if (result.result) {
      log.info(`UserOp sent: ${result.result}`);
      return { hash: result.result, simulated: false };
    }

    // Bundler rejected — fall back to simulation
    log.warn(`Bundler rejected: ${result.error?.message ?? 'unknown error'}`);
    throw new Error(result.error?.message ?? 'Bundler rejected');

  } catch (err) {
    // Fallback: simulate
    const hash = `0xsim_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
    log.info(`[simulated] UserOp: transferFrom(${userAddress}, ${destinationAddress}, ${usdtAmount} USDT) → ${hash}`);
    return { hash, simulated: true };
  }
}

/**
 * Send a batch UserOperation (multiple calls in one op).
 * Used for Aave: approve USDT + supply in one transaction.
 */
export async function sendBatchUserOperation(
  userAddress: Address,
  calls: Array<{ to: Address; data: Hex }>,
  description: string,
): Promise<{ hash: string; simulated: boolean }> {
  try {
    // For MVP: attempt to construct and send, fall back to simulation
    const gasPrice = await publicClient.getGasPrice();

    // Encode as executeBatch on SimpleAccount
    const batchCallData = encodeFunctionData({
      abi: [{
        name: 'executeBatch',
        type: 'function',
        inputs: [
          { name: 'dest', type: 'address[]' },
          { name: 'func', type: 'bytes[]' },
        ],
        outputs: [],
      }],
      functionName: 'executeBatch',
      args: [
        calls.map(c => c.to),
        calls.map(c => c.data),
      ],
    });

    log.info(`Batch UserOp (${calls.length} calls): ${description}`);

    // Try sending to bundler
    const response = await fetch(BUNDLER_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [
          {
            sender: userAddress,
            nonce: '0x0',
            initCode: '0x',
            callData: batchCallData,
            callGasLimit: `0x${(200_000).toString(16)}`,
            verificationGasLimit: `0x${(100_000).toString(16)}`,
            preVerificationGas: `0x${(50_000).toString(16)}`,
            maxFeePerGas: `0x${gasPrice.toString(16)}`,
            maxPriorityFeePerGas: `0x${(gasPrice / BigInt(10)).toString(16)}`,
            paymasterAndData: paymasterAddress !== '0x0000000000000000000000000000000000000000'
              ? paymasterAddress
              : '0x',
            signature: '0x',
          },
          ENTRY_POINT,
        ],
      }),
    });

    const result = await response.json() as { result?: string; error?: { message: string } };
    if (result.result) {
      log.info(`Batch UserOp sent: ${result.result}`);
      return { hash: result.result, simulated: false };
    }

    throw new Error(result.error?.message ?? 'Bundler rejected');
  } catch (err) {
    const hash = `0xsim_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
    log.info(`[simulated] Batch UserOp: ${description} → ${hash}`);
    return { hash, simulated: true };
  }
}

/**
 * Read an ERC-20 balance for an address.
 */
export async function readTokenBalance(token: Address, account: Address): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
    }],
    functionName: 'balanceOf',
    args: [account],
  });
}

/**
 * Check USDT allowance for a user → spender.
 */
export async function checkAllowance(owner: Address, spender: Address): Promise<bigint> {
  const result = await publicClient.readContract({
    address: USDT_CONTRACT,
    abi: [{
      name: 'allowance',
      type: 'function',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
    }],
    functionName: 'allowance',
    args: [owner, spender],
  });

  return result;
}
