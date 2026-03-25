export default function Nav({ currentPage, onNavigate }) {
  return (
    <nav className="nav-bar">
      <div className="nav-logo">
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>M</span>
        <em style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic' }}>eridian</em>
      </div>

      <div className="nav-pill-group">
        <button
          className={`nav-pill${currentPage === 'home' ? ' active' : ''}`}
          onClick={() => onNavigate('home')}
        >
          Suggestions
        </button>
        <button
          className={`nav-pill${currentPage === 'forecast' ? ' active' : ''}`}
          onClick={() => onNavigate('forecast')}
        >
          Forecast
        </button>
      </div>

      <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Educational only — not financial advice
      </span>
    </nav>
  );
}
