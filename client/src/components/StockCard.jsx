import { useState } from 'react';

// Fallback expense ratios in % — used only when FMP live data returns null.
// Last verified: March 2026 — update annually.
const ETF_EXPENSE_RATIOS = {
  'VTI': 0.03,  'VOO': 0.03,  'SPY': 0.0945, 'QQQ': 0.20,
  'SCHD': 0.06, 'VYM': 0.06,  'BND': 0.03,   'AGG': 0.03,
  'TLT': 0.15,  'VNQ': 0.13,  'AVUV': 0.25,  'VWO': 0.08,
  'SCHB': 0.03, 'IVV': 0.03,  'IEMG': 0.09,  'XLE': 0.09,
  'XLK': 0.09,  'XLV': 0.09,  'JEPI': 0.35,  'JEPQ': 0.35,
  'SCHY': 0.14, 'ITOT': 0.03, 'SCHX': 0.03,  'IWM': 0.19,
  'GLD': 0.40,  'IAU': 0.25,  'PDBC': 0.59,  'VCSH': 0.04,
  'VGSH': 0.04, 'HYG': 0.48,  'JNK': 0.40,   'LQD': 0.14,
  'VCIT': 0.04, 'IGSB': 0.06, 'VCLT': 0.04,
};

// Fallback dividend/distribution yields in % — used only when FMP and Finnhub both return null.
// Last verified: March 2026 — update annually.
const ETF_KNOWN_YIELDS = {
  'VTI': 1.31,  'VOO': 1.31,  'SPY': 1.27,  'QQQ': 0.58,
  'SCHD': 3.51, 'VYM': 2.82,  'BND': 4.53,  'AGG': 3.81,
  'TLT': 4.62,  'VNQ': 4.12,  'AVUV': 1.41, 'VWO': 2.94,
  'SCHB': 1.28, 'IVV': 1.31,  'IEMG': 2.31, 'XLE': 3.21,
  'XLK': 0.71,  'XLV': 1.52,  'JEPI': 7.12, 'JEPQ': 9.21,
  'SCHY': 4.21, 'IWM': 1.41,  'GLD': 0,     'HYG': 7.21,
  'JNK': 7.34,  'LQD': 5.02,  'VCSH': 4.61, 'IGSB': 4.80, 'VCLT': 5.10,
};

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

const CONSENSUS_STYLE = {
  'Strong Buy':  { color: 'var(--accent-green-bright)', bg: 'var(--accent-green-dim)', border: 'var(--accent-green)' },
  'Buy':         { color: '#6ee7b7',                    bg: 'rgba(52,211,153,0.08)',   border: 'rgba(52,211,153,0.3)' },
  'Hold':        { color: 'var(--accent-amber)',         bg: '#2a1f0a',                 border: 'var(--accent-amber)' },
  'Sell':        { color: 'var(--accent-red)',           bg: 'var(--accent-red-dim)',   border: 'var(--accent-red)' },
  'Strong Sell': { color: 'var(--accent-red)',           bg: 'var(--accent-red-dim)',   border: 'var(--accent-red)' },
};

