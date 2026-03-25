export default function LoadingState() {
  return (
    <div>
      <p className="section-label" style={{ marginBottom: 'var(--space-5)' }}>
        Analyzing your profile...
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 260, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }} />
        ))}
      </div>
    </div>
  );
}
