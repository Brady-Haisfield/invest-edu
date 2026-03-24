export default function LoadingState() {
  return (
    <div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Analyzing your profile and fetching market data...
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shimmer" style={{
            height: 260,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }} />
        ))}
      </div>
    </div>
  );
}
