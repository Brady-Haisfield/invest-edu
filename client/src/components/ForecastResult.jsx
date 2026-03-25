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

export default function ForecastResult({ forecast, ticker, companyName, quote, stockPE, sectorAvgPE }) {
  const { keyMetrics, verdict, bull, bear, educationalNote, historicalScenarios } = forecast;
  const [noteOpen, setNoteOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

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
      {(keyMetrics?.length > 0 || (stockPE != null && sectorAvgPE != null)) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {keyMetrics?.map((m, i) => {
            const parenIdx = m.label.indexOf('(');
            const shortLabel = parenIdx > -1 ? m.label.slice(0, parenIdx).trim() : m.label;
            const definition = parenIdx > -1 ? m.label.slice(parenIdx + 1).replace(/\)$/, '').trim() : null;
            return (
              <span
                key={i}
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {hoveredIdx === i && definition && (
                  <span style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(18,20,28,0.97)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'normal',
                    maxWidth: '220px',
                    width: 'max-content',
                    lineHeight: 1.45,
                    zIndex: 10,
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}>
                    {definition}
                  </span>
                )}
                <span style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '20px',
                  padding: '4px 13px',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  cursor: definition ? 'default' : undefined,
                }}>
                  <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{m.value}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '5px' }}>{shortLabel}</span>
                </span>
              </span>
            );
          })}
          {stockPE != null && sectorAvgPE != null && (() => {
            const diff = (stockPE - sectorAvgPE) / sectorAvgPE;
            const isAbove = diff > 0.15;
            const isBelow = diff < -0.15;
            const compText = isAbove ? 'priced above peers' : isBelow ? 'priced below peers' : 'in line with peers';
            const chipColor = isAbove
              ? { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', text: 'var(--accent-red)' }
              : isBelow
                ? { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', text: 'var(--accent-green)' }
                : { bg: 'var(--bg-card)', border: 'var(--border)', text: 'var(--accent-blue)' };
            const label = `${stockPE.toFixed(1)}x P/E vs ${Math.round(sectorAvgPE)}x sector avg — ${compText}`;
            const tooltip = 'P/E ratio compares how much investors pay per $1 of profit. A higher P/E than peers means the stock is priced for more growth.';
            return (
              <span
                key="sector"
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => setHoveredIdx('sector')}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {hoveredIdx === 'sector' && (
                  <span style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(18,20,28,0.97)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'normal',
                    maxWidth: '220px',
                    width: 'max-content',
                    lineHeight: 1.45,
                    zIndex: 10,
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}>
                    {tooltip}
                  </span>
                )}
                <span style={{
                  background: chipColor.bg,
                  border: `1px solid ${chipColor.border}`,
                  borderRadius: '20px',
                  padding: '4px 13px',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  color: chipColor.text,
                  fontWeight: 600,
                }}>
                  {label}
                </span>
              </span>
            );
          })()}
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
          {quote?.price != null && bull?.priceTargetRange && (
            <p style={{ fontSize: '0.8rem', margin: '0 0 10px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Most likely </span>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>
                ${Math.round(quote.price * 0.9)}–${Math.round((bull.priceTargetRange.low + bull.priceTargetRange.high) / 2)}
              </span>
            </p>
          )}
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
          {forecast.confidenceScore != null && (() => {
            const score = forecast.confidenceScore;
            const barColor = score >= 65
              ? 'var(--accent-green)'
              : score >= 45
                ? 'var(--accent-amber)'
                : 'var(--accent-red)';
            return (
              <div style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                  <span style={{ ...muted, fontSize: '0.74rem' }}>Confidence</span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: barColor }}>{score}%</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-input)' }}>
                  <div style={{ height: '100%', width: `${score}%`, borderRadius: '3px', background: barColor, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })()}
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

      {/* ── Historical scenarios ── */}
      {historicalScenarios?.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <p style={{ ...sectionLabel, color: 'var(--text-muted)', marginBottom: '10px' }}>
            When This Happened Before
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {historicalScenarios.map((s, i) => {
              const outcomeColor = s.outcome?.startsWith('+')
                ? 'var(--accent-green)'
                : s.outcome?.startsWith('-')
                  ? 'var(--accent-red)'
                  : 'var(--text-muted)';
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                }}>
                  <span style={{
                    background: 'rgba(79,142,247,0.15)',
                    color: 'var(--accent-blue)',
                    border: '1px solid rgba(79,142,247,0.3)',
                    borderRadius: '20px',
                    padding: '2px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>{s.year}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', lineHeight: 1.4, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.situation}
                    </p>
                    <p style={{ ...muted, fontSize: '0.76rem', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.similarity}
                    </p>
                  </div>
                  <span style={{
                    color: outcomeColor,
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    flexShrink: 0,
                    maxWidth: '200px',
                    minWidth: '90px',
                    textAlign: 'right',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>{s.outcome}</span>
                  <p style={{
                    ...muted,
                    fontSize: '0.74rem',
                    fontStyle: 'italic',
                    margin: 0,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '150px',
                    textAlign: 'right',
                  }}>{s.lesson}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
