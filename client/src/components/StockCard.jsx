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
    <div style={{ marginTop: 4 }}>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'visible' }}>
        <div style={{
          position: 'absolute',
          left: `${pct}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'var(--accent-green-bright)',
          border: '2px solid var(--bg-card)',
          zIndex: 1,
        }} />
        <div style={{
          position: 'absolute',
          left: 0, right: 0, top: 0, bottom: 0,
          background: `linear-gradient(to right, var(--accent-green) ${pct}%, var(--border) ${pct}%)`,
          borderRadius: 3,
          opacity: 0.3,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
        <span>{formatPrice(low)}</span>
        <span>52-week range</span>
        <span>{formatPrice(high)}</span>
      </div>
    </div>
  );
}

export default function StockCard({ card }) {
  const { ticker, name, price, fiftyTwoWeekLow, fiftyTwoWeekHigh, peRatio, marketCap, sector, reasoning } = card;

  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', transition: 'background 0.15s', padding: 'var(--space-4)' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
    >
      {/* Header */}
      <div className="stock-header">
        <div>
          <div className="ticker-badge" style={{ display: 'inline-block', marginBottom: 6 }}>{ticker}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
        </div>
        {sector && (
          <span style={{
            flexShrink: 0,
            background: 'var(--accent-green-dim)',
            color: 'var(--accent-green-bright)',
            border: '1px solid var(--accent-green)',
            borderRadius: 100,
            padding: '3px 10px',
            fontSize: 10,
          }}>{sector}</span>
        )}
      </div>

      {/* Price */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="price-large">{formatPrice(price)}</div>
        <RangeBar low={fiftyTwoWeekLow} high={fiftyTwoWeekHigh} price={price} />
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: 'var(--space-3) 0',
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="section-label" style={{ marginBottom: 3 }}>P/E</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{formatPE(peRatio)}</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="section-label" style={{ marginBottom: 3 }}>Mkt Cap</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMarketCap(marketCap)}</div>
        </div>
      </div>

      {/* Reasoning */}
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
        {reasoning}
      </p>
    </div>
  );
}
