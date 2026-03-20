/**
 * Chat route — talk to the agent's brain with full context.
 */

import { Router } from 'express';
import { reason } from '../../agent/brain.js';
import { getAgent } from '../agent-manager.js';

export const chatRouter = Router();

// POST /chat — { ownerAddress, message }
chatRouter.post('/chat', async (req, res) => {
  try {
    const { ownerAddress, message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'message required' });
      return;
    }

    // Build context from agent state if available
    let context = '';
    if (ownerAddress) {
      const agent = getAgent(ownerAddress.toLowerCase());
      if (agent) {
        const budgetLines = Object.entries(agent.budgets)
          .map(([k, v]) => `${k}: $${v.remaining}/$${v.allocated} remaining`)
          .join(', ');

        context = [
          `Owner wallet: ${agent.address}`,
          `Active: ${agent.isActive}`,
          `Balance: ${agent.balance} USDT, Allowance: ${agent.allowance} USDT`,
          `Budgets: ${budgetLines}`,
          `Holdings: USDT=$${agent.holdings.USDT}, XAUT=$${agent.holdings.XAUT}, BTC=$${agent.holdings.BTC}`,
          `DeFi positions: ${agent.positions.length}`,
          `Active loans: ${agent.loans.filter(l => l.status === 'active').length}`,
          `Recent actions: ${agent.auditLog.slice(-3).map(a => a.action).join(', ') || 'none'}`,
        ].join('\n');
      }
    }

    const prompt = context
      ? `Current agent state:\n${context}\n\nUser message: ${message}`
      : message;

    const response = await reason(prompt);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
