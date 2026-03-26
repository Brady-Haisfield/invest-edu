import { useState } from 'react';

// ─── Option lists ────────────────────────────────────────────────────────────

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

const ANNUAL_INCOMES = [
  'Under $30,000', '$30,000 – $60,000', '$60,000 – $100,000',
  '$100,000 – $200,000', '$200,000 – $500,000', '$500,000+',
];
const EMPLOYMENT_OPTIONS  = ['Employed', 'Self-Employed', 'Retired', 'Student', 'Between Jobs'];
const EMERGENCY_FUND_OPT  = ['Yes', 'No', 'Working on it'];
const EXISTING_INV_OPT    = ['401(k) or IRA', 'Brokerage Account', 'Real Estate', 'Crypto', 'None yet'];
const FAMILY_OPTIONS      = ['Single, no dependents', 'Married, no dependents', 'Married with children', 'Single parent', 'Supporting aging parents', 'Empty nester'];
const HOMEOWNERSHIP_OPT   = ['Renting', 'Own my home', 'Paying a mortgage'];
const UPCOMING_EXP_OPT    = ['Buying a home', 'College tuition', 'Starting a business', 'Wedding', 'Medical expenses', 'None planned'];
const PRIORITIES_OPT      = ['Growing my wealth long-term', 'Generating income now', 'Protecting what I have', 'Beating inflation', 'Leaving something for my family'];
const DROP_REACTION_OPT   = ["I'd sell immediately — I can't handle that", "I'd be nervous but hold on", "I'd stay calm and wait it out", "I'd buy more — great opportunity"];
const THEMES_OPT          = ['Clean energy / ESG', 'Artificial Intelligence', 'Healthcare & biotech', 'Dividend income', 'International markets', 'No preference'];
const INVOLVEMENT_OPT     = ['Set it and forget it', 'Check in quarterly', 'Active — I want to understand every pick'];
const PURPOSE_OPT         = ['Retirement', 'Building general wealth', 'A specific purchase', "My children's future", 'Financial independence / early retirement', "I'm not sure yet"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAgeHint(raw) {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0 || n > 120) return null;
  if (n < 40) return 'You have time on your side. Growth-oriented options may suit you well.';
  if (n < 55) return 'A balance of growth and stability is common at this stage.';
  if (n < 65) return 'Approaching retirement. Capital preservation becomes more important.';
  return 'Income and stability are typically the priority at this stage.';
}

function formatAmountPreview(raw) {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) return null;
  return `$${n.toLocaleString()} to invest`;
}

function calcCompleteness({ riskProfile, goalMode, holdPeriod, age, amount, annualIncome, employmentStatus, emergencyFund, existingInvestments, familySituation, homeownership, upcomingExpenses, priorities, dropReaction, themes, involvement, investmentPurpose, sectors }) {
  const checks = [
    !!riskProfile,
    !!goalMode,
    !!holdPeriod,
    !!(age && Number(age) > 0),
    !!(amount && Number(amount) > 0),
    !!annualIncome,
    !!employmentStatus,
    !!emergencyFund,
    existingInvestments.length > 0,
    !!familySituation,
    !!homeownership,
    upcomingExpenses.length > 0,
    priorities.length > 0,
    !!dropReaction,
    themes.length > 0,
    !!involvement,
    !!investmentPurpose,
    sectors.length > 0,
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  let label;
  if (pct <= 30)      label = 'Basic profile';
  else if (pct <= 60) label = 'Good profile';
  else if (pct <= 85) label = 'Strong profile';
  else                label = 'Full profile — best suggestions';
  return { pct, label };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <span className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
      {children}
    </span>
  );
}

function SectionDivider({ title }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)' }}>
      <span className="section-label" style={{ display: 'block', marginBottom: 'var(--space-4)', color: 'var(--accent-green-bright)', letterSpacing: '1.5px' }}>
        {title}
      </span>
    </div>
  );
}

// Single-select: clicking active item deselects it
function SinglePills({ options, value, onChange, column }) {
  return (
    <div style={{ display: 'flex', flexDirection: column ? 'column' : 'row', flexWrap: column ? undefined : 'wrap', gap: 'var(--space-2)' }}>
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          className={`chip${value === opt ? ' active' : ''}`}
          onClick={() => onChange(value === opt ? '' : opt)}
        >{opt}</button>
      ))}
    </div>
  );
}

// Multi-select with optional max
function MultiPills({ options, values, onToggle, max }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      {options.map((opt) => {
        const selected = values.includes(opt);
        const maxed    = max && !selected && values.length >= max;
        return (
          <button
            type="button"
            key={opt}
            className={`chip${selected ? ' active' : ''}`}
            onClick={() => !maxed && onToggle(opt)}
            style={{ opacity: maxed ? 0.35 : 1, cursor: maxed ? 'default' : 'pointer' }}
          >{opt}</button>
        );
      })}
    </div>
  );
}

