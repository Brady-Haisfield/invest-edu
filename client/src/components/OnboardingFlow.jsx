import { useState } from 'react';

const TOTAL_STEPS = 9;

const STEP_META = [
  { question: 'How old are you?',              subtitle: 'This helps us understand your time horizon and risk capacity.' },
  { question: "What's your main goal right now?", subtitle: "We'll build your suggestions around this." },
  { question: 'How much are you looking to invest?', subtitle: "We'll use this to calculate projections and match position sizes." },
  { question: 'How comfortable are you with risk?', subtitle: "There's no right answer — honest beats optimistic here." },
  { question: "What's your income range?",     subtitle: 'This helps us understand what asset classes fit your situation.' },
  { question: 'Which account are you investing in?', subtitle: 'This affects which types of investments make the most sense for your tax situation.' },
  { question: 'What is your family situation?', subtitle: 'Your life situation affects what types of investments make sense.' },
  { question: 'Any major expenses coming up?',  subtitle: "We'll weight suggestions to keep money accessible if you need it soon." },
  { question: 'What sectors interest you?',     subtitle: 'Let us know if you want exposure to specific industries, or skip to use all sectors.' },
];

const GOAL_OPTIONS = [
  { value: 'just-starting',          label: 'Just starting out' },
  { value: 'growing-wealth',         label: 'Growing my wealth' },
  { value: 'approaching-retirement', label: 'Approaching retirement' },
  { value: 'already-retired',        label: 'Already retired' },
];

const RISK_OPTIONS = [
  { value: 'low',    label: 'Low — I want to protect what I have' },
  { value: 'medium', label: 'Medium — Some ups and downs are fine' },
  { value: 'high',   label: 'High — I can handle big swings' },
];

const INCOME_OPTIONS = [
  'Under $30,000', '$30,000 – $60,000', '$60,000 – $100,000',
  '$100,000 – $200,000', '$200,000 – $500,000', '$500,000+',
];

const FAMILY_OPTIONS = [
  'Single, no dependents', 'Married, no dependents', 'Married with children',
  'Single parent', 'Supporting aging parents', 'Empty nester',
];

const EXPENSE_OPTIONS = [
  'Buying a home', 'College tuition', 'Starting a business',
  'Wedding', 'Medical expenses', 'None planned',
];

const ACCOUNT_OPTIONS = [
  'Taxable brokerage',
  'Roth IRA',
  'Traditional IRA',
  '401(k) / employer plan',
  'Not sure yet',
];

const SECTOR_OPTIONS = [
  'Technology', 'Healthcare', 'Finance', 'Energy',
  'Consumer', 'Utilities', 'Real Estate', 'Industrials', 'Materials', 'No preference',
];

