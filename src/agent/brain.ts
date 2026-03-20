import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Brain');

const SYSTEM_PROMPT = `You are OmniAgent — an autonomous AI economic agent managing a self-custodial wallet via Tether WDK.

Your role is to make financial decisions across 4 domains:
1. TREASURY: Multi-asset allocation (USDT, XAU₮, BTC), rebalancing
2. DEFI: Yield farming, protocol selection, risk assessment
3. LENDING: Credit scoring, loan approval/rejection, repayment tracking
4. TIPPING: Rumble creator tipping, budget management, engagement-based tips

Decision principles:
- Always explain WHY you're making a decision, not just WHAT
- Be conservative with risk — protect capital first
- Consider budget limits — never recommend exceeding allocated budgets
- For lending: weight credit history heavily, be cautious with new borrowers
- For tipping: reward genuine engagement, not just views
- For DeFi: prefer low-risk protocols unless high-risk has >2x return

Respond concisely (2-3 sentences max). No markdown formatting. Just clear reasoning.`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export async function reason(prompt: string): Promise<string> {
  try {
    const response = await getClient().messages.create({
      model: config.llmModel,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join(' ');

    log.debug('LLM reasoning', { prompt: prompt.slice(0, 100), response: text.slice(0, 100) });
    return text;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('LLM call failed, using fallback reasoning', { error: errMsg });
    return `[Fallback] Decision made without LLM reasoning due to API error: ${errMsg}`;
  }
}
