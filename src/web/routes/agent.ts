/**
 * Agent REST API routes.
 * Allowance model: user approves USDT, agent operates within that budget.
 *
 * POST /connect        — create agent for user
 * GET  /status/:addr   — full agent state
 * POST /activate/:addr — start autonomous agent
 * POST /pause/:addr    — pause auto-cycle
 * POST /resume/:addr   — resume auto-cycle
 * POST /cycle/:addr    — manual cycle trigger
 * GET  /audit/:addr    — get audit log
 * GET  /positions/:addr — get DeFi positions
 * GET  /loans/:addr    — get active loans
 * POST /tip/:addr      — manual tip
 */

import { Router } from 'express';
import {
  createAgent, getAgent, startCycle, stopCycle,
  isCycleRunning, getOperatorAddress,
} from '../agent-manager.js';
import { getAuditLog, clearAuditLog } from '../../wallet-os/audit.js';
import { getModuleStats as getLendingStats } from '../../modules/lending.js';
import { broadcast } from '../ws.js';
import { scanAllCreators, formatCreatorsForLlm } from '../../tipping/rumble.js';
import { reason } from '../../agent/brain.js';

export const agentRouter = Router();

// POST /connect — { ownerAddress } → { operatorAddress, allowance }
agentRouter.post('/connect', async (req, res) => {
  try {
    const { ownerAddress } = req.body;
    if (!ownerAddress) {
      res.status(400).json({ error: 'ownerAddress required' });
      return;
    }

    const addr = ownerAddress.toLowerCase();
    const agent = await createAgent(addr);

    res.json({
      ownerAddress: addr,
      operatorAddress: getOperatorAddress(),
      allowance: agent.allowance,
      balance: agent.balance,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /status/:addr
agentRouter.get('/status/:addr', async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();
    const agent = getAgent(addr);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    await agent.refreshAllowance();
    const usdt = await agent.refreshBalance();
    const eth = await agent.getNativeBalance();

    const aaveBalance = await agent.getAaveBalance();

    res.json({
      ownerAddress: addr,
      operatorAddress: agent.operatorAddress,
      active: agent.isActive,
      autoCycle: isCycleRunning(addr),
      balance: { usdt, eth },
      allowance: agent.allowance,
      availableBudget: agent.availableBudget,
      budgets: agent.budgets,
      holdings: agent.holdings,
      positions: agent.positions,
      loans: agent.loans,
      aaveBalance,
      auditCount: agent.auditLog.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /activate/:addr
agentRouter.post('/activate/:addr', async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();
    const agent = getAgent(addr);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const result = await agent.activate();
    if (result.ok) {
      startCycle(addr);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /pause/:addr
agentRouter.post('/pause/:addr', async (req, res) => {
  const addr = req.params.addr.toLowerCase();
  stopCycle(addr);
  res.json({ paused: true });
});

// POST /resume/:addr
agentRouter.post('/resume/:addr', async (req, res) => {
  const addr = req.params.addr.toLowerCase();
  const ok = startCycle(addr);
  res.json({ resumed: ok });
});

// POST /cycle/:addr — manual cycle
agentRouter.post('/cycle/:addr', async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();
    const agent = getAgent(addr);
    if (!agent?.isActive) {
      res.status(400).json({ error: 'Agent not active' });
      return;
    }

    broadcast(addr, { type: 'cycle_start' });
    await agent.runCycle();
    broadcast(addr, { type: 'cycle_end' });

    res.json({ ok: true, balance: agent.balance, allowance: agent.allowance });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /audit/:addr — per-user audit + global (lending, wallet-os) audit merged
agentRouter.get('/audit/:addr', async (req, res) => {
  const addr = req.params.addr.toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const agent = getAgent(addr);
  const userEntries = agent ? agent.auditLog : [];
  const globalEntries = getAuditLog();

  // Merge and sort by timestamp, return latest
  const all = [...userEntries, ...globalEntries]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-limit);

  res.json(all);
});

// DELETE /audit/:addr — clear audit logs
agentRouter.delete('/audit/:addr', async (req, res) => {
  const addr = req.params.addr.toLowerCase();
  const agent = getAgent(addr);
  if (agent) {
    agent.auditLog.length = 0;
  }
  clearAuditLog();
  res.json({ ok: true });
});

// GET /positions/:addr
agentRouter.get('/positions/:addr', async (req, res) => {
  const addr = req.params.addr.toLowerCase();
  const agent = getAgent(addr);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent.positions);
});

// GET /loans/:addr
agentRouter.get('/loans/:addr', async (req, res) => {
  const addr = req.params.addr.toLowerCase();
  const agent = getAgent(addr);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent.loans);
});

// POST /withdraw/:addr — withdraw from DeFi position (vault)
agentRouter.post('/withdraw/:addr', async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();
    const agent = getAgent(addr);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const { positionIndex } = req.body;
    const idx = positionIndex ?? 0;
    const position = agent.positions[idx];
    if (!position) {
      res.status(400).json({ error: 'No position at that index' });
      return;
    }

    // Withdraw from ERC-4626 vault
    const { sendRawTransaction } = await import('../../wallet-os/wdk-wallet.js');
    const { Interface } = await import('ethers');
    const vaultAddr = process.env.YIELD_VAULT_ADDRESS;
    if (!vaultAddr) {
      res.status(500).json({ error: 'YIELD_VAULT_ADDRESS not set' });
      return;
    }

    const amount = position.deposited;
    const rawAmount = BigInt(Math.round(amount * 1e6));

    // vault.withdraw(assets, receiver=user, owner=operator)
    const vaultIface = new Interface([
      'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
    ]);
    const data = vaultIface.encodeFunctionData('withdraw', [
      rawAmount,
      addr,  // receiver = user
      getOperatorAddress(), // owner = operator (holds shares)
    ]);
    const result = await sendRawTransaction(vaultAddr, data);

    // Remove position
    agent.positions.splice(idx, 1);
    agent.saveState();

    res.json({ ok: true, txHash: result.hash, amount });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /reset/:addr — full reset: audit + state + remove agent
agentRouter.delete('/reset/:addr', async (req, res) => {
  const addr = req.params.addr.toLowerCase();
  const { removeAgent } = await import('../agent-manager.js');
  removeAgent(addr);
  clearAuditLog();

  // Delete per-user files
  const { existsSync, unlinkSync } = await import('fs');
  const { join } = await import('path');
  const paths = [
    join(process.cwd(), 'data', 'audit', `${addr}.json`),
    join(process.cwd(), 'data', 'state', `${addr}.json`),
  ];
  for (const p of paths) {
    try { if (existsSync(p)) unlinkSync(p); } catch {}
  }

  res.json({ ok: true });
});

// GET /lending-stats — lending stats filtered by owner
agentRouter.get('/lending-stats', async (req, res) => {
  const { getCreditProfile, getAllLoans, getModuleStatsForOwner } = await import('../../modules/lending.js');
  const { getDynamicRate } = await import('../../modules/lending.js');
  const owner = req.query.owner as string | undefined;
  const stats = owner ? getModuleStatsForOwner(owner.toLowerCase()) : getLendingStats();
  const dynamicRate = getDynamicRate();

  // Build borrowers list from loan history
  const loans = getAllLoans(owner?.toLowerCase());
  const borrowerMap = new Map<string, any>();
  for (const loan of loans) {
    const addr = loan.borrowerAddress;
    if (!borrowerMap.has(addr)) {
      const profile = getCreditProfile(addr);
      borrowerMap.set(addr, {
        address: addr,
        creditScore: profile.creditScore,
        trustTier: profile.trustTier.tier,
        totalBorrowed: profile.totalBorrowed,
        totalRepaid: profile.totalBorrowed - loans.filter(l => l.borrowerAddress === addr && l.status === 'active').reduce((s, l) => s + l.principal, 0),
        activeLoans: loans.filter(l => l.borrowerAddress === addr && l.status === 'active').length,
        defaultRate: profile.riskMetrics.defaultRate,
      });
    }
  }

  res.json({ ...stats, dynamicRate, borrowers: Array.from(borrowerMap.values()) });
});

// POST /vault-withdraw — withdraw all from yield vault to user
agentRouter.post('/vault-withdraw', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) { res.status(400).json({ error: 'to address required' }); return; }

    const { sendRawTransaction, getWdkAddress } = await import('../../wallet-os/wdk-wallet.js');
    const { getUserVaultBalance, buildVaultWithdrawCalls } = await import('../../defi/erc4626.js');
    const vaultAddr = process.env.YIELD_VAULT_ADDRESS;
    if (!vaultAddr) { res.status(500).json({ error: 'YIELD_VAULT_ADDRESS not set' }); return; }

    const agentAddr = getWdkAddress() as any;
    const balance = await getUserVaultBalance(vaultAddr as any, agentAddr);
    if (balance === BigInt(0)) { res.status(400).json({ error: 'Nothing to withdraw' }); return; }

    // withdraw(assets, receiver=to, owner=agent)
    const { encodeFunctionData } = await import('viem');
    const withdrawData = encodeFunctionData({
      abi: [{
        name: 'withdraw',
        type: 'function',
        inputs: [
          { name: 'assets', type: 'uint256' },
          { name: 'receiver', type: 'address' },
          { name: 'owner', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
      }],
      functionName: 'withdraw',
      args: [balance, to as `0x${string}`, agentAddr as `0x${string}`],
    });

    const result = await sendRawTransaction(vaultAddr as any, withdrawData);
    const amount = Number(balance) / 1e6;
    res.json({ ok: true, txHash: result.hash, amount });
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('INSUFFICIENT_FUNDS') || errStr.includes('insufficient funds')) {
      res.status(400).json({ error: 'Bot needs ETH for gas — send Sepolia ETH to operator wallet' });
    } else {
      res.status(500).json({ error: 'Withdraw failed — try again later' });
    }
  }
});

// GET /all-loans — loans filtered by owner if ?owner= provided
agentRouter.get('/all-loans', async (req, res) => {
  const { getAllLoans } = await import('../../modules/lending.js');
  const owner = req.query.owner as string | undefined;
  res.json(getAllLoans(owner?.toLowerCase()));
});

// GET /borrowers — borrower list filtered by owner
agentRouter.get('/borrowers', async (req, res) => {
  const { getCreditProfile, getAllLoans } = await import('../../modules/lending.js');
  const owner = req.query.owner as string | undefined;
  const loans = getAllLoans(owner?.toLowerCase());
  const seen = new Set<string>();
  const borrowers = [];
  for (const loan of loans) {
    if (seen.has(loan.borrowerAddress)) continue;
    seen.add(loan.borrowerAddress);
    const profile = getCreditProfile(loan.borrowerAddress);
    const activeLoanCount = loans.filter(l => l.borrowerAddress === loan.borrowerAddress && l.status === 'active').length;
    borrowers.push({
      address: loan.borrowerAddress,
      creditScore: profile.creditScore,
      trustTier: profile.trustTier.tier,
      totalBorrowed: profile.totalBorrowed,
      totalRepaid: profile.totalBorrowed - loans.filter(l => l.borrowerAddress === loan.borrowerAddress && l.status === 'active').reduce((s, l) => s + l.principal, 0),
      activeLoans: activeLoanCount,
      defaultRate: profile.riskMetrics.defaultRate,
    });
  }
  res.json(borrowers);
});

// GET /aave-balance/:addr — aUSDT balance (principal + yield)
agentRouter.get('/aave-balance/:addr', async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();
    const agent = getAgent(addr);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const aUsdtBalance = await agent.getAaveBalance();
    const positions = agent.positions.filter(p => p.protocol === 'Aave V3');
    const totalDeposited = positions.reduce((sum, p) => sum + p.deposited, 0);
    const yield_ = Math.max(0, aUsdtBalance - totalDeposited);

    res.json({
      aUsdtBalance,
      deposited: totalDeposited,
      yield: yield_,
      positions,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /withdraw-aave/:addr — { amount }
agentRouter.post('/withdraw-aave/:addr', async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();
    const agent = getAgent(addr);
    if (!agent?.isActive) {
      res.status(400).json({ error: 'Agent not active' });
      return;
    }

    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'amount required' });
      return;
    }

    const result = await agent.withdrawFromAave(Number(amount));
    if (!result) {
      res.status(500).json({ error: 'Withdraw failed' });
      return;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /search-creators/:addr — { query } → scan Rumble + Claude analysis
agentRouter.post('/search-creators/:addr', async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();
    const agent = getAgent(addr);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: 'query required' });
      return;
    }

    // 1. Scan Rumble with the user's query
    const creators = await scanAllCreators(query);

    if (creators.length === 0) {
      res.json({
        query,
        creators: [],
        analysis: `No Rumble creators found for "${query}".`,
      });
      return;
    }

    // 2. Ask Claude to analyze the results
    const creatorSummary = formatCreatorsForLlm(creators);
    const budget = agent.budgets.tipping;

    const analysis = await reason(
      `You are an autonomous tipping agent analyzing Rumble creators.\n` +
      `User query: "${query}"\n` +
      `Tipping budget remaining: $${budget.remaining} USDT\n\n` +
      `Creators found:\n${creatorSummary}\n\n` +
      `Analyze these creators. For each, comment on their engagement, content quality signals, ` +
      `and whether they deserve a tip. Recommend who to tip and how much ($0.50–$${Math.min(budget.remaining, 5)}). ` +
      `Be concise but specific.`
    );

    res.json({
      query,
      creators: creators.map(c => ({
        username: c.username,
        displayName: c.displayName,
        walletAddress: c.walletAddress,
        rumbleUrl: c.rumbleUrl,
        followers: c.followers,
        totalViews: c.totalViews,
        recentVideoCount: c.recentVideoCount,
        engagementScore: c.engagementScore,
        recentVideos: c.recentVideos.slice(0, 3),
      })),
      analysis,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /tip/:addr — { creatorAddress, creatorName, type? }
agentRouter.post('/tip/:addr', async (req, res) => {
  try {
    const addr = req.params.addr.toLowerCase();
    const agent = getAgent(addr);
    if (!agent?.isActive) {
      res.status(400).json({ error: 'Agent not active' });
      return;
    }

    const { creatorAddress, creatorName, type = 'milestone' } = req.body;
    if (!creatorAddress || !creatorName) {
      res.status(400).json({ error: 'creatorAddress and creatorName required' });
      return;
    }

    const result = await agent.handleTip(type, creatorAddress, creatorName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
