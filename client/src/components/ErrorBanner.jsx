export default function ErrorBanner({ message, onDismiss }) {
  const friendly = message?.includes('not valid JSON') || message?.includes('unexpected format')
    ? 'Our AI had trouble generating suggestions. Please try again.'
    : message?.includes('fetch') || message?.includes('Failed to fetch')
    ? 'Could not reach the server. Is the backend running on port 3001?'
    : message;

  return (
    <div style={{
      background: 'rgba(248, 113, 113, 0.08)',
      border: '1px solid rgba(248, 113, 113, 0.3)',
      borderLeft: '4px solid var(--accent-red)',
      borderRadius: 'var(--radius-sm)',
      padding: '14px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      marginBottom: '1.5rem',
    }}>
      <p style={{ color: '#f87171', fontSize: '0.9rem', lineHeight: 1.5 }}>{friendly}</p>
      <button onClick={onDismiss} style={{
        background: 'none',
        border: 'none',
        color: '#f87171',
        fontSize: '1.2rem',
        lineHeight: 1,
        padding: 0,
        flexShrink: 0,
        opacity: 0.7,
      }}>×</button>
    </div>
  );
}