export default function StockCard({ card, equalProjection }) {
  const { ticker, name, price, fiftyTwoWeekLow, fiftyTwoWeekHigh, peRatio, marketCap, sector, reasoning, type, portfolioRole, retirementLens, watchOut, expenseRatio,
    analystConsensus, newsSentimentScore, newsSentimentLabel, priceTargetConsensus } = card;
  const [lensOpen, setLensOpen] = useState(false);
  const [hoveredStat, setHoveredStat] = useState(null);

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
          {type === 'stock' && analystConsensus && CONSENSUS_STYLE[analystConsensus] && (() => {
            const cs = CONSENSUS_STYLE[analystConsensus];
            return (
              <span style={{
                display: 'inline-block', marginTop: portfolioRole ? 4 : 0,
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                color: cs.color, background: cs.bg, border: `1px solid ${cs.border}`,
                fontFamily: "'DM Mono', monospace",
              }}>
                Wall St. {analystConsensus}
              </span>
            );
          })()}
          {type === 'stock' && newsSentimentLabel && newsSentimentLabel !== 'Neutral' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: newsSentimentLabel === 'Bullish' || newsSentimentLabel === 'Somewhat-Bullish'
                  ? 'var(--accent-green-bright)'
                  : 'var(--accent-red)',
              }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                {newsSentimentLabel === 'Somewhat-Bullish' ? 'Bullish' : newsSentimentLabel === 'Somewhat-Bearish' ? 'Bearish' : newsSentimentLabel} news sentiment
              </span>
            </div>
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
        {(type === 'etf' || type === 'bond_etf') ? (() => {
          // Expense ratio: FMP live (decimal ×100) → hardcoded fallback (already in %) → N/A
          const displayRatio = expenseRatio != null
            ? `${(expenseRatio * 100).toFixed(2)}%`
            : ETF_EXPENSE_RATIOS[ticker] != null
              ? `${ETF_EXPENSE_RATIOS[ticker].toFixed(2)}%`
              : 'N/A';

          // Yield: FMP/Finnhub live (already in %) → hardcoded fallback (in %) → N/A
          const yieldLabel  = type === 'bond_etf' ? 'DIST. YIELD' : 'DIV. YIELD';
          const displayYield = card.dividendYield != null
            ? `${Number(card.dividendYield).toFixed(2)}%`
            : ETF_KNOWN_YIELDS[ticker] != null
              ? `${ETF_KNOWN_YIELDS[ticker].toFixed(2)}%`
              : 'N/A';

          return (
            <>
              {/* Expense ratio stat */}
              <div
                style={{ flex: 1, textAlign: 'center', position: 'relative', cursor: 'default' }}
                onMouseEnter={() => setHoveredStat('expense')}
                onMouseLeave={() => setHoveredStat(null)}
              >
                <div className="section-label" style={{ marginBottom: 3 }}>EXP. RATIO</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{displayRatio}</div>
                {hoveredStat === 'expense' && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
                    transform: 'translateX(-50%)', zIndex: 50,
                    background: 'var(--bg-card)', border: '1px solid var(--border-2)',
                    borderRadius: 'var(--radius)', padding: 'var(--space-3)',
                    width: 220, lineHeight: 1.5,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    pointerEvents: 'none', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Annual fee charged by the fund. Lower is better — this reduces your return each year.
                    </div>
                  </div>
                )}
              </div>

              <div style={{ width: 1, background: 'var(--border)' }} />

              {/* Yield stat */}
              <div
                style={{ flex: 1, textAlign: 'center', position: 'relative', cursor: 'default' }}
                onMouseEnter={() => setHoveredStat('yield')}
                onMouseLeave={() => setHoveredStat(null)}
              >
                <div className="section-label" style={{ marginBottom: 3 }}>{yieldLabel}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{displayYield}</div>
                {hoveredStat === 'yield' && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', right: 0,
                    zIndex: 50,
                    background: 'var(--bg-card)', border: '1px solid var(--border-2)',
                    borderRadius: 'var(--radius)', padding: 'var(--space-3)',
                    width: 220, lineHeight: 1.5,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    pointerEvents: 'none', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Income paid out to investors, shown as % of current price. For ETFs this includes dividends from all holdings.
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })() : (
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
          {type === 'stock' && priceTargetConsensus != null && price != null && (() => {
            const pct = ((priceTargetConsensus - price) / price * 100);
            const isUp = pct >= 0;
            return (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", margin: '4px 0 0', lineHeight: 1.5 }}>
                Wall St. consensus target:{' '}
                <span style={{ color: 'var(--text-secondary)' }}>${priceTargetConsensus.toFixed(2)}</span>
                {' '}
                <span style={{ color: isUp ? 'var(--accent-green-bright)' : 'var(--accent-red)' }}>
                  ({isUp ? '+' : ''}{pct.toFixed(1)}% from current price)
                </span>
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
