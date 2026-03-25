import { useState } from 'react';
import MetricChip from './MetricChip.jsx';
import CaseCard from './CaseCard.jsx';
import ScenarioRow from './ScenarioRow.jsx';

export default function ForecastResult({ forecast, ticker, companyName, quote, stockPE, sectorAvgPE }) {
  const { keyMetrics, verdict, bull, bear, educationalNote, historicalScenarios } = forecast;
  const [noteOpen, setNoteOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const lean = verdict?.lean?.toLowerCase() ?? 'neutral';

  const bullMid = bull?.priceTargetRange
    ? Math.round((bull.priceTargetRange.low + bull.priceTargetRange.high) / 2)
    : null;

  const mostLikelyRange = quote?.price != null && bullMid != null
    ? { low: Math.round(quote.price * 0.9), high: bullMid }
    : null;

  // Sector P/E chip config
  let sectorChip = null;
  if (stockPE != null && sectorAvgPE != null) {
    const diff = (stockPE - sectorAvgPE) / sectorAvgPE;
    const isAbove = diff > 0.15;
    const isBelow = diff < -0.15;
    const compText = isAbove ? 'above peers' : isBelow ? 'below peers' : 'in line with peers';
    sectorChip = {
      value: `${stockPE.toFixed(1)}x`,
      label: `P/E vs ${Math.round(sectorAvgPE)}x avg — ${compText}`,
      tooltip: 'P/E ratio compares how much investors pay per $1 of profit. A higher P/E than peers means the stock is priced for more growth.',
      variant: isAbove ? 'warning' : 'default',
    };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

      {/* ── Header row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 18px',
      }}>
        <span className="ticker-badge">{ticker}</span>
        <span style={{ fontWeight: 600, fontSize: 15, marginRight: 'auto' }}>{companyName}</span>

        {quote?.price != null && (
          <span className="price-large" style={{ fontSize: 18 }}>
            ${quote.price.toFixed(2)}
          </span>
        )}

        {quote?.low52 != null && quote?.high52 != null && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            52w ${quote.low52.toFixed(2)}–${quote.high52.toFixed(2)}
          </span>
        )}

        {quote?.changePercent != null && (
          <span style={{
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            color: Number(quote.changePercent) >= 0 ? 'var(--accent-green-bright)' : 'var(--accent-red)',
          }}>
            {Number(quote.changePercent) >= 0 ? '+' : ''}{quote.changePercent}%
          </span>
        )}
      </div>

      {/* ── Horizon label ── */}
      <p className="section-label">
        6–12 month educational forecast — not a guarantee
      </p>

      {/* ── Metrics strip ── */}
      {(keyMetrics?.length > 0 || sectorChip) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {keyMetrics?.map((m, i) => {
            const parenIdx = m.label.indexOf('(');
            const shortLabel = parenIdx > -1 ? m.label.slice(0, parenIdx).trim() : m.label;
            const definition = parenIdx > -1 ? m.label.slice(parenIdx + 1).replace(/\)$/, '').trim() : null;
            return (
              <MetricChip
                key={i}
                value={m.value}
                label={shortLabel}
                tooltip={definition}
              />
            );
          })}
          {sectorChip && (
            <MetricChip
              value={sectorChip.value}
              label={sectorChip.label}
              tooltip={sectorChip.tooltip}
              variant={sectorChip.variant}
            />
          )}
        </div>
      )}

      {/* ── Three columns ── */}
      <div className="case-columns">
        <CaseCard
          type="bull"
          headline={bull?.headline}
          bullets={(bull?.drivers ?? []).slice(0, 3).map((d) => d.explanation)}
          target={bull?.priceTargetRange ? `$${bull.priceTargetRange.low}–$${bull.priceTargetRange.high}` : null}
          targetLabel="Price Target"
        />

        <CaseCard
          type="forecast"
          verdict={verdict?.summary}
          lean={lean}
          confidenceScore={forecast.confidenceScore}
          mostLikelyRange={mostLikelyRange}
        />

        <CaseCard
          type="bear"
          headline={bear?.headline}
          bullets={(bear?.risks ?? []).slice(0, 3).map((r) => r.explanation)}
          target={bear?.downsideScenario ? `$${bear.downsideScenario.low}–$${bear.downsideScenario.high}` : null}
          targetLabel="Downside Scenario"
        />
      </div>

      {/* ── Historical scenarios ── */}
      {historicalScenarios?.length > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-5)',
        }}>
          <p className="section-label" style={{ marginBottom: 'var(--space-3)' }}>
            When This Happened Before
          </p>
          {historicalScenarios.map((s, i) => (
            <ScenarioRow
              key={i}
              year={s.year}
              situation={s.situation}
              similarity={s.similarity}
              outcome={s.outcome}
              lesson={s.lesson}
            />
          ))}
        </div>
      )}

      {/* ── Educational note toggle ── */}
      {educationalNote && (
        <div>
          <button
            onClick={() => setNoteOpen((v) => !v)}
            style={{ color: 'var(--accent-amber)', fontSize: 12, padding: 0 }}
          >
            {noteOpen ? '▲' : '▼'} What this analysis teaches
          </button>
          {noteOpen && (
            <p style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              marginTop: 6,
              paddingLeft: 14,
              borderLeft: '2px solid rgba(196,148,58,0.3)',
            }}>
              {educationalNote}
            </p>
          )}
        </div>
      )}

      {/* ── How this forecast is made ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <button
          onClick={() => setHowOpen((v) => !v)}
          style={{
            width: '100%',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text-muted)',
            fontSize: 11,
          }}
        >
          <span>How this forecast is made</span>
          <span style={{ fontSize: 10 }}>{howOpen ? '▲' : '▼'}</span>
        </button>
        {howOpen && (
          <ul style={{
            margin: 0,
            padding: '4px 14px 12px',
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            borderTop: '1px solid var(--border)',
          }}>
            {[
              { icon: '📊', text: 'Real market data — current price, 52-week range, and key ratios pulled live from Finnhub' },
              { icon: '📰', text: 'Recent news — last 5 company headlines from the past 14 days' },
              { icon: '🧮', text: 'Financial history — last 3 years of revenue, earnings, and cash flow reported by the company' },
              { icon: '🤖', text: 'Claude AI — reads all of the above and writes the bull case, bear case, and verdict in plain English' },
            ].map(({ icon, text }) => (
              <li key={icon} style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.5 }}>
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
