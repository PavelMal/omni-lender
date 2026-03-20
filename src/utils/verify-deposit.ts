/**
 * Verify an ETH deposit on-chain by tx hash.
 * Confirms the tx exists, succeeded, and sent ETH to the expected recipient.
 */

import { ethers } from 'ethers';
import { config } from '../config.js';
import { createLogger } from './logger.js';

const log = createLogger('Verify');

export interface DepositVerification {
  verified: boolean;
  amountWei: bigint;
  amountEth: number;
  from: string;
  error?: string;
}

export async function verifyEthDeposit(
  txHash: string,
  expectedRecipient: string,
): Promise<DepositVerification> {
  const provider = new ethers.JsonRpcProvider(config.sepoliaRpcUrl);

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    log.warn(`TX ${txHash} not found or failed`);
    return { verified: false, amountWei: 0n, amountEth: 0, from: '', error: 'TX not found or failed' };
  }

  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    return { verified: false, amountWei: 0n, amountEth: 0, from: '', error: 'TX data not found' };
  }

  if (tx.to?.toLowerCase() !== expectedRecipient.toLowerCase()) {
    return {
      verified: false, amountWei: 0n, amountEth: 0, from: tx.from,
      error: `Recipient ${tx.to} does not match agent wallet ${expectedRecipient}`,
    };
  }

  const amountWei = tx.value;
  const amountEth = Number(ethers.formatEther(amountWei));

  log.info(`Verified deposit: ${amountEth} ETH from ${tx.from}`);
  return { verified: true, amountWei, amountEth, from: tx.from };
}
