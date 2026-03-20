export function ArchDiagram() {
  // Simple 3-row top-to-bottom flow: You → Agent Core → 4 Modules
  return (
    <svg viewBox="0 0 760 420" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <filter id="sh">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>

      <rect width="760" height="420" rx="16" fill="#0a0a12" />

      {/* ═══ ROW 1: WALLET ═══ */}
      <rect x="260" y="20" width="240" height="70" rx="12" fill="#111118" stroke="#00d4aa" strokeWidth="1.5" strokeOpacity="0.5" filter="url(#sh)" />
      <text x="380" y="50" textAnchor="middle" fill="#00d4aa" fontSize="15" fontWeight="700" fontFamily="system-ui">Your Wallet</text>
      <text x="380" y="72" textAnchor="middle" fill="#666" fontSize="10" fontFamily="system-ui">Connect · Approve USDT · Monitor</text>

      {/* Arrow down: Wallet → Agent */}
      <line x1="400" y1="92" x2="400" y2="118" stroke="#00d4aa" strokeWidth="2" strokeOpacity="0.5" />
      <polygon points="395,116 400,124 405,116" fill="#00d4aa" fillOpacity="0.6" />
      <text x="420" y="112" fill="#00d4aa" fontSize="9" fontFamily="system-ui" fillOpacity="0.7">approve + fund</text>

      {/* Dashed arrow up: events back */}
      <line x1="340" y1="124" x2="340" y2="96" stroke="#00d4aa" strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="4 3" />
      <polygon points="336,98 340,90 344,98" fill="#00d4aa" fillOpacity="0.3" />
      <text x="320" y="112" textAnchor="end" fill="#00d4aa" fontSize="9" fontFamily="system-ui" fillOpacity="0.5">events</text>

      {/* ═══ ROW 2: AGENT CORE (grouped box) ═══ */}
      <rect x="40" y="128" width="680" height="130" rx="14" fill="#0e0e16" stroke="#333" strokeWidth="1" strokeDasharray="4 2" />
      <text x="380" y="148" textAnchor="middle" fill="#444" fontSize="10" fontWeight="600" fontFamily="system-ui" letterSpacing="1.5">AGENT SYSTEM</text>

      {/* Box 1: Agent Wallet (WDK) */}
      <rect x="60" y="158" width="200" height="82" rx="10" fill="#111118" stroke="#aa44ff" strokeWidth="1" strokeOpacity="0.4" filter="url(#sh)" />
      <rect x="61" y="159" width="198" height="24" rx="9" fill="#aa44ff" fillOpacity="0.1" />
      <text x="160" y="176" textAnchor="middle" fill="#aa44ff" fontSize="12" fontWeight="700" fontFamily="system-ui">Agent Wallet (WDK)</text>
      <text x="160" y="200" textAnchor="middle" fill="#888" fontSize="10" fontFamily="system-ui">Self-custodial BIP-39</text>
      <text x="160" y="216" textAnchor="middle" fill="#666" fontSize="10" fontFamily="system-ui">transferFrom · sign TXs</text>

      {/* Box 2: OpenClaw + AI Brain */}
      <rect x="280" y="158" width="200" height="82" rx="10" fill="#111118" stroke="#22cccc" strokeWidth="1" strokeOpacity="0.4" filter="url(#sh)" />
      <rect x="281" y="159" width="198" height="24" rx="9" fill="#22cccc" fillOpacity="0.08" />
      <text x="380" y="176" textAnchor="middle" fill="#22cccc" fontSize="12" fontWeight="700" fontFamily="system-ui">OpenClaw + MCP</text>
      <text x="380" y="200" textAnchor="middle" fill="#888" fontSize="10" fontFamily="system-ui">Agent gateway · WDK tools</text>
      <text x="380" y="216" textAnchor="middle" fill="#666" fontSize="10" fontFamily="system-ui">AI reasoning (Claude)</text>

      {/* Box 3: Backend + Blockchain */}
      <rect x="500" y="158" width="200" height="82" rx="10" fill="#111118" stroke="#4488ff" strokeWidth="1" strokeOpacity="0.4" filter="url(#sh)" />
      <rect x="501" y="159" width="198" height="24" rx="9" fill="#4488ff" fillOpacity="0.1" />
      <text x="600" y="176" textAnchor="middle" fill="#4488ff" fontSize="12" fontWeight="700" fontFamily="system-ui">Backend API</text>
      <text x="600" y="200" textAnchor="middle" fill="#888" fontSize="10" fontFamily="system-ui">Policy engine · audit log</text>
      <text x="600" y="216" textAnchor="middle" fill="#666" fontSize="10" fontFamily="system-ui">Ethereum Sepolia (on-chain)</text>

      {/* Small horizontal connectors between the 3 boxes */}
      <line x1="262" y1="199" x2="278" y2="199" stroke="#555" strokeWidth="1.5" strokeOpacity="0.4" />
      <line x1="482" y1="199" x2="498" y2="199" stroke="#555" strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Arrow down: Agent System → Modules */}
      <line x1="380" y1="260" x2="380" y2="286" stroke="#aa44ff" strokeWidth="2" strokeOpacity="0.3" />
      <polygon points="376,284 380,292 384,284" fill="#aa44ff" fillOpacity="0.4" />

      {/* ═══ ROW 3: AUTONOMOUS MODULES ═══ */}
      <text x="380" y="308" textAnchor="middle" fill="#444" fontSize="10" fontWeight="600" fontFamily="system-ui" letterSpacing="1.5">AUTONOMOUS MODULES</text>

      {/* Module 1: Portfolio */}
      <rect x="20" y="318" width="170" height="86" rx="10" fill="#111118" stroke="#00d4aa" strokeWidth="1" strokeOpacity="0.25" filter="url(#sh)" />
      <circle cx="46" cy="340" r="10" fill="#00d4aa" fillOpacity="0.15" />
      <text x="46" y="344" textAnchor="middle" fill="#00d4aa" fontSize="10" fontWeight="800" fontFamily="system-ui">P</text>
      <text x="112" y="344" textAnchor="middle" fill="#e0e0e0" fontSize="12" fontWeight="700" fontFamily="system-ui">Portfolio</text>
      <text x="105" y="364" textAnchor="middle" fill="#888" fontSize="9" fontFamily="system-ui">USDT · XAU₮ · BTC</text>
      <text x="105" y="380" textAnchor="middle" fill="#888" fontSize="9" fontFamily="system-ui">Auto-rebalance</text>
      <text x="105" y="396" textAnchor="middle" fill="#555" fontSize="8" fontFamily="system-ui" fontStyle="italic">Treasury management</text>

      {/* Module 2: Yield */}
      <rect x="205" y="318" width="170" height="86" rx="10" fill="#111118" stroke="#aa44ff" strokeWidth="1" strokeOpacity="0.25" filter="url(#sh)" />
      <circle cx="231" cy="340" r="10" fill="#aa44ff" fillOpacity="0.15" />
      <text x="231" y="344" textAnchor="middle" fill="#aa44ff" fontSize="10" fontWeight="800" fontFamily="system-ui">Y</text>
      <text x="297" y="344" textAnchor="middle" fill="#e0e0e0" fontSize="12" fontWeight="700" fontFamily="system-ui">Yield</text>
      <text x="290" y="364" textAnchor="middle" fill="#888" fontSize="9" fontFamily="system-ui">Aave · Compound · Velora</text>
      <text x="290" y="380" textAnchor="middle" fill="#888" fontSize="9" fontFamily="system-ui">Risk-adjusted APY</text>
      <text x="290" y="396" textAnchor="middle" fill="#555" fontSize="8" fontFamily="system-ui" fontStyle="italic">DeFi optimization</text>

      {/* Module 3: Credit */}
      <rect x="390" y="318" width="170" height="86" rx="10" fill="#111118" stroke="#4488ff" strokeWidth="1" strokeOpacity="0.25" filter="url(#sh)" />
      <circle cx="416" cy="340" r="10" fill="#4488ff" fillOpacity="0.15" />
      <text x="416" y="344" textAnchor="middle" fill="#4488ff" fontSize="10" fontWeight="800" fontFamily="system-ui">C</text>
      <text x="482" y="344" textAnchor="middle" fill="#e0e0e0" fontSize="12" fontWeight="700" fontFamily="system-ui">Credit</text>
      <text x="475" y="364" textAnchor="middle" fill="#888" fontSize="9" fontFamily="system-ui">Credit scoring · loans</text>
      <text x="475" y="380" textAnchor="middle" fill="#888" fontSize="9" fontFamily="system-ui">Auto interest collection</text>
      <text x="475" y="396" textAnchor="middle" fill="#555" fontSize="8" fontFamily="system-ui" fontStyle="italic">Peer-to-peer lending</text>

      {/* Module 4: Rewards */}
      <rect x="575" y="318" width="170" height="86" rx="10" fill="#111118" stroke="#ffaa00" strokeWidth="1" strokeOpacity="0.25" filter="url(#sh)" />
      <circle cx="601" cy="340" r="10" fill="#ffaa00" fillOpacity="0.15" />
      <text x="601" y="344" textAnchor="middle" fill="#ffaa00" fontSize="10" fontWeight="800" fontFamily="system-ui">R</text>
      <text x="667" y="344" textAnchor="middle" fill="#e0e0e0" fontSize="12" fontWeight="700" fontFamily="system-ui">Rewards</text>
      <text x="660" y="364" textAnchor="middle" fill="#888" fontSize="9" fontFamily="system-ui">Creator tipping</text>
      <text x="660" y="380" textAnchor="middle" fill="#888" fontSize="9" fontFamily="system-ui">Smart revenue splits</text>
      <text x="660" y="396" textAnchor="middle" fill="#555" fontSize="8" fontFamily="system-ui" fontStyle="italic">Engagement rewards</text>
    </svg>
  );
}
