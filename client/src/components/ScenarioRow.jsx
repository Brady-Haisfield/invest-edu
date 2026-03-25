export default function ScenarioRow({ year, situation, similarity, outcome, lesson }) {
  const outcomeColor = outcome?.startsWith('+')
    ? 'var(--accent-green-bright)'
    : outcome?.startsWith('-')
    ? 'var(--accent-red)'
    : 'var(--text-secondary)';

  return (
    <div className="scenario-row">
      <div>
        <span className="year-pill">{year}</span>
      </div>

      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{situation}</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{similarity}</p>
      </div>

      <div>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 12,
          fontWeight: 500,
          color: outcomeColor,
        }}>
          {outcome}
        </span>
      </div>

      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{lesson}</p>
      </div>
    </div>
  );
}
