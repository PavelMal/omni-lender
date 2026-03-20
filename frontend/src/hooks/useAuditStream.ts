import { useState, useEffect, useRef } from 'react';
import { API_BASE, WS_BASE } from '../api';

interface AuditEntry {
  timestamp: string;
  action: string;
  module: string;
  amount?: number;
  asset?: string;
  to?: string;
  txHash?: string;
  reasoning: string;
  status: 'approved' | 'rejected' | 'executed' | 'failed' | 'info';
}

interface WsMessage {
  type: 'audit' | 'balance' | 'cycle_start' | 'cycle_end';
  data?: any;
}

export function useAuditStream(ownerAddress: string | undefined) {
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Load existing audit entries on mount
  useEffect(() => {
    if (!ownerAddress) return;

    const host = window.location.hostname;
    fetch(`${API_BASE}/api/agent/audit/${ownerAddress}?limit=50`)
      .then(r => r.ok ? r.json() : [])
      .then((entries: AuditEntry[]) => {
        if (entries.length > 0) {
          setEvents(entries);
        }
      })
      .catch(() => {});
  }, [ownerAddress]);

  // WebSocket for live updates
  useEffect(() => {
    if (!ownerAddress) return;

    const url = `${WS_BASE}?address=${ownerAddress}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === 'audit' && msg.data) {
          setEvents(prev => [...prev.slice(-99), msg.data]);
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [ownerAddress]);

  const clearEvents = () => setEvents([]);

  return { events, connected, clearEvents };
}
