export default function CaseCard({
  type,           // 'bull' | 'forecast' | 'bear'
  headline,
  bullets = [],
  target,         // string like '$220 – $260'
  targetLabel,
  verdict,
  lean,
  confidenceScore,
  mostLikelyRange,
}) {
  const leanColors = {
    bullish: { bg: 'rgba(74,158,106,0.15)', border: 'rgba(74,158,106,0.3)', color: 'var(--accent-green-bright)' },
    neutral: { bg: 'rgba(196,148,58,0.12)', border: 'rgba(196,148,58,0.3)', color: 'var(--accent-amber)' },
    bearish: { bg: 'rgba(196,92,92,0.12)', border: 'rgba(196,92,92,0.3)', color: 'var(--accent-red)' },
  };

  const labelColors = {
    bull: 'var(--accent-green)',
    forecast: 'var(--accent-blue)',
    bear: 'var(--accent-red)',
  };

  const labelText = {
    bull: 'Bull Case',
    forecast: 'Verdict',
    bear: 'Bear Case',
  };

  const lc = leanColors[lean] ?? leanColors.neutral;

  const confidenceColor =
    confidenceScore >= 65 ? 'var(--accent-green)' :
    confidenceScore >= 45 ? 'var(--accent-amber)' :
    'var(--accent-red)';

  return (
    <div className={`case-card case-card--${type}`}>
      <div className="case-label" style={{ color: labelColors[type] }}>
        {labelText[type]}
      </div>

      {/* Forecast (verdict) column */}
      {type === 'forecast' && verdict && (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-2)', lineHeight: 1.5 }}>
            {verdict}
          </p>

          {lean && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginTop: 'var(--space-3)',
              padding: '4px 10px',
              borderRadius: 100,
              background: lc.bg,
              border: `1px solid ${lc.border}`,
              color: lc.color,
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.5px',
            }}>
              {lean.toUpperCase()}
            </div>
          )}

          {confidenceScore != null && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.5px' }}>
                  CONFIDENCE
                </span>
                <span style={{ fontSize: 10, color: confidenceColor, fontFamily: "'DM Mono', monospace" }}>
                  {confidenceScore}%
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${confidenceScore}%`,
                  background: confidenceColor,
                  borderRadius: 2,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          )}

          {mostLikelyRange && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="case-label" style={{ color: 'var(--text-muted)' }}>Most Likely Range</div>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 16,
                color: 'var(--accent-blue)',
                marginTop: 4,
              }}>
                ${mostLikelyRange.low} – ${mostLikelyRange.high}
              </div>
            </div>
          )}
        </>
      )}

      {/* Bull / Bear columns */}
      {type !== 'forecast' && (
        <>
          {headline && <p className="case-headline">{headline}</p>}

          {bullets.length > 0 && (
            <ul className="bullet-list">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}

          {target && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="case-label" style={{ color: 'var(--text-muted)' }}>
                {targetLabel ?? 'Price Target'}
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 15,
                color: type === 'bull' ? 'var(--accent-green-bright)' : 'var(--accent-red)',
                marginTop: 4,
              }}>
                {target}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
