import { useState } from 'react';

const SECTORS = [
  'Technology', 'Healthcare', 'Finance', 'Energy',
  'Consumer', 'Utilities', 'Real Estate', 'Industrials', 'Materials',
];

const toggleStyle = (active) => ({
  padding: '8px 20px',
  borderRadius: '20px',
  border: `1px solid ${active ? 'var(--accent-blue)' : 'var(--border)'}`,
  background: active ? 'rgba(79,142,247,0.15)' : 'var(--bg-input)',
  color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
  fontWeight: active ? 600 : 400,
  fontSize: '0.9rem',
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const sectorChipStyle = (active) => ({
  padding: '5px 12px',
  borderRadius: '16px',
  border: `1px solid ${active ? 'var(--accent-blue)' : 'var(--border)'}`,
  background: active ? 'rgba(79,142,247,0.12)' : 'var(--bg-input)',
  color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
  fontSize: '0.8rem',
  cursor: 'pointer',
  transition: 'all 0.15s',
});

export default function InputForm({ onSubmit, disabled }) {
  const [riskProfile, setRiskProfile] = useState('medium');
  const [amount, setAmount] = useState('');
  const [holdPeriod, setHoldPeriod] = useState('long');
  const [sectors, setSectors] = useState([]);
  const [amtError, setAmtError] = useState('');

  function toggleSector(s) {
    setSectors((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amount || !Number.isFinite(amt) || amt <= 0) {
      setAmtError('Please enter a positive amount.');
      return;
    }
    setAmtError('');
    onSubmit({ riskProfile, amount: amt, holdPeriod, sectors });
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

      {/* Risk Profile */}
      <div>
        <span style={label}>Risk Tolerance</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['low', 'medium', 'high'].map((r) => (
            <button type="button" key={r} style={toggleStyle(riskProfile === r)} onClick={() => setRiskProfile(r)}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label style={label} htmlFor="amount">Amount to Invest</label>
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <span style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none',
          }}>$</span>
          <input
            id="amount"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setAmtError(''); }}
            placeholder="e.g. 5000"
            style={{
              width: '100%',
              padding: '10px 14px 10px 28px',
              background: 'var(--bg-input)',
              border: `1px solid ${amtError ? 'var(--accent-red)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--border-focus)'}
            onBlur={(e) => e.target.style.borderColor = amtError ? 'var(--accent-red)' : 'var(--border)'}
          />
        </div>
        {amtError && <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '6px' }}>{amtError}</p>}
      </div>

      {/* Hold Period */}
      <div>
        <span style={label}>Hold Period</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[['short', '< 1 year'], ['medium', '1–5 years'], ['long', '5+ years']].map(([val, display]) => (
            <button type="button" key={val} style={toggleStyle(holdPeriod === val)} onClick={() => setHoldPeriod(val)}>
              {display}
            </button>
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div>
        <span style={label}>Sectors of Interest <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {SECTORS.map((s) => (
            <button type="button" key={s} style={sectorChipStyle(sectors.includes(s))} onClick={() => toggleSector(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
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
          transition: 'background 0.2s, opacity 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {disabled ? (
          <>
            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Analyzing your profile...
          </>
        ) : 'Get My Educational Picks'}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}