export default function OnboardingFlow({ onSubmit, disabled, onShowFullForm, defaultValues, submitLabel }) {
  const dv = defaultValues ?? {};

  const [step, setStep]       = useState(0);
  const [visible, setVisible] = useState(true);
  const [error, setError]     = useState('');

  // Answers — initialized from defaultValues when provided
  const [age, setAge]                     = useState(dv.age != null ? String(dv.age) : '');
  const [goalMode, setGoalMode]           = useState(dv.goalMode ?? 'growing-wealth');
  const [amount, setAmount]               = useState(dv.amount != null ? String(dv.amount) : '');
  const [riskProfile, setRiskProfile]     = useState(dv.riskProfile ?? 'medium');
  const [annualIncome, setAnnualIncome]   = useState(dv.annualIncome ?? '');
  const [accountTypes, setAccountTypes]   = useState(dv.accountTypes ?? []);
  const [familySituation, setFamilySituation] = useState(dv.familySituation ?? '');
  const [upcomingExpenses, setUpcomingExpenses] = useState(dv.upcomingExpenses ?? []);
  const [sectors, setSectors]             = useState(dv.sectors ?? []);

  function goTo(nextStep) {
    setVisible(false);
    setError('');
    setTimeout(() => {
      setStep(nextStep);
      setVisible(true);
    }, 150);
  }

  function validateStep() {
    if (step === 0) {
      const n = Number(age);
      if (!age || !Number.isFinite(n) || n <= 0 || n > 120) {
        setError('Please enter a valid age.');
        return false;
      }
    }
    if (step === 2) {
      const n = Number(amount);
      if (!amount || !Number.isFinite(n) || n <= 0) {
        setError('Please enter a positive dollar amount.');
        return false;
      }
    }
    return true;
  }

  function handleContinue() {
    if (!validateStep()) return;
    if (step === TOTAL_STEPS - 1) {
      const cleanSectors = sectors.filter((s) => s !== 'No preference');
      const holdPeriod = (goalMode === 'approaching-retirement' || goalMode === 'already-retired') ? 'medium' : 'long';
      onSubmit({
        age: Number(age) || null,
        goalMode,
        amount: Number(amount),
        riskProfile,
        annualIncome,
        accountTypes,
        familySituation,
        upcomingExpenses,
        sectors: cleanSectors,
        holdPeriod,
        // Uncaptured fields — validators handles empty values gracefully
        employmentStatus: '', emergencyFund: '', existingInvestments: [],
        homeownership: '', priorities: [], dropReaction: '',
        themes: [], involvement: '', investmentPurpose: '',
      });
    } else {
      goTo(step + 1);
    }
  }

  function toggleExpense(val) {
    setUpcomingExpenses((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  }

  function toggleSector(val) {
    if (val === 'No preference') {
      setSectors((prev) => prev.includes('No preference') ? [] : ['No preference']);
    } else {
      setSectors((prev) => {
        const withoutNone = prev.filter((x) => x !== 'No preference');
        return withoutNone.includes(val)
          ? withoutNone.filter((x) => x !== val)
          : [...withoutNone, val];
      });
    }
  }

  function renderStepContent() {
    switch (step) {
      case 0:
        return (
          <>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={age}
              onChange={(e) => { setAge(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="e.g. 42"
              className="ticker-input"
              style={{ backgroundColor: 'var(--bg-input)', fontSize: 16 }}
              onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
              autoFocus
            />
            {error && <p style={{ color: 'var(--accent-red)', fontSize: 11, marginTop: 6 }}>{error}</p>}
          </>
        );

      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {GOAL_OPTIONS.map(({ value, label }) => (
              <button
                type="button" key={value}
                className={`chip${goalMode === value ? ' active' : ''}`}
                style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
                onClick={() => setGoalMode(value)}
              >{label}</button>
            ))}
          </div>
        );

      case 2:
        return (
          <>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: 16, pointerEvents: 'none',
                fontFamily: "'DM Mono', monospace",
              }}>$</span>
              <input
                type="text" inputMode="numeric"
                value={amount}
                onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="5000"
                className="ticker-input"
                style={{ paddingLeft: 30, backgroundColor: 'var(--bg-input)', fontSize: 16 }}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                autoFocus
              />
            </div>
            {error && <p style={{ color: 'var(--accent-red)', fontSize: 11, marginTop: 6 }}>{error}</p>}
            {amount && Number(amount) > 0 && !error && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
                ${Number(amount).toLocaleString()} to invest
              </p>
            )}
          </>
        );

      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {RISK_OPTIONS.map(({ value, label }) => (
              <button
                type="button" key={value}
                className={`chip${riskProfile === value ? ' active' : ''}`}
                style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
                onClick={() => setRiskProfile(value)}
              >{label}</button>
            ))}
          </div>
        );

      case 4:
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {INCOME_OPTIONS.map((opt) => (
              <button
                type="button" key={opt}
                className={`chip${annualIncome === opt ? ' active' : ''}`}
                onClick={() => setAnnualIncome(annualIncome === opt ? '' : opt)}
              >{opt}</button>
            ))}
          </div>
        );

      case 5:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {ACCOUNT_OPTIONS.map((opt) => (
              <button
                type="button" key={opt}
                className={`chip${accountTypes.includes(opt) ? ' active' : ''}`}
                style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
                onClick={() => setAccountTypes((prev) =>
                  prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
                )}
              >{opt}</button>
            ))}
          </div>
        );

      case 6:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {FAMILY_OPTIONS.map((opt) => (
              <button
                type="button" key={opt}
                className={`chip${familySituation === opt ? ' active' : ''}`}
                style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
                onClick={() => setFamilySituation(familySituation === opt ? '' : opt)}
              >{opt}</button>
            ))}
          </div>
        );

      case 7:
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {EXPENSE_OPTIONS.map((opt) => (
              <button
                type="button" key={opt}
                className={`chip${upcomingExpenses.includes(opt) ? ' active' : ''}`}
                onClick={() => toggleExpense(opt)}
              >{opt}</button>
            ))}
          </div>
        );

      case 8:
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {SECTOR_OPTIONS.map((opt) => (
              <button
                type="button" key={opt}
                className={`chip${sectors.includes(opt) ? ' active' : ''}`}
                onClick={() => toggleSector(opt)}
              >{opt}</button>
            ))}
          </div>
        );

      default:
        return null;
    }
  }

  const { question, subtitle } = STEP_META[step];
  const isLast = step === TOTAL_STEPS - 1;
  const pct    = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="section-label">Step {step + 1} of {TOTAL_STEPS}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
            {Math.round(pct)}% complete
          </span>
        </div>
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-green)', borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Animated step content */}
      <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.15s ease', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Question */}
        <div>
          <h3 style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 18, fontWeight: 400, lineHeight: 1.35,
            marginBottom: 'var(--space-2)', color: 'var(--text-primary)',
          }}>
            {question}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            {subtitle}
          </p>
        </div>

        {/* Input / pills */}
        {renderStepContent()}

        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingTop: 'var(--space-1)' }}>
          <button
            type="button"
            onClick={handleContinue}
            disabled={disabled}
            className="btn-primary"
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
            ) : isLast ? (submitLabel ?? 'Find My Plan →') : 'Continue →'}
          </button>

          {step > 0 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              ← Back
            </button>
          )}
        </div>

        {/* Skip to full form — only on step 0 and when the callback is provided */}
        {step === 0 && onShowFullForm && (
          <button
            type="button"
            onClick={onShowFullForm}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
              textDecoration: 'underline', textAlign: 'left',
            }}
          >
            Skip to full form
          </button>
        )}
      </div>
    </div>
  );
}
