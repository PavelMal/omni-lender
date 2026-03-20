import { useState } from 'react';
import { API_BASE } from '../wagmi';

interface Creator {
  username: string;
  displayName: string;
  walletAddress: string;
  rumbleUrl: string;
  followers?: number;
  totalViews?: number;
  recentVideoCount?: number;
  engagementScore: number;
  recentVideos: { title: string; views: number }[];
}

interface SearchResult {
  query: string;
  creators: Creator[];
  analysis: string;
}

interface Props {
  ownerAddress: string;
}

export function CreatorSearch({ ownerAddress }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [tipping, setTipping] = useState<string | null>(null);
  const [tipResult, setTipResult] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setTipResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent/search-creators/${ownerAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ query, creators: [], analysis: `Error: ${err}` });
    } finally {
      setLoading(false);
    }
  };

  const handleTip = async (creator: Creator) => {
    setTipping(creator.username);
    setTipResult(null);
    try {
      const res = await fetch(`${API_BASE}/agent/tip/${ownerAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorAddress: creator.walletAddress,
          creatorName: creator.displayName,
          type: 'milestone',
        }),
      });
      const data = await res.json();
      setTipResult(data.txHash
        ? `Tipped! TX: ${data.txHash.slice(0, 14)}...`
        : data.reason || 'Tip failed');
    } catch (err) {
      setTipResult(`Error: ${err}`);
    } finally {
      setTipping(null);
    }
  };

  const formatNum = (n?: number) => {
    if (!n) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div style={{
      background: '#111118',
      border: '1px solid #222',
      borderRadius: 12,
      padding: 20,
      marginBottom: 24,
    }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>
        Rumble Creator Search
      </h3>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        Search Rumble for creators to tip. Claude will analyze metrics and recommend who deserves a tip.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="e.g. independent journalism, crypto education, comedy..."
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #333',
            borderRadius: 8,
            background: '#0a0a0f',
            color: '#e0e0e0',
            fontSize: 14,
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: 8,
            background: loading ? '#333' : '#00d4aa',
            color: loading ? '#666' : '#000',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div>
          {/* Creators list */}
          {result.creators.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
                Found {result.creators.length} creators for "{result.query}"
              </h4>
              {result.creators.map(c => (
                <div key={c.username} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid #1a1a22',
                  fontSize: 13,
                }}>
                  <div style={{
                    width: 32, height: 32,
                    borderRadius: 6,
                    background: `hsl(${c.engagementScore * 1.2}, 60%, 25%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {c.engagementScore}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#e0e0e0' }}>
                      {c.displayName}{' '}
                      <a
                        href={c.rumbleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#4488ff', fontSize: 11, textDecoration: 'none' }}
                      >
                        @{c.username}
                      </a>
                    </div>
                    <div style={{ color: '#555', fontSize: 11 }}>
                      {c.followers ? `${formatNum(c.followers)} followers` : ''}
                      {c.totalViews ? ` · ${formatNum(c.totalViews)} views` : ''}
                      {c.recentVideoCount ? ` · ${c.recentVideoCount} videos` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTip(c)}
                    disabled={tipping === c.username}
                    style={{
                      padding: '5px 12px',
                      border: '1px solid #00d4aa44',
                      borderRadius: 6,
                      background: 'transparent',
                      color: '#00d4aa',
                      cursor: tipping === c.username ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {tipping === c.username ? 'Tipping...' : 'Tip $'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tipResult && (
            <p style={{
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 6,
              background: tipResult.includes('Tipped') ? '#00d4aa18' : '#ff444418',
              color: tipResult.includes('Tipped') ? '#00d4aa' : '#ff8888',
              marginBottom: 12,
            }}>
              {tipResult}
            </p>
          )}

          {/* Claude analysis */}
          <div style={{
            background: '#0a0a12',
            border: '1px solid #1a1a22',
            borderRadius: 8,
            padding: 14,
          }}>
            <h4 style={{ fontSize: 12, color: '#00d4aa', marginBottom: 8, fontWeight: 600 }}>
              Claude Analysis
            </h4>
            <p style={{
              fontSize: 13,
              color: '#aaa',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {result.analysis}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
