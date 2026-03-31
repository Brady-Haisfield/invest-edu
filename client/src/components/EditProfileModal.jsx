import { useState } from 'react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const GOAL_OPTIONS = [
  { value: 'just-starting',          label: 'Just starting out' },
  { value: 'growing-wealth',         label: 'Growing my wealth' },
  { value: 'approaching-retirement', label: 'Approaching retirement' },
  { value: 'already-retired',        label: 'Already retired' },
];

const RISK_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
];

const HOLD_OPTIONS = [
  { value: 'short',  label: 'Short (< 1 yr)' },
  { value: 'medium', label: 'Medium (1–5 yr)' },
  { value: 'long',   label: 'Long (5+ yr)' },
];

const ACCOUNT_OPTIONS = [
  'Taxable brokerage', 'Roth IRA', 'Traditional IRA',
  '401(k) / employer plan', 'Not sure yet',
];

function SectionHeader({ children }) {
  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      paddingTop: 'var(--space-4)',
      marginTop: 'var(--space-2)',
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace",
      marginBottom: 'var(--space-3)',
    }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
      color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace",
      marginBottom: 'var(--space-2)',
    }}>
      {children}
    </div>
  );
}

export default function EditProfileModal({ profileInputs, onSave, onClose }) {
  const p = profileInputs ?? {};

  const [firstName,    setFirstName]    = useState(p.firstName ?? '');
  const [birthDay,     setBirthDay]     = useState(p.dateOfBirth?.day   ? String(p.dateOfBirth.day)   : '');
  const [birthMonth,   setBirthMonth]   = useState(p.dateOfBirth?.month ? String(p.dateOfBirth.month) : '');
  const [birthYear,    setBirthYear]    = useState(p.dateOfBirth?.year  ? String(p.dateOfBirth.year)  : '');
  const [goalMode,     setGoalMode]     = useState(p.goalMode    ?? 'growing-wealth');
  const [riskProfile,  setRiskProfile]  = useState(p.riskProfile ?? 'medium');
  const [amount,       setAmount]       = useState(p.amount != null ? String(p.amount) : '');
  const [holdPeriod,   setHoldPeriod]   = useState(p.holdPeriod  ?? 'long');
  const [accountTypes, setAccountTypes] = useState(p.accountTypes ?? []);
  const [retirementAge, setRetirementAge] = useState(
    p.targetRetirementAge != null ? String(p.targetRetirementAge) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  function toggleAccount(opt) {
    setAccountTypes(prev =>
      prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
    );
  }

  async function handleSave() {
    if (saving || saved) return;
    setSaving(true);
    const newInputs = {
      ...p,
      firstName: firstName.trim() || null,
      dateOfBirth: (birthDay && birthMonth && birthYear)
        ? { day: Number(birthDay), month: Number(birthMonth), year: Number(birthYear) }
        : (p.dateOfBirth ?? null),
      goalMode,
      riskProfile,
      amount: Number(amount) || p.amount || 0,
      holdPeriod,
      accountTypes,
      targetRetirementAge: retirementAge ? Number(retirementAge) : null,
    };
    await onSave(newInputs);
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 2000);
  }

  // Escape key
  // (handled by overlay click — keep simple)

  const selectBase = { backgroundColor: 'var(--bg-input)', fontSize: 13 };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 'var(--space-5)', overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)',
        marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h3 style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 20, fontWeight: 400, color: 'var(--text-primary)', margin: 0,
          }}>
            Edit Profile
          </h3>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

          {/* ── PERSONAL INFO ─────────────────────────────────── */}
          <SectionHeader>Personal Info</SectionHeader>

          {/* First name */}
          <div>
            <FieldLabel>First Name</FieldLabel>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Optional"
              className="ticker-input"
              style={{ width: '100%', backgroundColor: 'var(--bg-input)', fontSize: 13 }}
            />
          </div>

          {/* Date of birth */}
          <div>
            <FieldLabel>Date of Birth</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={birthDay}
                onChange={e => setBirthDay(e.target.value)}
                className="ticker-input"
                style={{ ...selectBase, width: 78, flexShrink: 0 }}
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={birthMonth}
                onChange={e => setBirthMonth(e.target.value)}
                className="ticker-input"
                style={{ ...selectBase, flex: 1 }}
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                className="ticker-input"
                style={{ ...selectBase, width: 88, flexShrink: 0 }}
              >
                <option value="">Year</option>
                {Array.from({ length: 2010 - 1924 + 1 }, (_, i) => 2010 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── INVESTMENT PROFILE ────────────────────────────── */}
          <SectionHeader>Investment Profile</SectionHeader>

          {/* Goal mode */}
          <div>
            <FieldLabel>Goal</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              {GOAL_OPTIONS.map(({ value, label }) => (
                <button
                  key={value} type="button"
                  className={`chip${goalMode === value ? ' active' : ''}`}
                  style={{ fontSize: 11, padding: '8px 10px', textAlign: 'left' }}
                  onClick={() => setGoalMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Risk tolerance */}
          <div>
            <FieldLabel>Risk Tolerance</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
              {RISK_OPTIONS.map(({ value, label }) => (
                <button
                  key={value} type="button"
                  className={`chip${riskProfile === value ? ' active' : ''}`}
                  style={{ fontSize: 12, textAlign: 'center' }}
                  onClick={() => setRiskProfile(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <FieldLabel>Investment Amount</FieldLabel>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none',
                fontFamily: "'DM Mono', monospace",
              }}>$</span>
              <input
                type="text" inputMode="numeric"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="5000"
                className="ticker-input"
                style={{ paddingLeft: 26, backgroundColor: 'var(--bg-input)', fontSize: 13, width: '100%' }}
              />
            </div>
          </div>

          {/* Hold period */}
          <div>
            <FieldLabel>Hold Period</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
              {HOLD_OPTIONS.map(({ value, label }) => (
                <button
                  key={value} type="button"
                  className={`chip${holdPeriod === value ? ' active' : ''}`}
                  style={{ fontSize: 11, textAlign: 'center', padding: '8px 6px' }}
                  onClick={() => setHoldPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Account types */}
          <div>
            <FieldLabel>Account Type</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              {ACCOUNT_OPTIONS.map(opt => (
                <button
                  key={opt} type="button"
                  className={`chip${accountTypes.includes(opt) ? ' active' : ''}`}
                  style={{ fontSize: 11, padding: '8px 10px', textAlign: 'left' }}
                  onClick={() => toggleAccount(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* ── RETIREMENT ────────────────────────────────────── */}
          <SectionHeader>Retirement</SectionHeader>

          <div>
            <FieldLabel>Target Retirement Age</FieldLabel>
            <input
              type="text" inputMode="numeric"
              value={retirementAge}
              onChange={e => setRetirementAge(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 65"
              className="ticker-input"
              style={{ width: '40%', backgroundColor: 'var(--bg-input)', fontSize: 13 }}
            />
          </div>

          {/* ── ACTIONS ───────────────────────────────────────── */}
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
          }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || saved}
              className="btn-primary"
              style={{
                flex: 1,
                background: saved ? 'var(--accent-green-dim)' : undefined,
                borderColor: saved ? 'var(--accent-green)' : undefined,
                color: saved ? 'var(--accent-green-bright)' : undefined,
              }}
            >
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Profile'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text-muted)',
                fontFamily: "'DM Mono', monospace", padding: '4px 0',
              }}
            >
              Cancel
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
