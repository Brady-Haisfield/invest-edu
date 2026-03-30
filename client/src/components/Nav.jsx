import { useState, useRef, useEffect } from 'react';

export default function Nav({ currentPage, onNavigate, user, onSignIn, onSignOut, onShowSavedPlans, onEditProfile }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          My Dashboard
        </button>
        {user && (
          <button
            className={`nav-pill${currentPage === 'portfolio' ? ' active' : ''}`}
            onClick={() => onNavigate('portfolio')}
          >
            My Portfolio
          </button>
        )}
        <button
          className={`nav-pill${currentPage === 'forecast' ? ' active' : ''}`}
          onClick={() => onNavigate('forecast')}
        >
          Forecast
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Educational only — not financial advice
        </span>

        {!user ? (
          <button
            type="button"
            onClick={onSignIn}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace",
              padding: '4px 8px', borderRadius: 'var(--radius-sm)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            Sign In
          </button>
        ) : (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Avatar */}
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--accent-green-dim)',
                border: '1px solid var(--accent-green)',
                color: 'var(--accent-green-bright)',
                fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
            >
              {user.email[0].toUpperCase()}
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', minWidth: 180,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}>
                {/* Hello */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                    Hello,
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", marginTop: 2, wordBreak: 'break-all' }}>
                    {user.email}
                  </div>
                </div>

                {/* Actions */}
                {[
                  { label: 'Saved Plans', action: () => { setDropdownOpen(false); onShowSavedPlans(); } },
                  { label: 'Edit Profile', action: () => { setDropdownOpen(false); onEditProfile(); } },
                  { label: 'Sign Out', action: () => { setDropdownOpen(false); onSignOut(); }, danger: true },
                ].map(({ label, action, danger }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    style={{
                      display: 'block', width: '100%', padding: '9px 14px',
                      background: 'none', border: 'none', textAlign: 'left',
                      fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: 'pointer',
                      color: danger ? 'var(--accent-red)' : 'var(--text-secondary)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
