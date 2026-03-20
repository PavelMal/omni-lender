import { useState } from 'react';
import { useAgent } from '../hooks/useAgent';
import { API_BASE } from '../wagmi';

const btnStyle = (color: string): React.CSSProperties => ({
  padding: '8px 16px',
  border: `1px solid ${color}`,
  borderRadius: 8,
  background: 'transparent',
  color,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
});

interface Props {
  ownerAddress: string;
}

export function AgentControls({ ownerAddress }: Props) {
  const { status, refresh } = useAgent(ownerAddress);
  const [loading, setLoading] = useState('');

  const action = async (endpoint: string) => {
    setLoading(endpoint);
    try {
      await fetch(`${API_BASE}/agent/${endpoint}/${ownerAddress}`, { method: 'POST' });
      await refresh();
    } finally {
      setLoading('');
    }
  };

  if (!status) return null;

  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 24,
      flexWrap: 'wrap', alignItems: 'center',
    }}>
      {!status.active ? (
        <button
          onClick={() => action('activate')}
          disabled={!!loading}
          style={btnStyle('#00d4aa')}
        >
          {loading === 'activate' ? 'Activating...' : 'Activate Agent'}
        </button>
      ) : (
        <>
          <span style={{
            padding: '6px 12px',
            background: '#00d4aa22',
            color: '#00d4aa',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
          }}>
            ACTIVE
          </span>

          <button
            onClick={() => action('cycle')}
            disabled={!!loading}
            style={btnStyle('#4488ff')}
          >
            {loading === 'cycle' ? 'Running...' : 'Run Cycle'}
          </button>

          {status.autoCycle ? (
            <button
              onClick={() => action('pause')}
              disabled={!!loading}
              style={btnStyle('#ffaa00')}
            >
              Pause
            </button>
          ) : (
            <button
              onClick={() => action('resume')}
              disabled={!!loading}
              style={btnStyle('#00d4aa')}
            >
              Resume
            </button>
          )}
        </>
      )}
    </div>
  );
}
