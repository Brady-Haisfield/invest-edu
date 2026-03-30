import { useState } from 'react';
import { calcProjection } from '../utils/projections.js';

const HOLD_YEARS = { short: 2, medium: 5, long: 10 };

const TYPE_LABELS = { stock: 'Stock', etf: 'ETF', bond_etf: 'Bond ETF', reit: 'REIT' };
const TYPE_COLORS = {
  stock:    'var(--text-secondary)',
  etf:      'var(--accent-green-bright)',
  bond_etf: 'var(--accent-amber)',
  reit:     'var(--accent-blue)',
};

function fmt(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

function initAllocations(cards, total) {
  const n = cards.length;
  if (n === 0) return {};
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Object.fromEntries(cards.map((c, i) => [c.ticker, base + (i === n - 1 ? remainder : 0)]));
}

export default function AllocationBuilder({ cards, inputs, treasuryRates }) {
  const total      = inputs?.amount     || 0;
  const holdPeriod = inputs?.holdPeriod || 'long';
  const goalMode   = inputs?.goalMode   || 'growing-wealth';
  const holdYears  = HOLD_YEARS[holdPeriod] ?? 10;

  const [allocs, setAllocs]           = useState(() => initAllocations(cards, total));
  const [openTooltip, setOpenTooltip] = useState(null);

  function handleSlider(ticker, newVal) {
    const clamped = Math.min(total, Math.max(0, newVal));
    setAllocs((prev) => {
      const others = cards.filter((c) => c.ticker !== ticker);
      const remaining = total - clamped;
      const otherTotal = others.reduce((s, c) => s + (prev[c.ticker] ?? 0), 0);
      const updated = { ...prev, [ticker]: clamped };

      if (others.length === 0) return updated;

      if (otherTotal === 0) {
        const each = Math.floor(remaining / others.length);
        const lastRem = remaining - each * (others.length - 1);
        others.forEach((c, i) => { updated[c.ticker] = i === others.length - 1 ? lastRem : each; });
      } else {
        let distributed = 0;
        others.forEach((c, i) => {
          if (i < others.length - 1) {
            const share = Math.round((prev[c.ticker] / otherTotal) * remaining);
            updated[c.ticker] = Math.max(0, share);
            distributed += updated[c.ticker];
          } else {
            updated[c.ticker] = Math.max(0, remaining - distributed);
          }
        });
      }
      return updated;
    });
  }

  function handleDollarInput(ticker, raw) {
    const digits = raw.replace(/\D/g, '');
    const val = Math.min(total, Math.max(0, Number(digits) || 0));
    handleSlider(ticker, val);
  }

  function splitEvenly() {
    setAllocs(initAllocations(cards, total));
  }

  const conservative = goalMode === 'approaching-retirement' || goalMode === 'already-retired';
  const rows = cards.map((c) => {
    const amt    = allocs[c.ticker] ?? 0;
    const result = calcProjection({ ...c, _allocatedAmount: amt }, holdYears, conservative, treasuryRates);
    return { ...c, amt, result };
  });

  const totalProjected = rows.reduce((s, r) => s + r.result.baseValue, 0);
  const totalIncome    = rows.reduce((s, r) => s + r.result.annualIncome, 0);
  const allocated      = rows.reduce((s, r) => s + r.amt, 0);
  const unallocated    = total - allocated;

  return (
    <div style={{
      padding: 'var(--space-5)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginTop: 'var(--space-5)',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <span className="section-label">Build Your Allocation</span>
          <p style={{ fontSize: 12, color: unallocated === 0 ? 'var(--accent-green-bright)' : 'var(--text-muted)', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
            {unallocated === 0
              ? `${fmt(total)} fully allocated`
              : `Unallocated: ${fmt(Math.abs(unallocated))} of ${fmt(total)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={splitEvenly}
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border-2)', background: 'var(--bg-input)',
            color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
            fontFamily: "'DM Mono', monospace", flexShrink: 0,
          }}
        >
          Split Evenly
        </button>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {rows.map((row) => {
          const pct       = total > 0 ? ((row.amt / total) * 100).toFixed(0) : 0;
          const typeColor = TYPE_COLORS[row.type] || TYPE_COLORS.stock;
          const typeLabel = TYPE_LABELS[row.type] || 'Stock';

          return (
            <div
              key={row.ticker}
              style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius)', background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              {/* Row header: ticker + name + dollar input */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{row.ticker}</span>
                  <span style={{ fontSize: 10, color: typeColor, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{typeLabel}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>{pct}%</span>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", pointerEvents: 'none',
                    }}>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(row.amt)}
                      onChange={(e) => handleDollarInput(row.ticker, e.target.value)}
                      style={{
                        width: 88, paddingLeft: 18, paddingRight: 6, paddingTop: 4, paddingBottom: 4,
                        background: 'var(--bg-input)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                        fontSize: 11, fontFamily: "'DM Mono', monospace",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={0}
                max={total}
                step={Math.max(1, Math.floor(total / 200))}
                value={row.amt}
                onChange={(e) => handleSlider(row.ticker, Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-green)', marginBottom: 'var(--space-2)', display: 'block' }}
              />

              {/* Projection outputs */}
              <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                  In {holdYears} yrs →{' '}
                  <span style={{ color: 'var(--accent-green-bright)' }}>~{fmt(row.result.baseValue)}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                  <span style={{ color: 'var(--accent-green-bright)' }}>~{fmt(row.result.annualIncome)}</span>/yr income
                </span>
              </div>

              {/* Methodology line + tooltip */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                  {row.result.dataSource} · {(row.result.baseRate * 100).toFixed(1)}%/yr
                </span>
                <button
                  type="button"
                  onMouseEnter={() => setOpenTooltip(row.ticker)}
                  onMouseLeave={() => setOpenTooltip(null)}
                  style={{ background: 'none', border: 'none', cursor: 'default', color: 'var(--text-muted)', fontSize: 10, padding: '0 2px', fontFamily: "'DM Mono', monospace", lineHeight: 1 }}
                >
                  ℹ
                </button>
                {openTooltip === row.ticker && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 50,
                    background: 'var(--bg-card)', border: '1px solid var(--border-2)',
                    borderRadius: 'var(--radius)', padding: 'var(--space-3)',
                    minWidth: 240, maxWidth: 300, lineHeight: 1.5,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    pointerEvents: 'none',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                      {row.result.methodology}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Data:{' '}
                      <span style={{ color: row.result.dataSource === 'industry average' ? 'var(--accent-amber)' : 'var(--accent-green-bright)' }}>
                        {row.result.dataSource}
                      </span>
                      {' · '}Range: ~{fmt(row.result.pessimisticValue)} — ~{fmt(row.result.optimisticValue)}
                    </div>
                    {row.result.assetNote && (
                      <div style={{ fontSize: 10, color: 'var(--accent-amber)', marginTop: 4 }}>
                        ⚠ {row.result.assetNote}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary box */}
      <div style={{
        marginTop: 'var(--space-4)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius)',
        background: 'rgba(52, 211, 153, 0.05)',
        border: '1px solid var(--accent-green)',
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Total projected value</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--accent-green-bright)' }}>
              ~{fmt(totalProjected)}
            </div>
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>Est. annual income</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--accent-green-bright)' }}>
              ~{fmt(totalIncome)}/yr
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 var(--space-3)' }}>
          Based on each security's historical growth data, your {fmt(total)} could grow to ~{fmt(totalProjected)} over {holdYears} year{holdYears !== 1 ? 's' : ''} and generate roughly {fmt(totalIncome)}/year in income.
        </p>

        {/* SPY comparison */}
        {total > 0 && (() => {
          const spyRate      = treasuryRates?.spyForwardReturn ?? 0.10;
          const spyYield     = treasuryRates?.sp500DivYield    ?? 0.013;
          const spyPct       = (spyRate * 100).toFixed(1);
          const spyYieldPct  = (spyYield * 100).toFixed(1);
          const spyProjected = Math.round(total * Math.pow(1 + spyRate, holdYears));
          const spyIncome    = Math.round(total * spyYield);

          // Weighted average return and yield across all allocated cards
          const validRows     = rows.filter(r => r.amt > 0 && r.result?.baseRate != null);
          const allocTotal    = validRows.reduce((s, r) => s + r.amt, 0);
          const avgReturnPct  = allocTotal > 0
            ? (validRows.reduce((s, r) => s + r.result.baseRate * r.amt, 0) / allocTotal * 100).toFixed(1)
            : null;
          const yieldRows     = validRows.filter(r => r.dividendYield != null);
          const avgYieldPct   = allocTotal > 0 && yieldRows.length > 0
            ? (yieldRows.reduce((s, r) => s + (r.dividendYield / 100) * r.amt, 0) / allocTotal * 100).toFixed(1)
            : '0.0';
          const diff         = totalProjected - spyProjected;
          const diffPct      = Math.abs(diff / spyProjected) * 100;
          let insight;
          if (diffPct < 15) {
            insight = 'Your allocation performs similarly to a simple S&P 500 index fund — the main difference is in income generation and sector exposure.';
          } else if (diff > 0) {
            insight = `Your allocation projects ${diffPct.toFixed(0)}% higher than SPY — typically from higher-risk assets. More potential upside usually means more volatility along the way.`;
          } else {
            insight = `Your allocation projects ${diffPct.toFixed(0)}% lower than SPY — often a sign of a more conservative, income-focused mix. Less growth, but potentially smoother ride.`;
          }
          return (
            <>
              <div style={{ borderTop: '1px solid rgba(52,211,153,0.15)', margin: 'var(--space-3) 0' }} />
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                  Vs. S&P 500 index fund (SPY)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>
                    Your allocation{avgReturnPct ? ` (~${avgReturnPct}%/yr · ~${avgYieldPct}% yield)` : ''}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--accent-green-bright)' }}>~{fmt(totalProjected)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>~{fmt(totalIncome)}/yr income</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>SPY ({spyPct}%/yr, {spyYieldPct}% yield)</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)' }}>~{fmt(spyProjected)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>~{fmt(spyIncome)}/yr income</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 var(--space-3)' }}>{insight}</p>
            </>
          );
        })()}

        <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          Return methodology: Individual stocks use a weighted blend of Wall Street analyst consensus price targets (40%), Bogle fundamental model using forward EPS estimates (35%), and CAPM risk-adjusted market return (25%), adjusted for recent news sentiment. Pessimistic/optimistic scenarios use the actual analyst high/low price target range when available. ETFs use CAPM with actual beta and live Vanguard VCMM-calibrated sector rates. Bond ETFs use live Federal Reserve Treasury yields. REITs use dividend yield weighted with revenue growth. S&P 500 comparison uses live Shiller CAPE ratio from the Federal Reserve (updated daily). All data updated on every search. Not a guarantee of future returns.
        </p>
      </div>
    </div>
  );
}
