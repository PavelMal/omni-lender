/**
 * WebSocket hub — broadcasts real-time events to connected clients.
 * Clients connect with ?address=0x... to subscribe to a specific agent's events.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createLogger } from '../utils/logger.js';

const log = createLogger('WebSocket');

// Map of owner address → set of connected clients
const clients = new Map<string, Set<WebSocket>>();

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const address = url.searchParams.get('address')?.toLowerCase();

    if (!address) {
      ws.close(1008, 'Missing ?address parameter');
      return;
    }

    if (!clients.has(address)) {
      clients.set(address, new Set());
    }
    clients.get(address)!.add(ws);
    log.info(`Client connected for ${address} (${clients.get(address)!.size} total)`);

    ws.on('close', () => {
      const set = clients.get(address);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(address);
      }
      log.debug(`Client disconnected for ${address}`);
    });

    ws.on('error', (err) => {
      log.error(`WS error for ${address}`, { error: String(err) });
    });
  });

  log.info('WebSocket server initialized');
}

export function broadcast(ownerAddress: string, message: object): void {
  const set = clients.get(ownerAddress.toLowerCase());
  if (!set || set.size === 0) return;

  const data = JSON.stringify(message);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/** Broadcast a message to ALL connected WebSocket clients (any address). */
export function broadcastAll(message: object): void {
  const data = JSON.stringify(message);
  for (const set of clients.values()) {
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}

export function shutdownWs(): void {
  if (wss) {
    wss.close();
    wss = null;
  }
  clients.clear();
}
