import { useState } from 'react';

const SECTORS = [
  'Technology', 'Healthcare', 'Finance', 'Energy',
  'Consumer', 'Utilities', 'Real Estate', 'Industrials', 'Materials',
];

const RISK_DESCRIPTIONS = {
  low:    'I want to protect what I have. Stability over growth.',
  medium: "I'm comfortable with some ups and downs for better returns.",
  high:   "I can handle big swings. I'm aiming for maximum growth.",
};

const GOAL_MODES = [
  { value: 'just-starting',          label: 'Just Starting Out' },
  { value: 'growing-wealth',         label: 'Growing Wealth' },
  { value: 'approaching-retirement', label: 'Approaching Retirement' },
  { value: 'already-retired',        label: 'Already Retired' },
];

function formatAmountPreview(raw) {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) return null;
  return `$${n.toLocaleString()} to invest`;
}

export default function InputForm({ onSubmit, disabled }) {
  const [riskProfile, setRiskProfile] = useState('medium');
  const [amount, setAmount] = useState('');
  const [holdPeriod, setHoldPeriod] = useState('long');
  const [sectors, setSectors] = useState([]);
  const [goalMode, setGoalMode] = useState('growing-wealth');
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
    onSubmit({ riskProfile, amount: amt, holdPeriod, sectors, goalMode });
  }

  const amountPreview = formatAmountPreview(amount);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Risk Tolerance */}
      <div>
        <span className="section-label" style={{ display: 'block', marginBottom: 4 }}>
          How much risk fits you?
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
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
        <p style={{
          fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0,
          fontStyle: 'italic', minHeight: 16,
        }}>
          {RISK_DESCRIPTIONS[riskProfile]}
        </p>
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
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setAmount(val);
              setAmtError('');
            }}
            placeholder="5000"
            className="ticker-input"
            style={{
              paddingLeft: 28,
              borderColor: amtError ? 'var(--accent-red)' : undefined,
              backgroundColor: 'var(--bg-input)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--border-focus)';
              e.target.style.backgroundColor = 'var(--bg-input)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = amtError ? 'var(--accent-red)' : 'var(--border)';
              e.target.style.backgroundColor = 'var(--bg-input)';
            }}
          />
        </div>
        {amtError && (
          <p style={{ color: 'var(--accent-red)', fontSize: 11, marginTop: 6 }}>{amtError}</p>
        )}
        {amountPreview && !amtError && (
          <p style={{
            fontSize: 11, color: 'var(--text-muted)', marginTop: 6,
            fontFamily: "'DM Mono', monospace",
          }}>{amountPreview}</p>
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

      {/* Goal Mode */}
      <div>
        <span className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Goal Mode
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {GOAL_MODES.map(({ value, label }) => {
            const active = goalMode === value;
            return (
              <button
                type="button"
                key={value}
                onClick={() => setGoalMode(value)}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${active ? 'var(--accent-green)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-green-dim)' : 'var(--bg-input)',
                  color: active ? 'var(--accent-green-bright)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
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
        ) : 'Find My Stocks'}
      </button>

    </form>
  );
}
