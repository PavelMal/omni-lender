import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../wagmi';

export interface AgentStatus {
  ownerAddress: string;
  operatorAddress: string;
  active: boolean;
  autoCycle: boolean;
  balance: { usdt: number; eth: number };
  allowance: number;
  availableBudget: number;
  budgets: Record<string, { allocated: number; spent: number; remaining: number }>;
  holdings: Record<string, number>;
  positions: Array<{
    protocol: string;
    asset: string;
    deposited: number;
    currentApy: number;
    depositedAt: string;
  }>;
  loans: Array<{
    id: string;
    borrowerName: string;
    principal: number;
    totalDue: number;
    dueDate: string;
    status: string;
  }>;
  aaveBalance: number;
  auditCount: number;
}

export function useAgent(ownerAddress: string | undefined) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerAddress) return;
    setLoading(true);
    try {
      let res = await fetch(`${API_BASE}/agent/status/${ownerAddress}`);
      if (!res.ok) {
        // Agent not found — auto-connect
        await fetch(`${API_BASE}/agent/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerAddress }),
        });
        res = await fetch(`${API_BASE}/agent/status/${ownerAddress}`);
      }
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setError(null);
      } else {
        setStatus(null);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [ownerAddress]);

  // Poll every 5 seconds
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { status, loading, error, refresh };
}
