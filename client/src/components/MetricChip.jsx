import { useState } from 'react';

export default function MetricChip({ value, label, tooltip, variant = 'default' }) {
  const [hovered, setHovered] = useState(false);

  const valueColor = variant === 'warning' ? 'var(--accent-amber)' : 'var(--accent-green-bright)';

  return (
    <div
      className="metric-chip"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 13,
        fontWeight: 500,
        color: valueColor,
      }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
        {label}
      </span>

      {hovered && tooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-2)',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 11,
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          zIndex: 10,
          maxWidth: 220,
          whiteSpace: 'normal',
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}
