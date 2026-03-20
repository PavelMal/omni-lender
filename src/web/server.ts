/**
 * Web server — Express + WebSocket on port 3001.
 * Serves the REST API and real-time WebSocket events.
 *
 * Usage: npm run web
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { existsSync } from 'fs';
import { join } from 'path';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createLogger } from '../utils/logger.js';
import { agentRouter } from './routes/agent.js';
import { chatRouter } from './routes/chat.js';
import { initWebSocket, broadcastAll, shutdownWs } from './ws.js';
import { shutdown as shutdownAgents, initOperator, getOperatorAddress } from './agent-manager.js';
import { registerMcpTools } from '../mcp-tools.js';
import { getAuditLog } from '../wallet-os/audit.js';
import { initWallet } from '../wallet-os/core.js';

const log = createLogger('WebServer');
const PORT = Number(process.env.PORT) || 3001;

const app = express();

app.use(cors());
// Skip JSON parsing for MCP message endpoint (SSE transport reads raw body)
app.use((req, res, next) => {
  if (req.path === '/mcp/message') return next();
  express.json()(req, res, next);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files (production build)
const frontendDist = join(process.cwd(), 'frontend', 'dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Mount routes
app.use('/api/agent', agentRouter);
app.use('/api', chatRouter);

// ─── MCP over SSE ───────────────────────────────────────────
// External agents connect here to use lending, wallet, and audit tools.
// Same process as web server → shared audit log → events appear in dashboard.

const mcpServer = new McpServer({ name: 'omni-agent-wdk', version: '0.1.0' });
registerMcpTools(mcpServer);

const mcpTransports = new Map<string, SSEServerTransport>();

// GET /mcp/sse — establish SSE connection
app.get('/mcp/sse', async (req, res) => {
  log.info('MCP SSE client connecting...');
  const transport = new SSEServerTransport('/mcp/message', res);
  mcpTransports.set(transport.sessionId, transport);

  transport.onclose = () => {
    mcpTransports.delete(transport.sessionId);
    log.info(`MCP SSE client disconnected: ${transport.sessionId}`);
  };

  await mcpServer.connect(transport);
  log.info(`MCP SSE client connected: ${transport.sessionId}`);
});

// POST /mcp/message?sessionId=xxx — receive JSON-RPC messages
app.post('/mcp/message', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = mcpTransports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: 'Unknown session' });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// Create HTTP server and attach WebSocket
const server = createServer(app);
initWebSocket(server);

// ─── Audit → WebSocket bridge ───────────────────────────────
// Poll audit log and broadcast new entries to all connected WS clients.
// This picks up events from MCP tool calls (lending, etc.)
let lastAuditCount = 0;
setInterval(() => {
  const entries = getAuditLog();
  if (entries.length > lastAuditCount) {
    const newEntries = entries.slice(lastAuditCount);
    lastAuditCount = entries.length;
    // Broadcast to all connected WebSocket clients
    for (const entry of newEntries) {
      // Broadcast to ALL connected clients (lending events affect everyone)
      broadcastAll({ type: 'audit', data: entry });
    }
  }
}, 2000);

// SPA fallback — serve index.html for non-API routes (React Router)
if (existsSync(frontendDist)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/mcp/')) return next();
    res.sendFile(join(frontendDist, 'index.html'));
  });
}

// Initialize operator wallet + wallet-os core (for MCP tools), then start server
Promise.all([initOperator(), initWallet(undefined, 1000)]).then(([operatorAddr]) => {
  server.listen(PORT, () => {
    log.info(`Web server running on http://localhost:${PORT}`);
    log.info(`Operator wallet: ${operatorAddr}`);
    log.info(`WebSocket available at ws://localhost:${PORT}`);
    log.info('Endpoints:');
    log.info('  POST /api/agent/connect');
    log.info('  GET  /api/agent/status/:addr');
    log.info('  POST /api/agent/activate/:addr');
    log.info('  POST /api/agent/pause/:addr');
    log.info('  POST /api/agent/resume/:addr');
    log.info('  POST /api/agent/cycle/:addr');
    log.info('  GET  /api/agent/audit/:addr');
    log.info('  POST /api/chat');
  });
}).catch((err) => {
  log.error(`Failed to initialize operator wallet: ${err}`);
  process.exit(1);
});

// Graceful shutdown
function onShutdown() {
  log.info('Shutting down...');
  shutdownAgents();
  shutdownWs();
  server.close();
  process.exit(0);
}

process.on('SIGINT', onShutdown);
process.on('SIGTERM', onShutdown);
