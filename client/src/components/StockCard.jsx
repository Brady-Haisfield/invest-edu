function formatMarketCap(n) {
  if (n == null) return 'N/A';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function formatPrice(n) {
  if (n == null) return 'N/A';
  return `$${n.toFixed(2)}`;
}

function formatPE(n) {
  if (n == null) return 'N/A';
  return n.toFixed(1) + 'x';
}

function RangeBar({ low, high, price }) {
  if (low == null || high == null || price == null || high === low) return null;
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));

  return (
    <div style={{ marginTop: '4px' }}>
      <div style={{
        position: 'relative',
        height: 6,
        borderRadius: 3,
        background: 'var(--border)',
        overflow: 'visible',
      }}>
        <div style={{
          position: 'absolute',
          left: `${pct}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'var(--accent-blue)',
          border: '2px solid var(--bg-card)',
          zIndex: 1,
        }} />
        <div style={{
          position: 'absolute',
          left: 0, right: 0, top: 0, bottom: 0,
          background: `linear-gradient(to right, var(--accent-green) ${pct}%, var(--border) ${pct}%)`,
          borderRadius: 3,
          opacity: 0.4,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>{formatPrice(low)}</span>
        <span style={{ fontSize: '0.7rem' }}>52-week range</span>
        <span>{formatPrice(high)}</span>
      </div>
    </div>
  );
}

export default function StockCard({ card }) {
  const { ticker, name, price, fiftyTwoWeekLow, fiftyTwoWeekHigh, peRatio, marketCap, sector, reasoning } = card;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      transition: 'background 0.15s, box-shadow 0.15s',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)'; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <span style={{
            display: 'inline-block',
            background: 'rgba(79,142,247,0.15)',
            color: 'var(--accent-blue)',
            border: '1px solid rgba(79,142,247,0.3)',
            borderRadius: '6px',
            padding: '2px 10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            marginBottom: '6px',
          }}>{ticker}</span>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
        </div>
        {sector && (
          <span style={{
            flexShrink: 0,
            background: 'rgba(52,211,153,0.1)',
            color: 'var(--accent-green)',
            border: '1px solid rgba(52,211,153,0.25)',
            borderRadius: '12px',
            padding: '3px 10px',
            fontSize: '0.72rem',
            fontWeight: 500,
          }}>{sector}</span>
        )}
      </div>

      {/* Price */}
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatPrice(price)}</div>
        <RangeBar low={fiftyTwoWeekLow} high={fiftyTwoWeekHigh} price={price} />
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 0',
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>P/E Ratio</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{formatPE(peRatio)}</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Market Cap</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{formatMarketCap(marketCap)}</div>
        </div>
      </div>

      {/* Reasoning */}
      <p style={{
        fontSize: '0.85rem',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        lineHeight: 1.6,
        margin: 0,
      }}>
        {reasoning}
      </p>
    </div>
  );
}
