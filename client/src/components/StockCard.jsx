import { useState } from 'react';

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

const TYPE_CONFIG = {
  stock:    { label: 'Stock',    color: 'var(--text-secondary)', bg: 'transparent',            border: 'var(--border-2)' },
  etf:      { label: 'ETF',      color: 'var(--accent-green-bright)', bg: 'var(--accent-green-dim)', border: 'var(--accent-green)' },
  bond_etf: { label: 'Bond ETF', color: 'var(--accent-amber)',   bg: '#2a1f0a',                 border: 'var(--accent-amber)' },
  reit:     { label: 'REIT',     color: 'var(--accent-blue)',    bg: '#0d1f2d',                 border: 'var(--accent-blue)' },
};

const LEVEL_STYLE = {
  Low:    { color: 'var(--accent-green-bright)', bg: 'var(--accent-green-dim)', border: 'var(--accent-green)' },
  Medium: { color: 'var(--accent-amber)',         bg: '#2a1f0a',                 border: 'var(--accent-amber)' },
  High:   { color: 'var(--accent-red)',           bg: 'var(--accent-red-dim)',   border: 'var(--accent-red)' },
};

function LevelChip({ label, level }) {
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.Medium;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{
        fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.06em', fontFamily: "'DM Mono', monospace",
      }}>{label}</span>
      <span style={{
        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
        color: s.color, background: s.bg, border: `1px solid ${s.border}`,
        fontFamily: "'DM Mono', monospace",
      }}>{level}</span>
    </div>
  );
}

export default function StockCard({ card, equalProjection }) {
  const { ticker, name, price, fiftyTwoWeekLow, fiftyTwoWeekHigh, peRatio, marketCap, sector, reasoning, type, portfolioRole, retirementLens, watchOut, expenseRatio } = card;
  const [lensOpen, setLensOpen] = useState(false);

  const typeConf = TYPE_CONFIG[type] || TYPE_CONFIG.stock;

  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', transition: 'background 0.15s', padding: 'var(--space-4)', borderLeft: `3px solid ${typeConf.border}` }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
    >
      {/* Header */}
      <div className="stock-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 6 }}>
            <div className="ticker-badge" style={{ display: 'inline-block' }}>{ticker}</div>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
              color: typeConf.color, background: typeConf.bg, border: `1px solid ${typeConf.border}`,
              fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{typeConf.label}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: portfolioRole ? 4 : 0 }}>{name}</div>
          {portfolioRole && (
            <span style={{
              display: 'inline-block',
              fontSize: 10, padding: '2px 8px', borderRadius: 100,
              color: 'var(--text-secondary)', background: 'var(--bg-input)',
              border: '1px solid var(--border-2)',
              fontFamily: "'DM Mono', monospace",
            }}>{portfolioRole}</span>
          )}
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
        {(type === 'etf' || type === 'bond_etf') && expenseRatio != null ? (
          <>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="section-label" style={{ marginBottom: 3 }}>Exp. Ratio</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{(expenseRatio * 100).toFixed(2)}%</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="section-label" style={{ marginBottom: 3 }}>Mkt Cap</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMarketCap(marketCap)}</div>
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="section-label" style={{ marginBottom: 3 }}>P/E</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatPE(peRatio)}</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="section-label" style={{ marginBottom: 3 }}>Mkt Cap</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMarketCap(marketCap)}</div>
            </div>
          </>
        )}
      </div>

      {/* Reasoning */}
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
        {reasoning}
      </p>

      {/* Retirement lens collapsible */}
      {retirementLens && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => setLensOpen((o) => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--text-muted)', fontSize: 10,
              fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: 'pointer', background: 'none', border: 'none', padding: 0,
            }}
          >
            <span style={{
              display: 'inline-block',
              transform: lensOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              fontSize: 8,
            }}>▶</span>
            Retirement lens
          </button>
          {lensOpen && (
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <LevelChip label="Income" level={retirementLens.incomeRole} />
                <LevelChip label="Volatility" level={retirementLens.volatility} />
                <LevelChip label="Liquidity" level={retirementLens.liquidity} />
                <LevelChip label="Complexity" level={retirementLens.complexity} />
              </div>
              {retirementLens.retirementFit && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {retirementLens.retirementFit}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Watch out warning */}
      {watchOut && (
        <div style={{
          background: 'var(--accent-red-dim)',
          border: '1px solid var(--accent-red)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-2) var(--space-3)',
          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
        }}>
          <span style={{ color: 'var(--accent-red)', fontSize: 11, flexShrink: 0, marginTop: 1 }}>⚠</span>
          <span style={{ fontSize: 11, color: 'var(--accent-red)', lineHeight: 1.5 }}>{watchOut}</span>
        </div>
      )}

      {/* Equal-split projection preview */}
      {equalProjection && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)' }}>
          <div style={{
            fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.06em', fontFamily: "'DM Mono', monospace", marginBottom: 4,
          }}>Your projection</div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", margin: 0, lineHeight: 1.6 }}>
            ${equalProjection.amount.toLocaleString()} invested →{' '}
            <span style={{ color: 'var(--accent-green-bright)' }}>~${equalProjection.projected.toLocaleString()}</span>
            {' '}in {equalProjection.holdYears} yr{equalProjection.holdYears !== 1 ? 's' : ''} ·{' '}
            <span style={{ color: 'var(--accent-green-bright)' }}>~${equalProjection.income.toLocaleString()}/yr</span>
            {' '}income
          </p>
        </div>
      )}
    </div>
  );
}
