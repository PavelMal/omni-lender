import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../wagmi';

interface Message {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  border: '1px solid #333',
  borderRadius: 8,
  background: '#0a0a0f',
  color: '#e0e0e0',
  fontSize: 14,
  outline: 'none',
};

interface Props {
  ownerAddress: string;
}

export function Chat({ ownerAddress }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAddress, message: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'agent',
        text: data.response || data.error || 'No response',
        timestamp: new Date(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: `Error: ${err}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#111118',
      border: '1px solid #222',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: 500,
    }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 && (
          <p style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>
            Ask your agent about its strategy, decisions, or what it should do next.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 12,
              textAlign: m.role === 'user' ? 'right' : 'left',
            }}
          >
            <div style={{
              display: 'inline-block',
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: 12,
              background: m.role === 'user' ? '#00d4aa22' : '#1a1a24',
              color: m.role === 'user' ? '#00d4aa' : '#e0e0e0',
              fontSize: 14,
              lineHeight: 1.5,
              textAlign: 'left',
            }}>
              {m.text}
            </div>
            <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>
              {m.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: '#555', fontSize: 13, marginLeft: 8 }}>
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 8,
        padding: 12,
        borderTop: '1px solid #222',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask your agent..."
          style={inputStyle}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: 8,
            background: input.trim() ? '#00d4aa' : '#333',
            color: input.trim() ? '#000' : '#666',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
