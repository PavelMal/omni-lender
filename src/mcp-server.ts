/**
 * MCP Server (standalone) — Exposes OmniAgent wallet + lending tools via stdio.
 *
 * Run standalone: tsx src/mcp-server.ts
 * Or integrate as stdio MCP server in OpenClaw config.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createLogger } from './utils/logger.js';
import { initWallet, getWalletState, isRealWdk, shutdown } from './wallet-os/core.js';
import { registerMcpTools } from './mcp-tools.js';

const log = createLogger('MCP');

const server = new McpServer({ name: 'omni-agent-wdk', version: '0.1.0' });

registerMcpTools(server);

async function main() {
  log.info('Initializing OmniAgent MCP Server...');

  await initWallet(undefined, 1000);
  log.info(`Wallet ready: ${getWalletState().address} (${isRealWdk() ? 'REAL WDK' : 'SIMULATION'})`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('MCP server running on stdio');

  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('MCP server failed:', err);
  process.exit(1);
});
