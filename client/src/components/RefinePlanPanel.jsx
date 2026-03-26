import { useState } from 'react';

function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid',
            borderColor: value === opt.value ? 'var(--accent-green)' : 'var(--border)',
            background: value === opt.value ? 'var(--accent-green-dim)' : 'var(--bg-input)',
            color: value === opt.value ? 'var(--accent-green-bright)' : 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: "'DM Mono', monospace",
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5, fontFamily: "'DM Mono', monospace" }}>
      {children}
    </div>
  );
}

function Subtitle({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: "'DM Mono', monospace", lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

function SectionHeading({ first, children }) {
  return (
    <div className="section-label" style={{ marginTop: first ? 0 : 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
      {children}
    </div>
  );
}

function DollarInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
        fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", pointerEvents: 'none',
      }}>$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder ?? '0'}
        style={{
          width: '100%', paddingLeft: 18, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
          fontSize: 11, fontFamily: "'DM Mono', monospace", boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function NumberInput({ value, onChange, min, max, placeholder }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '6px 8px',
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
        fontSize: 11, fontFamily: "'DM Mono', monospace", boxSizing: 'border-box',
      }}
    />
  );
}

export default function RefinePlanPanel({ inputs, onSubmit, disabled }) {
  const [isOpen, setIsOpen] = useState(false);

  // Family & Dependents
  const [numChildren, setNumChildren]               = useState('');
  const [childrenAges, setChildrenAges]             = useState('');
  const [monthlyDependentCosts, setMDC]             = useState('');
  const [supportingAgingParents, setSAP]            = useState(null);

  // Current Financial Picture
  const [totalSavings, setTotalSavings]             = useState('');
  const [liquidityFloor, setLiquidityFloor]         = useState('');
  const [monthlyTakeHome, setMonthlyTakeHome]       = useState('');
  const [monthlyExpenses, setMonthlyExpenses]       = useState('');

  // Retirement Specifics
  const [hasPension, setHasPension]                 = useState(null);
  const [expectedSocialSecurity, setESS]            = useState('');
  const [targetRetirementAge, setTargetRetirementAge] = useState('');

  const goalMode  = inputs?.goalMode || 'growing-wealth';
  const currentAge = inputs?.age ?? null;
  const isRetired  = goalMode === 'already-retired';
  const isNearRetirement = goalMode === 'approaching-retirement' || isRetired;

  const takeHome  = Number(monthlyTakeHome) || 0;
  const expenses  = Number(monthlyExpenses) || 0;
  const surplus   = takeHome - expenses;
  const showSurplus = monthlyTakeHome !== '' || monthlyExpenses !== '';

  const yearsToRetire = (targetRetirementAge !== '' && currentAge)
    ? Math.max(0, Number(targetRetirementAge) - Number(currentAge))
    : null;

  function handleRefine() {
    const refinedInputs = {
      ...inputs,
      numChildren:             numChildren !== '' ? Number(numChildren) : null,
      childrenAges:            childrenAges || null,
      monthlyDependentCosts:   monthlyDependentCosts !== '' ? Number(monthlyDependentCosts) : null,
      supportingAgingParents:  supportingAgingParents || null,
      totalSavings:            totalSavings !== '' ? Number(totalSavings) : null,
      liquidityFloor:          liquidityFloor !== '' ? Number(liquidityFloor) : null,
      monthlyTakeHome:         monthlyTakeHome !== '' ? Number(monthlyTakeHome) : null,
      monthlyExpenses:         monthlyExpenses !== '' ? Number(monthlyExpenses) : null,
      monthlySurplus:          showSurplus ? surplus : null,
      hasPension:              hasPension || null,
      expectedSocialSecurity:  expectedSocialSecurity !== '' ? Number(expectedSocialSecurity) : null,
      targetRetirementAge:     targetRetirementAge !== '' ? Number(targetRetirementAge) : null,
    };
    onSubmit(refinedInputs);
  }

  return (
    <div style={{ marginTop: 'var(--space-4)' }}>

      {/* Toggle button — only shown when closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            width: '100%', padding: '8px 14px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
            Refine for better results
          </span>
          <span style={{ fontSize: 11, color: 'var(--accent-green-bright)', fontFamily: "'DM Mono', monospace" }}>→</span>
        </button>
      )}

      {/* Collapsible body */}
      <div style={{
        overflow: 'hidden',
        maxHeight: isOpen ? '2400px' : '0',
        transition: 'max-height 0.35s ease',
      }}>
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}>

          {/* Panel header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Refine Your Plan</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: 13, cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
              }}
            >
              ✕
            </button>
          </div>

          {/* ── FAMILY & DEPENDENTS ─────────────────────── */}
          <SectionHeading first>Family &amp; Dependents</SectionHeading>

          <div>
            <FieldLabel>How many children do you have?</FieldLabel>
            <NumberInput value={numChildren} onChange={setNumChildren} min={0} max={10} placeholder="0" />
          </div>

          {Number(numChildren) > 0 && (
            <div>
              <FieldLabel>What are their ages?</FieldLabel>
              <input
                type="text"
                value={childrenAges}
                onChange={(e) => setChildrenAges(e.target.value)}
                placeholder="e.g. 8, 12, 16"
                style={{
                  width: '100%', padding: '6px 8px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  fontSize: 11, fontFamily: "'DM Mono', monospace", boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <div>
            <FieldLabel>Monthly amount given to dependents</FieldLabel>
            <DollarInput value={monthlyDependentCosts} onChange={setMDC} />
          </div>

          <div>
            <FieldLabel>Are you supporting aging parents?</FieldLabel>
            <PillGroup
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
              value={supportingAgingParents}
              onChange={setSAP}
            />
          </div>

          {/* ── CURRENT FINANCIAL PICTURE ───────────────── */}
          <SectionHeading>Current Financial Picture</SectionHeading>

          <div>
            <FieldLabel>Total across all your accounts today</FieldLabel>
            <DollarInput value={totalSavings} onChange={setTotalSavings} />
            <Subtitle>Savings, investments, 401k — rough estimate is fine</Subtitle>
          </div>

          <div>
            <FieldLabel>Minimum cash you always want available</FieldLabel>
            <DollarInput value={liquidityFloor} onChange={setLiquidityFloor} />
            <Subtitle>Money you'd never invest — your safety net</Subtitle>
          </div>

          <div>
            <FieldLabel>Monthly take-home income</FieldLabel>
            <DollarInput value={monthlyTakeHome} onChange={setMonthlyTakeHome} />
          </div>

          <div>
            <FieldLabel>Monthly essential expenses</FieldLabel>
            <DollarInput value={monthlyExpenses} onChange={setMonthlyExpenses} />
            <Subtitle>Rent, food, utilities, insurance</Subtitle>
            {showSurplus && (
              <div style={{
                marginTop: 6, fontSize: 11, fontFamily: "'DM Mono', monospace",
                color: surplus >= 0 ? 'var(--accent-green-bright)' : 'var(--accent-red)',
              }}>
                Monthly investable surplus: {surplus < 0 ? '-' : ''}${Math.abs(surplus).toLocaleString()}
                {surplus < 0 && ' (deficit)'}
              </div>
            )}
          </div>

          {/* ── RETIREMENT SPECIFICS ────────────────────── */}
          <SectionHeading>Retirement Specifics</SectionHeading>

          <div>
            <FieldLabel>Do you have a pension?</FieldLabel>
            <PillGroup
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
                { value: 'not-sure', label: 'Not sure' },
              ]}
              value={hasPension}
              onChange={setHasPension}
            />
          </div>

          {isNearRetirement && (
            <div>
              <FieldLabel>Expected Social Security income per month</FieldLabel>
              <DollarInput value={expectedSocialSecurity} onChange={setESS} />
              <Subtitle>Optional — check ssa.gov for your estimate</Subtitle>
            </div>
          )}

          {!isRetired && (
            <div>
              <FieldLabel>At what age do you want to retire?</FieldLabel>
              <NumberInput value={targetRetirementAge} onChange={setTargetRetirementAge} min={18} max={100} placeholder="65" />
              {yearsToRetire !== null && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                  That&apos;s {yearsToRetire} year{yearsToRetire !== 1 ? 's' : ''} away
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleRefine}
            disabled={disabled}
            style={{
              marginTop: 'var(--space-2)',
              padding: '10px 16px',
              background: disabled ? 'var(--bg-input)' : 'var(--accent-green)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: disabled ? 'var(--text-muted)' : '#000',
              fontSize: 12,
              fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Mono', monospace",
              width: '100%',
            }}
          >
            Refine My Plan →
          </button>

        </div>
      </div>
    </div>
  );
}
