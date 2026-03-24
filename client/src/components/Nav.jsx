const tabStyle = (active) => ({
  padding: '9px 20px',
  borderRadius: '20px',
  border: `1px solid ${active ? 'rgba(79,142,247,0.3)' : 'var(--border)'}`,
  background: active ? 'rgba(79,142,247,0.15)' : 'var(--bg-input)',
  color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
  fontWeight: active ? 600 : 400,
  fontSize: '0.9rem',
  cursor: 'pointer',
  transition: 'all 0.15s',
});

export default function Nav({ currentPage, onNavigate }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
      <button style={tabStyle(currentPage === 'home')} onClick={() => onNavigate('home')}>
        Stock Suggestions
      </button>
      <button style={tabStyle(currentPage === 'forecast')} onClick={() => onNavigate('forecast')}>
        Stock Forecast
      </button>
    </div>
  );
}
