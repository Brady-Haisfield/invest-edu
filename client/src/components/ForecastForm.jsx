import { useState, useEffect, useRef } from 'react';

const TICKER_RE = /^[A-Z]{1,5}$/;

export default function ForecastForm({ onSubmit, disabled }) {
  const [ticker, setTicker] = useState('');
  const [tickerError, setTickerError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Debounced search
  useEffect(() => {
    const query = ticker.trim();
    if (query.length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowDropdown((data.results ?? []).length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [ticker]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectSuggestion(item) {
    setTicker(item.ticker);
    setSuggestions([]);
    setShowDropdown(false);
    setTickerError('');
    onSubmit(item.ticker);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const val = ticker.trim().toUpperCase();
    if (!val || !TICKER_RE.test(val)) {
      setTickerError('Enter a valid ticker symbol (e.g. AAPL, MSFT).');
      return;
    }
    setTickerError('');
    setShowDropdown(false);
    onSubmit(val);
  }

  const label = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '10px',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <label style={label} htmlFor="ticker">Stock Ticker or Company Name</label>
        <input
          id="ticker"
          type="text"
          value={ticker}
          onChange={(e) => { setTicker(e.target.value.toUpperCase()); setTickerError(''); }}
          placeholder="e.g. AAPL or Apple"
          maxLength={30}
          disabled={disabled}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--bg-input)',
            border: `1px solid ${tickerError ? 'var(--accent-red)' : 'var(--border)'}`,
            borderRadius: showDropdown ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            outline: 'none',
            transition: 'border-color 0.15s',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--border-focus)';
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={(e) => e.target.style.borderColor = tickerError ? 'var(--accent-red)' : 'var(--border)'}
        />

        {showDropdown && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-focus)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
            zIndex: 100,
            overflow: 'hidden',
          }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => selectSuggestion(s)}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 700, flexShrink: 0 }}>{s.ticker}</span>
              </button>
            ))}
          </div>
        )}

        {tickerError && (
          <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '6px' }}>{tickerError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled}
        style={{
          padding: '13px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: disabled ? 'var(--border)' : 'var(--accent-blue)',
          color: disabled ? 'var(--text-muted)' : '#fff',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {disabled ? (
          <>
            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Generating Forecast...
          </>
        ) : 'Generate Forecast'}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}
