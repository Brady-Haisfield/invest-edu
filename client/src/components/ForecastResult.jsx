import { useState } from 'react';

const LEAN_COLORS = {
  bullish:  { bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)', color: 'var(--accent-green)' },
  neutral:  { bg: 'rgba(79,142,247,0.15)', border: 'rgba(79,142,247,0.3)', color: 'var(--accent-blue)'  },
  bearish:  { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)', color: 'var(--accent-red)'  },
};

const col = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '16px 18px',
  flex: '1 1 0',
  minWidth: 0,
};

const sectionLabel = {
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '8px',
};

const muted = { color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.55 };

export default function ForecastResult({ forecast, ticker, companyName, quote }) {
  const { keyMetrics, verdict, bull, bear, educationalNote } = forecast;
  const [noteOpen, setNoteOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const lean = verdict?.lean?.toLowerCase() ?? 'neutral';
  const leanStyle = LEAN_COLORS[lean] ?? LEAN_COLORS.neutral;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* ── Header row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 18px',
      }}>
        <span style={{
          background: 'rgba(79,142,247,0.15)',
          color: 'var(--accent-blue)',
          border: '1px solid rgba(79,142,247,0.3)',
          borderRadius: '6px',
          padding: '2px 10px',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}>{ticker}</span>

        <span style={{ fontWeight: 700, fontSize: '1rem', marginRight: 'auto' }}>{companyName}</span>

        {quote?.price != null && (
          <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
            ${quote.price.toFixed(2)}
          </span>
        )}

        {quote?.low52 != null && quote?.high52 != null && (
          <span style={{ ...muted, flexShrink: 0, fontSize: '0.78rem' }}>
            52w&nbsp;${quote.low52.toFixed(2)}–${quote.high52.toFixed(2)}
          </span>
        )}

        {quote?.changePercent != null && (
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: Number(quote.changePercent) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            flexShrink: 0,
          }}>
            {Number(quote.changePercent) >= 0 ? '+' : ''}{quote.changePercent}% today
          </span>
        )}
      </div>

      {/* ── Time horizon label ── */}
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        This forecast looks 6–12 months ahead. It is educational, not a guarantee.
      </p>

      {/* ── Metrics strip ── */}
      {keyMetrics?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {keyMetrics.map((m, i) => (
            <span key={i} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '4px 13px',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{m.value}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '5px' }}>{m.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Three columns ── */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>

        {/* Bull */}
        <div style={{ ...col, borderTop: '3px solid var(--accent-green)' }}>
          <p style={{ ...sectionLabel, color: 'var(--accent-green)' }}>Bull Case</p>
          <p style={{ fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '10px' }}>
            {bull.headline}
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {(bull.drivers ?? []).slice(0, 3).map((d, i) => (
              <li key={i} style={muted}>{d.explanation}</li>
            ))}
          </ul>
          {bull.priceTargetRange && (
            <p style={{ fontSize: '0.8rem', margin: 0 }}>
              <span style={muted}>Target </span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                ${bull.priceTargetRange.low}–${bull.priceTargetRange.high}
              </span>
            </p>
          )}
        </div>

        {/* Verdict */}
        <div style={{ ...col, borderTop: `3px solid ${leanStyle.color}` }}>
          <p style={{ ...sectionLabel, color: leanStyle.color }}>Forecast</p>
          <p style={{ ...muted, marginBottom: '12px' }}>{verdict?.summary}</p>
          <span style={{
            display: 'inline-block',
            background: leanStyle.bg,
            border: `1px solid ${leanStyle.border}`,
            color: leanStyle.color,
            borderRadius: '20px',
            padding: '3px 14px',
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'capitalize',
          }}>
            {lean}
          </span>
        </div>

        {/* Bear */}
        <div style={{ ...col, borderTop: '3px solid var(--accent-red)' }}>
          <p style={{ ...sectionLabel, color: 'var(--accent-red)' }}>Bear Case</p>
          <p style={{ fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '10px' }}>
            {bear.headline}
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {(bear.risks ?? []).slice(0, 3).map((r, i) => (
              <li key={i} style={muted}>{r.explanation}</li>
            ))}
          </ul>
          {bear.downsideScenario && (
            <p style={{ fontSize: '0.8rem', margin: 0 }}>
              <span style={muted}>Downside </span>
              <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>
                ${bear.downsideScenario.low}–${bear.downsideScenario.high}
              </span>
            </p>
          )}
        </div>

      </div>

      {/* ── Educational note toggle ── */}
      {educationalNote && (
        <div>
          <button
            onClick={() => setNoteOpen((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--accent-amber)',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            {noteOpen ? '▲' : '▼'} What this analysis teaches
          </button>
          {noteOpen && (
            <p style={{ ...muted, marginTop: '6px', paddingLeft: '14px', borderLeft: '2px solid rgba(251,191,36,0.3)' }}>
              {educationalNote}
            </p>
          )}
        </div>
      )}

      {/* ── How this forecast is made ── */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setHowOpen((v) => !v)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            padding: '8px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          <span>How this forecast is made</span>
          <span style={{ fontSize: '0.65rem' }}>{howOpen ? '▲' : '▼'}</span>
        </button>
        {howOpen && (
          <ul style={{
            margin: 0,
            padding: '4px 14px 12px',
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
            borderTop: '1px solid var(--border)',
          }}>
            {[
              { icon: '📊', text: 'Real market data — current price, 52-week range, and key ratios pulled live from Finnhub' },
              { icon: '📰', text: 'Recent news — last 5 company headlines from the past 14 days' },
              { icon: '🧮', text: 'Financial history — last 3 years of revenue, earnings, and cash flow reported by the company' },
              { icon: '🤖', text: 'Claude AI — reads all of the above and writes the bull case, bear case, and verdict in plain English' },
            ].map(({ icon, text }) => (
              <li key={icon} style={{ ...muted, fontSize: '0.76rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
