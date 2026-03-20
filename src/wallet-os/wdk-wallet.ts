/**
 * Real WDK wallet integration.
 * Wraps @tetherto/wdk + @tetherto/wdk-wallet-evm for on-chain operations.
 */

import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import type { WalletAccountEvm } from '@tetherto/wdk-wallet-evm';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('WDK');

// Sepolia USDT contract (testnet) — official Tether USDT on Sepolia
const SEPOLIA_USDT_CONTRACT = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';

let wallet: WalletManagerEvm | null = null;
let account: WalletAccountEvm | null = null;
let walletAddress = '';

export interface WdkTxResult {
  hash: string;
  fee: bigint;
}

export async function initWdkWallet(): Promise<{ address: string }> {
  // Generate or reuse seed phrase
  let seedPhrase = config.operatorSeedPhrase;
  if (!seedPhrase) {
    seedPhrase = WDK.getRandomSeedPhrase();
    log.info('Generated new 12-word BIP-39 seed phrase via WDK');
  }

  wallet = new WalletManagerEvm(seedPhrase, {
    provider: config.sepoliaRpcUrl,
  });

  account = await wallet.getAccount(0);
  walletAddress = await account.getAddress();

  log.info(`WDK wallet initialized: ${walletAddress}`);
  return { address: walletAddress };
}

export async function getAddress(): Promise<string> {
  if (!account) throw new Error('Wallet not initialized. Call initWdkWallet() first.');
  return account.getAddress();
}

export async function getNativeBalance(): Promise<bigint> {
  if (!account) throw new Error('Wallet not initialized');
  return account.getBalance();
}

export async function getUsdtBalance(): Promise<bigint> {
  if (!account) throw new Error('Wallet not initialized');
  return account.getTokenBalance(SEPOLIA_USDT_CONTRACT);
}

export async function sendNative(to: string, valueWei: bigint): Promise<WdkTxResult> {
  if (!account) throw new Error('Wallet not initialized');

  log.info(`Sending ${valueWei} wei to ${to}`);
  const result = await account.sendTransaction({ to, value: valueWei });
  log.info(`TX sent: ${result.hash} (fee: ${result.fee} wei)`);
  return result;
}

export async function sendUsdt(to: string, amount: bigint): Promise<WdkTxResult> {
  if (!account) throw new Error('Wallet not initialized');

  // USDT has 6 decimals
  log.info(`Sending ${amount} USDT (raw) to ${to}`);
  const result = await account.transfer({
    token: SEPOLIA_USDT_CONTRACT,
    recipient: to,
    amount,
  });
  log.info(`USDT TX sent: ${result.hash} (fee: ${result.fee} wei)`);
  return result;
}

export async function estimateUsdtTransfer(to: string, amount: bigint): Promise<bigint> {
  if (!account) throw new Error('Wallet not initialized');

  const quote = await account.quoteTransfer({
    token: SEPOLIA_USDT_CONTRACT,
    recipient: to,
    amount,
  });
  return quote.fee;
}

export async function signMessage(message: string): Promise<string> {
  if (!account) throw new Error('Wallet not initialized');
  return account.sign(message);
}

export function getWdkAddress(): string {
  return walletAddress;
}

/**
 * Send a raw transaction with calldata (for contract calls like transferFrom, approve, etc.)
 * The operator wallet pays gas.
 */
export async function sendRawTransaction(to: string, data: string): Promise<WdkTxResult> {
  if (!account) throw new Error('Wallet not initialized');

  log.info(`Raw TX to ${to}, data: ${data.slice(0, 10)}...`);
  const result = await account.sendTransaction({ to, value: BigInt(0), data });
  log.info(`TX sent: ${result.hash} (fee: ${result.fee} wei)`);
  return result;
}

export function disposeWallet(): void {
  if (account) account.dispose();
  if (wallet) wallet.dispose();
  account = null;
  wallet = null;
  walletAddress = '';
  log.info('WDK wallet disposed');
}

// Helper: convert USDT amount (human-readable) to raw (6 decimals)
export function usdtToRaw(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000));
}

// Helper: convert raw USDT to human-readable
export function rawToUsdt(raw: bigint): number {
  return Number(raw) / 1_000_000;
}
