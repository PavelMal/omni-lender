/**
 * Borrower Agent Demo — connects to OmniAgent via MCP and requests a collateralized loan.
 *
 * Full flow:
 *   1. Get lending terms (escrow contract address, rates)
 *   2. Deposit ETH as collateral into LendingEscrow contract
 *   3. Request USDT loan via MCP — agent verifies collateral on-chain, LLM evaluates
 *   4. Agent calls approveLoan() on escrow — USDT disbursed, collateral locked
 *   5. Borrower repays via repayLoan() on escrow — collateral returned
 *
 * Usage:
 *   npm run demo:borrower                          # simulation mode
 *   BORROWER_PRIVATE_KEY=0x... npm run demo:borrower  # real Sepolia
 *
 * Set BORROWER_PRIVATE_KEY in .env for persistent wallet across demo runs.
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ethers } from 'ethers';

const COLLATERAL_ETH = '0.003';
const LOAN_AMOUNT = 2; // USDT

function parse(result: any): any {
  const text = (result.content as any)[0].text;
  try {
    return JSON.parse(text);
  } catch {
    console.error('  [Raw MCP response]:', text);
    throw new Error(`MCP returned non-JSON: ${text.slice(0, 200)}`);
  }
}

async function main() {
  console.log('\n=== Borrower Agent Demo ===\n');

  // ─── Connect to OmniAgent MCP server ─────────────────────

  const useHttp = process.argv.includes('--http') || process.env.BORROWER_MODE === 'http';
  const webUrl = process.env.WEB_URL || 'http://localhost:3001';

  const client = new Client({ name: 'borrower-agent', version: '0.1.0' });

  if (useHttp) {
    console.log(`Connecting to OmniAgent web server at ${webUrl}/mcp/sse ...`);
    const transport = new SSEClientTransport(new URL(`${webUrl}/mcp/sse`));
    await client.connect(transport);
    console.log('Connected via HTTP SSE (events will appear in web dashboard).\n');
  } else {
    console.log('Spawning OmniAgent MCP server (stdio)...');
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'src/mcp-server.ts'],
      env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)),
    });
    await client.connect(transport);
    console.log('Connected via MCP stdio.\n');
  }

  // ─── Step 1: Get lending terms ────────────────────────────

  console.log('--- Step 1: Get lending terms ---');
  const terms = parse(await client.callTool({ name: 'wdk_get_lending_terms', arguments: {} }));
  console.log(`  Escrow contract: ${terms.escrowContract || 'not deployed (simulation)'}`);
  console.log(`  Collateral ratio: ${terms.collateralRatio}`);
  console.log(`  Interest rate: ${terms.interestRate}`);
  console.log(`  Max loan: $${terms.maxLoan} USDT`);

  const borrowerKey = process.env.BORROWER_PRIVATE_KEY;
  const escrowAddress = terms.escrowContract;
  const isRealMode = borrowerKey && escrowAddress;

  let borrowerAddress: string;

  // ─── Step 2: Deposit collateral ───────────────────────────

  console.log('\n--- Step 2: Deposit ETH collateral ---');

  if (isRealMode) {
    const provider = new ethers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    );
    const borrowerWallet = new ethers.Wallet(borrowerKey, provider);
    borrowerAddress = borrowerWallet.address;

    const ethBalance = await provider.getBalance(borrowerAddress);
    console.log(`  Borrower wallet: ${borrowerAddress}`);
    console.log(`  ETH balance: ${ethers.formatEther(ethBalance)} ETH`);

    console.log(`  Depositing ${COLLATERAL_ETH} ETH into LendingEscrow...`);

    // Call depositCollateral() on escrow contract
    const escrowIface = new ethers.Interface(['function depositCollateral() payable']);
    const data = escrowIface.encodeFunctionData('depositCollateral');

    const tx = await borrowerWallet.sendTransaction({
      to: escrowAddress,
      value: ethers.parseEther(COLLATERAL_ETH),
      data,
    });
    const receipt = await tx.wait();
    console.log(`  Collateral deposited! TX: ${receipt!.hash}`);

    // Verify
    const escrowContract = new ethers.Contract(
      escrowAddress,
      ['function pendingCollateral(address) view returns (uint256)'],
      provider,
    );
    const pending = await escrowContract.pendingCollateral(borrowerAddress);
    console.log(`  Pending collateral in contract: ${ethers.formatEther(pending)} ETH`);
  } else {
    borrowerAddress = '0xBorrowerAgent' + '0'.repeat(26);
    console.log('  [Simulation mode — no BORROWER_PRIVATE_KEY or escrow not deployed]');
    console.log(`  Borrower: ${borrowerAddress}`);
  }

  // ─── Step 3: Rejected — no collateral ──────────────────────

  console.log('\n--- Step 3: Request loan WITHOUT collateral ---');

  const rejected1 = parse(await client.callTool({
    name: 'wdk_request_loan',
    arguments: {
      borrowerAddress,
      borrowerName: 'ShadyBot-99',
      amount: 50,
      purpose: 'Quick flip on memecoin',
      repaymentDays: 3,
    },
  }));

  console.log(`  Decision: REJECTED`);
  console.log(`  Reason: ${rejected1.reason}`);

  // ─── Step 4: Rejected — insufficient collateral ───────────

  console.log('\n--- Step 4: Request $80 against $6 collateral ---');

  const rejected2 = parse(await client.callTool({
    name: 'wdk_request_loan',
    arguments: {
      borrowerAddress,
      borrowerName: 'OverleveragedAgent-7',
      amount: 80,
      purpose: 'Leverage trading',
      repaymentDays: 1,
      collateralized: true,
    },
  }));

  console.log(`  Decision: REJECTED`);
  console.log(`  Reason: ${rejected2.reason.split('\n')[0]}`);

  // ─── Step 5: Approved collateralized loan ─────────────────

  console.log('\n--- Step 5: Request $2 collateralized loan (should be approved) ---');
  console.log(`  Requesting $${LOAN_AMOUNT} USDT backed by ${COLLATERAL_ETH} ETH...`);

  const loanResult = parse(await client.callTool({
    name: 'wdk_request_loan',
    arguments: {
      borrowerAddress,
      borrowerName: 'DataProcessorAgent-42',
      amount: LOAN_AMOUNT,
      purpose: 'API compute credits for data processing job',
      repaymentDays: 7,
      collateralized: true,
    },
  }));

  console.log(`  Decision: ${loanResult.approved ? 'APPROVED' : 'REJECTED'}`);
  console.log(`  Reason: ${loanResult.reason}`);

  if (loanResult.loan) {
    const l = loanResult.loan;
    console.log(`  Loan ID: ${l.id}`);
    console.log(`  Disbursed: $${l.principal} USDT`);
    console.log(`  Total due: $${l.totalDue} (interest: $${l.interest})`);
    console.log(`  Due date: ${l.dueDate}`);
    if (l.collateral) {
      console.log(`  Collateral: ${l.collateral.amountEth} ETH ($${l.collateral.valueUsd?.toFixed(2)})`);
      console.log(`  LTV: ${l.collateral.ltvRatio?.toFixed(1)}%`);
    }
    console.log(`  TX: ${l.txHash}`);
  }

  // ─── Step 6: Check active loans ───────────────────────────

  console.log('\n--- Step 6: Active loans ---');
  const loans = parse(await client.callTool({ name: 'wdk_get_loans', arguments: {} }));
  console.log(`  Active: ${loans.activeLoans.length}`);

  // ─── Step 7: Repay loan (on-chain via escrow) ─────────────

  if (loanResult.loan && isRealMode) {
    console.log('\n--- Step 7: Repay loan via escrow ---');
    const provider = new ethers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    );
    const borrowerWallet = new ethers.Wallet(borrowerKey, provider);
    const usdtAddress = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';

    // Check if borrower has enough USDT to repay
    const usdtContract = new ethers.Contract(usdtAddress, [
      'function balanceOf(address) view returns (uint256)',
      'function approve(address,uint256) returns (bool)',
    ], borrowerWallet);
    const usdtBalance = Number(await usdtContract.balanceOf(borrowerAddress)) / 1e6;
    const totalDue = loanResult.loan.totalDue;

    if (usdtBalance >= totalDue) {
      const totalDueRaw = BigInt(Math.round(totalDue * 1e6));
      console.log(`  Approving $${totalDue} USDT to escrow...`);
      const approveTx = await usdtContract.approve(escrowAddress, totalDueRaw);
      await approveTx.wait();

      const escrow = new ethers.Contract(escrowAddress, [
        'function repayLoan(uint256)',
      ], borrowerWallet);
      const onChainId = loanResult.loan.onChainLoanId ?? 0;
      console.log(`  Calling repayLoan(${onChainId}) on escrow...`);
      const repayTx = await escrow.repayLoan(onChainId);
      const repayReceipt = await repayTx.wait();
      console.log(`  Loan repaid on-chain! TX: ${repayReceipt.hash}`);
      console.log(`  Collateral returned to ${borrowerAddress}`);

      // Notify agent so it updates state + audit log
      console.log('  Notifying agent of repayment...');
      const repayNotify = parse(await client.callTool({
        name: 'wdk_repay_loan',
        arguments: { loanId: loanResult.loan.id, amount: totalDue },
      }));
      console.log(`  Agent: ${repayNotify.message}`);
    } else {
      console.log(`  Borrower has $${usdtBalance} USDT, needs $${totalDue} to repay (principal + interest).`);
      console.log(`  In production, borrower earns the interest over the loan period.`);
      console.log(`  Loan remains active — collateral locked in escrow until repayment or liquidation.`);
    }
  } else if (loanResult.loan) {
    console.log('\n--- Step 7: Repay loan (simulation) ---');
    const repay = parse(await client.callTool({
      name: 'wdk_repay_loan',
      arguments: { loanId: loanResult.loan.id, amount: loanResult.loan.totalDue },
    }));
    console.log(`  ${repay.message}`);
  }

  // ─── Step 8: Audit trail ──────────────────────────────────

  console.log('\n--- Step 8: Audit trail ---');
  const audit = parse(await client.callTool({ name: 'wdk_get_audit_log', arguments: { limit: 10 } }));
  for (const e of audit) {
    const r = e.reasoning?.slice(0, 100) || '';
    console.log(`  [${e.module}] ${e.action} — ${r}${r.length >= 100 ? '...' : ''}`);
  }

  console.log('\n=== Borrower agent demo complete ===\n');
  await client.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Borrower demo failed:', err);
  process.exit(1);
});
