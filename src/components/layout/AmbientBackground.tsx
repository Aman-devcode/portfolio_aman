export function AmbientBackground() {
  return <div className="ambient-background" aria-hidden="true">
    {/* Flowing energy ribbons - large clearly visible luminous streams */}
    <div className="ambient-waves">
      <svg className="ambient-wave ambient-wave-1" viewBox="0 0 1400 900" preserveAspectRatio="none">
        <path d="M-100,320 Q350,240 700,320 Q1050,400 1500,320" />
      </svg>
      <svg className="ambient-wave ambient-wave-2" viewBox="0 0 1400 900" preserveAspectRatio="none">
        <path d="M-100,480 Q350,400 700,480 Q1050,560 1500,480" />
      </svg>
      <svg className="ambient-wave ambient-wave-3" viewBox="0 0 1400 900" preserveAspectRatio="none">
        <path d="M-100,580 Q350,500 700,580 Q1050,660 1500,580" />
      </svg>
      <svg className="ambient-wave ambient-wave-4" viewBox="0 0 1400 900" preserveAspectRatio="none">
        <path d="M-100,220 Q350,150 700,220 Q1050,290 1500,220" />
      </svg>
    </div>

    {/* AI/Data network - clearly visible nodes and connections around edges */}
    <svg className="ambient-network" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="6" y1="12" x2="18" y2="24" className="network-line" />
      <line x1="18" y1="24" x2="28" y2="18" className="network-line" />
      <line x1="28" y1="18" x2="38" y2="32" className="network-line" />
      <line x1="10" y1="72" x2="22" y2="64" className="network-line" />
      <line x1="22" y1="64" x2="16" y2="84" className="network-line" />
      <line x1="74" y1="14" x2="86" y2="28" className="network-line" />
      <line x1="86" y1="28" x2="82" y2="48" className="network-line" />
      <line x1="82" y1="48" x2="90" y2="68" className="network-line" />
      <line x1="90" y1="68" x2="84" y2="86" className="network-line" />
      <circle cx="6" cy="12" r="1.5" className="network-node network-node-red" />
      <circle cx="18" cy="24" r="1.2" className="network-node" />
      <circle cx="28" cy="18" r="1.4" className="network-node network-node-green" />
      <circle cx="38" cy="32" r="1.1" className="network-node" />
      <circle cx="10" cy="72" r="1.4" className="network-node network-node-red" />
      <circle cx="22" cy="64" r="1.2" className="network-node network-node-green" />
      <circle cx="16" cy="84" r="1.3" className="network-node" />
      <circle cx="74" cy="14" r="1.4" className="network-node network-node-green" />
      <circle cx="86" cy="28" r="1.5" className="network-node network-node-red" />
      <circle cx="82" cy="48" r="1.2" className="network-node" />
      <circle cx="90" cy="68" r="1.3" className="network-node network-node-green" />
      <circle cx="84" cy="86" r="1.4" className="network-node network-node-red" />
    </svg>

    {/* Floating particles - clearly visible throughout the atmosphere */}
    <div className="ambient-stars">
      <i/><i/><i/><i/><i/><i/><i/><i/><i/><i/>
      <i/><i/><i/><i/><i/><i/><i/><i/><i/><i/>
      <i/><i/><i/><i/><i/><i/><i/><i/>
    </div>
  </div>;
}
