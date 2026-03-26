import { useState } from 'react';

const GROWTH_RATES_STANDARD     = { stock: 0.07,  etf: 0.065, bond_etf: 0.035, reit: 0.055 };
const GROWTH_RATES_CONSERVATIVE = { stock: 0.05,  etf: 0.05,  bond_etf: 0.03,  reit: 0.045 };
const INCOME_YIELDS             = { stock: 0.018, etf: 0.025, bond_etf: 0.042, reit: 0.048 };
const HOLD_YEARS                = { short: 2, medium: 5, long: 10 };

const TYPE_LABELS = { stock: 'Stock', etf: 'ETF', bond_etf: 'Bond ETF', reit: 'REIT' };
const TYPE_COLORS = {
  stock:    'var(--text-secondary)',
  etf:      'var(--accent-green-bright)',
  bond_etf: 'var(--accent-amber)',
  reit:     'var(--accent-blue)',
};

function getRate(type, goalMode) {
  const conservative = goalMode === 'approaching-retirement' || goalMode === 'already-retired';
  const rates = conservative ? GROWTH_RATES_CONSERVATIVE : GROWTH_RATES_STANDARD;
  return rates[type] ?? rates.stock;
}

function calcProjection(amount, type, holdPeriod, goalMode) {
  const years = HOLD_YEARS[holdPeriod] ?? 10;
  return Math.round(amount * Math.pow(1 + getRate(type, goalMode), years));
}

function calcIncome(amount, type) {
  return Math.round(amount * (INCOME_YIELDS[type] ?? INCOME_YIELDS.stock));
}

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

export default function AllocationBuilder({ cards, inputs }) {
  const total      = inputs?.amount     || 0;
  const holdPeriod = inputs?.holdPeriod || 'long';
  const goalMode   = inputs?.goalMode   || 'growing-wealth';
  const holdYears  = HOLD_YEARS[holdPeriod] ?? 10;

  const [allocs, setAllocs] = useState(() => initAllocations(cards, total));

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

  const rows = cards.map((c) => {
    const amt  = allocs[c.ticker] ?? 0;
    const proj = calcProjection(amt, c.type, holdPeriod, goalMode);
    const inc  = calcIncome(amt, c.type);
    return { ...c, amt, proj, inc };
  });

  const totalProjected = rows.reduce((s, r) => s + r.proj, 0);
  const totalIncome    = rows.reduce((s, r) => s + r.inc, 0);
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
          const pct = total > 0 ? ((row.amt / total) * 100).toFixed(0) : 0;
          const typeColor = TYPE_COLORS[row.type] || TYPE_COLORS.stock;
          const typeLabel = TYPE_LABELS[row.type] || 'Stock';

          return (
            <div
              key={row.ticker}
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
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
                  <span style={{ color: 'var(--accent-green-bright)' }}>~{fmt(row.proj)}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                  <span style={{ color: 'var(--accent-green-bright)' }}>~{fmt(row.inc)}</span>/yr income
                </span>
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
          Based on your allocation, your {fmt(total)} could grow to ~{fmt(totalProjected)} over {holdYears} year{holdYears !== 1 ? 's' : ''} and generate roughly {fmt(totalIncome)}/year in income.
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
          Projections are illustrative only and assume constant growth rates. Actual returns will vary. Not financial advice.
        </p>
      </div>
    </div>
  );
}
