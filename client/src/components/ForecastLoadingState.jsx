export default function ForecastLoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
        Fetching market data and generating forecast analysis...
      </p>
      <div className="shimmer" style={{ height: 180, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
      <div className="shimmer" style={{ height: 280, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
      <div className="shimmer" style={{ height: 280, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
    </div>
  );
}
