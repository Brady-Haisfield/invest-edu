import { useState } from 'react';

const SECTORS = [
  'Technology', 'Healthcare', 'Finance', 'Energy',
  'Consumer', 'Utilities', 'Real Estate', 'Industrials', 'Materials',
];

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

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Risk Tolerance */}
      <div>
        <span className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Risk Tolerance
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {['low', 'medium', 'high'].map((r) => (
            <button
              type="button"
              key={r}
              className={`btn-toggle${riskProfile === r ? ' active' : ''}`}
              onClick={() => setRiskProfile(r)}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="section-label" htmlFor="amount" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Amount to Invest
        </label>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none',
            fontFamily: "'DM Mono', monospace",
          }}>$</span>
          <input
            id="amount"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setAmtError(''); }}
            placeholder="5000"
            className="ticker-input"
            style={{
              paddingLeft: 28,
              borderColor: amtError ? 'var(--accent-red)' : undefined,
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--border-focus)'}
            onBlur={(e) => e.target.style.borderColor = amtError ? 'var(--accent-red)' : 'var(--border)'}
          />
        </div>
        {amtError && (
          <p style={{ color: 'var(--accent-red)', fontSize: 11, marginTop: 6 }}>{amtError}</p>
        )}
      </div>

      {/* Hold Period */}
      <div>
        <span className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Hold Period
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[['short', '< 1 year'], ['medium', '1–5 years'], ['long', '5+ years']].map(([val, display]) => (
            <button
              type="button"
              key={val}
              className={`btn-toggle${holdPeriod === val ? ' active' : ''}`}
              onClick={() => setHoldPeriod(val)}
            >
              {display}
            </button>
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div>
        <span className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Sectors{' '}
          <span style={{ textTransform: 'none', letterSpacing: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
            (optional)
          </span>
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {SECTORS.map((s) => (
            <button
              type="button"
              key={s}
              className={`chip${sectors.includes(s) ? ' active' : ''}`}
              onClick={() => toggleSector(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button type="submit" disabled={disabled} className="btn-primary">
        {disabled ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            Analyzing...
          </span>
        ) : 'Get My Educational Picks'}
      </button>

    </form>
  );
}