function SelectDropdown({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 36px 10px 12px', appearance: 'none',
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 13, cursor: 'pointer', outline: 'none',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 10, pointerEvents: 'none' }}>▾</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InputForm({ onSubmit, disabled }) {
  // Section 1 — always visible
  const [riskProfile, setRiskProfile] = useState('medium');
  const [age, setAge]                 = useState('');
  const [goalMode, setGoalMode]       = useState('growing-wealth');

  // Section 2 — Financial Picture
  const [annualIncome, setAnnualIncome]             = useState('');
  const [employmentStatus, setEmploymentStatus]     = useState('');
  const [emergencyFund, setEmergencyFund]           = useState('');
  const [existingInvestments, setExistingInvestments] = useState([]);

  // Section 3 — Life Situation
  const [familySituation, setFamilySituation] = useState('');
  const [homeownership, setHomeownership]     = useState('');
  const [upcomingExpenses, setUpcomingExpenses] = useState([]);

  // Section 4 — Investment Preferences
  const [priorities, setPriorities]   = useState([]);
  const [dropReaction, setDropReaction] = useState('');
  const [themes, setThemes]           = useState([]);
  const [involvement, setInvolvement] = useState('');

  // Section 5 — Goals
  const [investmentPurpose, setInvestmentPurpose] = useState('');
  const [amount, setAmount]       = useState('');
  const [holdPeriod, setHoldPeriod] = useState('long');
  const [sectors, setSectors]     = useState([]);

  // UI
  const [amtError, setAmtError]   = useState('');
  const [expanded, setExpanded]   = useState(false);

  function toggleMulti(setter, val, max) {
    setter((prev) => {
      if (prev.includes(val)) return prev.filter((x) => x !== val);
      if (max && prev.length >= max) return prev;
      return [...prev, val];
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amount || !Number.isFinite(amt) || amt <= 0) {
      if (!expanded) setExpanded(true); // open so user can see the amount field
      setAmtError('Please enter an amount in the Goals section.');
      return;
    }
    setAmtError('');
    const ageNum = Number(age);
    onSubmit({
      riskProfile, goalMode,
      age: Number.isFinite(ageNum) && ageNum > 0 ? ageNum : null,
      annualIncome, employmentStatus, emergencyFund, existingInvestments,
      familySituation, homeownership, upcomingExpenses,
      priorities, dropReaction, themes, involvement,
      investmentPurpose, amount: amt, holdPeriod, sectors,
    });
  }

  const { pct, label } = calcCompleteness({
    riskProfile, goalMode, holdPeriod, age, amount, annualIncome, employmentStatus,
    emergencyFund, existingInvestments, familySituation, homeownership, upcomingExpenses,
    priorities, dropReaction, themes, involvement, investmentPurpose, sectors,
  });

  const amountPreview = formatAmountPreview(amount);
  const ageHint       = getAgeHint(age);
  const coreComplete  = age && Number(age) > 0 && amount && Number(amount) > 0;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── Profile completeness ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="section-label">Profile completeness</span>
          <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: pct >= 86 ? 'var(--accent-green-bright)' : 'var(--text-muted)' }}>
            {label}
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-green)', borderRadius: 2, transition: 'width 0.35s ease' }} />
        </div>
      </div>

      {/* ── Section 1 — Core ── */}

      <div>
        <FieldLabel>How much risk fits you?</FieldLabel>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
          {['low', 'medium', 'high'].map((r) => (
            <button type="button" key={r} className={`btn-toggle${riskProfile === r ? ' active' : ''}`} onClick={() => setRiskProfile(r)}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
          {RISK_DESCRIPTIONS[riskProfile]}
        </p>
      </div>

      <div>
        <FieldLabel>Your Age</FieldLabel>
        <input
          type="text" inputMode="numeric" pattern="[0-9]*"
          value={age}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))}
          placeholder="e.g. 42"
          className="ticker-input"
          style={{ backgroundColor: 'var(--bg-input)' }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--border-focus)'; }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
        />
        {ageHint && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>{ageHint}</p>
        )}
      </div>

      <div>
        <FieldLabel>Goal Mode</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {GOAL_MODES.map(({ value, label: lbl }) => {
            const active = goalMode === value;
            return (
              <button
                type="button" key={value} onClick={() => setGoalMode(value)}
                style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 'var(--radius)',
                  border: `1px solid ${active ? 'var(--accent-green)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-green-dim)' : 'var(--bg-input)',
                  color: active ? 'var(--accent-green-bright)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{lbl}</button>
            );
          })}
        </div>
      </div>

      {/* ── Expand button ── */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 0', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', background: 'var(--bg-input)',
          color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {expanded ? '← Show less' : 'Tell us more →'}
      </button>

      {/* ── Sections 2–5 (conditional) ── */}
      {expanded && (
        <>
          {/* ── Section 2 — Financial Picture ── */}
          <SectionDivider title="Financial Picture" />

          <div>
            <FieldLabel>Annual Income</FieldLabel>
            <SelectDropdown value={annualIncome} onChange={setAnnualIncome} options={ANNUAL_INCOMES} placeholder="Select your income range…" />
          </div>

          <div>
            <FieldLabel>Employment Status</FieldLabel>
            <SinglePills options={EMPLOYMENT_OPTIONS} value={employmentStatus} onChange={setEmploymentStatus} />
          </div>

          <div>
            <FieldLabel>Do you have an emergency fund?</FieldLabel>
            <SinglePills options={EMERGENCY_FUND_OPT} value={emergencyFund} onChange={setEmergencyFund} />
            {emergencyFund === 'No' && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
                Financial advisors typically recommend 3–6 months of expenses saved before investing.
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Existing investments</FieldLabel>
            <MultiPills options={EXISTING_INV_OPT} values={existingInvestments} onToggle={(v) => toggleMulti(setExistingInvestments, v)} />
          </div>

          {/* ── Section 3 — Life Situation ── */}
          <SectionDivider title="Life Situation" />

          <div>
            <FieldLabel>Family situation</FieldLabel>
            <SinglePills options={FAMILY_OPTIONS} value={familySituation} onChange={setFamilySituation} column />
          </div>

          <div>
            <FieldLabel>Homeownership</FieldLabel>
            <SinglePills options={HOMEOWNERSHIP_OPT} value={homeownership} onChange={setHomeownership} />
          </div>

          <div>
            <FieldLabel>Major expenses coming up?</FieldLabel>
            <MultiPills options={UPCOMING_EXP_OPT} values={upcomingExpenses} onToggle={(v) => toggleMulti(setUpcomingExpenses, v)} />
          </div>

          {/* ── Section 4 — Investment Preferences ── */}
          <SectionDivider title="Investment Preferences" />

          <div>
            <FieldLabel>
              What matters most to you?{' '}
              <span style={{ textTransform: 'none', letterSpacing: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>(pick up to 2)</span>
            </FieldLabel>
            <MultiPills options={PRIORITIES_OPT} values={priorities} onToggle={(v) => toggleMulti(setPriorities, v, 2)} max={2} />
          </div>

          <div>
            <FieldLabel>How would you react if your portfolio dropped 20%?</FieldLabel>
            <SinglePills options={DROP_REACTION_OPT} value={dropReaction} onChange={setDropReaction} column />
          </div>

          <div>
            <FieldLabel>Are you interested in any of these themes?</FieldLabel>
            <MultiPills options={THEMES_OPT} values={themes} onToggle={(v) => toggleMulti(setThemes, v)} />
          </div>

          <div>
            <FieldLabel>How involved do you want to be?</FieldLabel>
            <SinglePills options={INVOLVEMENT_OPT} value={involvement} onChange={setInvolvement} column />
          </div>

          {/* ── Section 5 — Goals ── */}
          <SectionDivider title="Goals" />

          <div>
            <FieldLabel>What is this money for?</FieldLabel>
            <SinglePills options={PURPOSE_OPT} value={investmentPurpose} onChange={setInvestmentPurpose} column />
          </div>

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
                id="amount" type="text" inputMode="numeric" pattern="[0-9]*"
                value={amount}
                onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setAmtError(''); }}
                placeholder="5000"
                className="ticker-input"
                style={{ paddingLeft: 28, borderColor: amtError ? 'var(--accent-red)' : undefined, backgroundColor: 'var(--bg-input)' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--border-focus)'; }}
                onBlur={(e)  => { e.target.style.borderColor = amtError ? 'var(--accent-red)' : 'var(--border)'; }}
              />
            </div>
            {amtError && <p style={{ color: 'var(--accent-red)', fontSize: 11, marginTop: 6 }}>{amtError}</p>}
            {amountPreview && !amtError && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: "'DM Mono', monospace" }}>{amountPreview}</p>
            )}
          </div>

          <div>
            <FieldLabel>Hold Period</FieldLabel>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {[['short', '< 1 year'], ['medium', '1–5 years'], ['long', '5+ years']].map(([val, display]) => (
                <button type="button" key={val} className={`btn-toggle${holdPeriod === val ? ' active' : ''}`} onClick={() => setHoldPeriod(val)}>
                  {display}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>
              Sectors{' '}
              <span style={{ textTransform: 'none', letterSpacing: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>(optional)</span>
            </FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {SECTORS.map((s) => (
                <button type="button" key={s} className={`chip${sectors.includes(s) ? ' active' : ''}`} onClick={() => toggleMulti(setSectors, s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={disabled}
        className="btn-primary"
        style={{ opacity: disabled ? undefined : coreComplete ? 1 : 0.6 }}
      >
        {disabled ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            Analyzing...
          </span>
        ) : coreComplete ? 'Find My Stocks' : 'Complete your profile first'}
      </button>

    </form>
  );
}
