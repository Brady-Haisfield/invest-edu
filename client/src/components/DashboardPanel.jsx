import { useState } from 'react';

const GOAL_LABELS = {
  'just-starting':          'Just Starting Out',
  'growing-wealth':         'Growing Wealth',
  'approaching-retirement': 'Approaching Retirement',
  'already-retired':        'Already Retired',
};

const RISK_LABELS = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };

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

function PctInput({ value, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="0"
        style={{
          width: '100%', paddingLeft: 8, paddingRight: 22, paddingTop: 5, paddingBottom: 5,
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
          fontSize: 11, fontFamily: "'DM Mono', monospace", boxSizing: 'border-box',
        }}
      />
      <span style={{
        position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
        fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", pointerEvents: 'none',
      }}>%</span>
    </div>
  );
}

export default function DashboardPanel({
  profileInputs,
  refineInputs,
  onRefineChange,
  onUpdatePlan,
  disabled,
  onEditProfile,
}) {
  const [refineOpen, setRefineOpen] = useState(() => {
    try { return localStorage.getItem('meridian_refine_open') === 'true'; }
    catch { return false; }
  });
  const [updateConfirmed, setUpdateConfirmed] = useState(false);

  const p = profileInputs ?? {};
  const r = refineInputs;

  const goalMode   = p.goalMode ?? 'growing-wealth';
  const isRetired  = goalMode === 'already-retired';
  const isNearRet  = goalMode === 'approaching-retirement' || isRetired;
  const currentAge = p.age ? Number(p.age) : null;
  const showSocialSecurity = isNearRet || (currentAge != null && currentAge > 50);

  const takeHome    = Number(r.monthlyTakeHome) || 0;
  const pension     = (r.hasPension === 'yes') ? (Number(r.pensionAmount) || 0) : 0;
  const ss          = Number(r.expectedSocialSecurity) || 0;
  const expenses    = Number(r.monthlyExpenses) || 0;
  const debt        = Number(r.monthlyDebt) || 0;
  const surplus     = takeHome + pension + ss - expenses - debt;
  const showSurplus = r.monthlyTakeHome !== '' || r.monthlyExpenses !== '' || (r.hasPension === 'yes' && r.pensionAmount !== '') || r.expectedSocialSecurity !== '';

  const yearsToRetire = (r.targetRetirementAge !== '' && currentAge)
    ? Math.max(0, Number(r.targetRetirementAge) - currentAge)
    : null;

  const ALLOC_KEYS = ['allocStocks', 'allocBonds', 'allocCash', 'allocRealEstate'];
  const allocAnyFilled = ALLOC_KEYS.some((k) => r[k] !== '');
  const allocSum = ALLOC_KEYS.reduce((s, k) => s + (Number(r[k]) || 0), 0);
  const allocInvalid = allocAnyFilled && allocSum !== 100;

  function field(key, value) {
    onRefineChange({ [key]: value });
  }

  function toggleRefine() {
    const next = !refineOpen;
    setRefineOpen(next);
    try { localStorage.setItem('meridian_refine_open', String(next)); } catch {}
  }

  function handleUpdateClick() {
    if (!onUpdatePlan || disabled) return;
    onUpdatePlan(() => {
      setUpdateConfirmed(true);
      setTimeout(() => setUpdateConfirmed(false), 2000);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* Profile summary card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
      }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <span className="section-label">Your Profile</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{
            display: 'inline-flex', alignSelf: 'flex-start',
            background: 'var(--accent-green-dim)', borderRadius: 'var(--radius)',
            padding: '3px 8px',
            fontSize: 10, fontFamily: "'DM Mono', monospace", color: 'var(--accent-green-bright)',
          }}>
            {GOAL_LABELS[goalMode] ?? goalMode}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {p.age && (
              <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)' }}>
                Age {p.age}
              </span>
            )}
            {p.riskProfile && (
              <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)' }}>
                · {RISK_LABELS[p.riskProfile] ?? p.riskProfile}
              </span>
            )}
            {p.amount && (
              <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)' }}>
                · ${Number(p.amount).toLocaleString()}
              </span>
            )}
          </div>

          {p.sectors?.length > 0 && (
            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: 'var(--text-muted)' }}>
              {p.sectors.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Refine panel */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* Collapsible header */}
        <button
          type="button"
          onClick={toggleRefine}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'var(--space-4)',
            background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span className="section-label" style={{ margin: 0 }}>Refine Your Results</span>
          <span style={{
            display: 'inline-block',
            transform: refineOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            fontSize: 9, color: 'var(--text-muted)',
          }}>▶</span>
        </button>

        {refineOpen && (
          <div style={{
            padding: '0 var(--space-4) var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}>

            {/* ── FAMILY & DEPENDENTS ─────────────── */}
            <SectionHeading first>Family &amp; Dependents</SectionHeading>

            <div>
              <FieldLabel>Children</FieldLabel>
              <NumberInput
                value={r.numChildren}
                onChange={(v) => field('numChildren', v)}
                min={0} max={10} placeholder="0"
              />
            </div>

            {Number(r.numChildren) > 0 && (
              <div>
                <FieldLabel>Their ages</FieldLabel>
                <input
                  type="text"
                  value={r.childrenAges}
                  onChange={(e) => field('childrenAges', e.target.value)}
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
              <FieldLabel>Monthly given to dependents</FieldLabel>
              <DollarInput
                value={r.monthlyDependentCosts}
                onChange={(v) => field('monthlyDependentCosts', v)}
              />
            </div>

            <div>
              <FieldLabel>Supporting aging parents?</FieldLabel>
              <PillGroup
                options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
                value={r.supportingAgingParents}
                onChange={(v) => field('supportingAgingParents', v)}
              />
            </div>

            {/* ── FINANCIAL PICTURE ───────────────── */}
            <SectionHeading>Financial Picture</SectionHeading>

            <div>
              <FieldLabel>Total across all accounts</FieldLabel>
              <DollarInput
                value={r.totalSavings}
                onChange={(v) => field('totalSavings', v)}
              />
              <Subtitle>Savings, investments, 401k — rough estimate is fine</Subtitle>
            </div>

            <div>
              <FieldLabel>Minimum cash to always keep</FieldLabel>
              <DollarInput
                value={r.liquidityFloor}
                onChange={(v) => field('liquidityFloor', v)}
              />
              <Subtitle>Money you&apos;d never invest — your safety net</Subtitle>
            </div>

            <div>
              <FieldLabel>Monthly take-home income</FieldLabel>
              <DollarInput
                value={r.monthlyTakeHome}
                onChange={(v) => field('monthlyTakeHome', v)}
              />
            </div>

            <div>
              <FieldLabel>Monthly essential expenses</FieldLabel>
              <DollarInput
                value={r.monthlyExpenses}
                onChange={(v) => field('monthlyExpenses', v)}
              />
              <Subtitle>Rent, food, utilities, insurance</Subtitle>
              {showSurplus && (
                <div style={{
                  marginTop: 6, fontSize: 11, fontFamily: "'DM Mono', monospace",
                  color: surplus >= 0 ? 'var(--accent-green-bright)' : 'var(--accent-red)',
                }}>
                  Surplus: {surplus < 0 ? '-' : ''}${Math.abs(surplus).toLocaleString()}/mo
                  {surplus < 0 && ' (deficit)'}
                </div>
              )}
            </div>

            {/* ── INCOME & DEBT ────────────────────── */}
            <SectionHeading>Income &amp; Debt</SectionHeading>

            <div>
              <FieldLabel>Monthly debt payments</FieldLabel>
              <DollarInput
                value={r.monthlyDebt}
                onChange={(v) => field('monthlyDebt', v)}
              />
              <Subtitle>Student loans, car payments, credit cards — combined minimum monthly payments</Subtitle>
            </div>

            <div>
              <FieldLabel>Do you own your home?</FieldLabel>
              <PillGroup
                options={[
                  { value: 'renting',      label: 'Renting' },
                  { value: 'own-outright', label: 'Own outright' },
                  { value: 'mortgage',     label: 'Paying a mortgage' },
                  { value: 'na',           label: 'Living with family / N/A' },
                ]}
                value={r.homeownership}
                onChange={(v) => field('homeownership', v)}
              />
            </div>

            <div>
              <FieldLabel>Investment experience</FieldLabel>
              <PillGroup
                options={[
                  { value: 'new',         label: 'New to investing' },
                  { value: 'some',        label: 'Some experience' },
                  { value: 'experienced', label: 'Experienced investor' },
                ]}
                value={r.investmentExperience}
                onChange={(v) => field('investmentExperience', v)}
              />
              <Subtitle>Affects how complex our suggestions get</Subtitle>
            </div>

            {/* ── RETIREMENT ──────────────────────── */}
            <SectionHeading>Retirement</SectionHeading>

            <div>
              <FieldLabel>Do you have a pension?</FieldLabel>
              <PillGroup
                options={[
                  { value: 'yes',      label: 'Yes' },
                  { value: 'no',       label: 'No' },
                  { value: 'not-sure', label: 'Not sure' },
                ]}
                value={r.hasPension}
                onChange={(v) => {
                  if (v !== 'yes') {
                    onRefineChange({ hasPension: v, pensionAmount: '' });
                  } else {
                    field('hasPension', v);
                  }
                }}
              />
            </div>

            {r.hasPension === 'yes' && (
              <div>
                <FieldLabel>Estimated monthly pension income</FieldLabel>
                <DollarInput
                  value={r.pensionAmount}
                  onChange={(v) => field('pensionAmount', v)}
                />
                <Subtitle>What you expect to receive per month at retirement</Subtitle>
              </div>
            )}

            {showSocialSecurity && (
              <div>
                <FieldLabel>Expected Social Security / mo</FieldLabel>
                <DollarInput
                  value={r.expectedSocialSecurity}
                  onChange={(v) => field('expectedSocialSecurity', v)}
                />
                <Subtitle>Optional — check ssa.gov for your estimate. Leave blank if unsure.</Subtitle>
              </div>
            )}

            {!isRetired && (
              <div>
                <FieldLabel>Target retirement age</FieldLabel>
                <NumberInput
                  value={r.targetRetirementAge}
                  onChange={(v) => field('targetRetirementAge', v)}
                  min={18} max={100} placeholder="65"
                />
                {yearsToRetire !== null && (
                  <Subtitle>{yearsToRetire} year{yearsToRetire !== 1 ? 's' : ''} away</Subtitle>
                )}
              </div>
            )}

            {/* ── EXISTING PORTFOLIO ───────────────── */}
            <SectionHeading>Existing Portfolio</SectionHeading>

            <div>
              <FieldLabel>How is your current savings allocated?</FieldLabel>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, fontFamily: "'DM Mono', monospace", lineHeight: 1.4 }}>
                Rough estimate is fine
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {[
                  { key: 'allocStocks',      label: 'Stocks / ETFs' },
                  { key: 'allocBonds',       label: 'Bonds / fixed income' },
                  { key: 'allocCash',        label: 'Cash / savings' },
                  { key: 'allocRealEstate',  label: 'Real estate / other' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                      {label}
                    </span>
                    <div style={{ width: 70, flexShrink: 0 }}>
                      <PctInput value={r[key]} onChange={(v) => field(key, v)} />
                    </div>
                  </div>
                ))}
              </div>
              {allocAnyFilled && (
                <div style={{
                  marginTop: 6, fontSize: 10, fontFamily: "'DM Mono', monospace",
                  color: allocInvalid ? 'var(--accent-amber)' : 'var(--accent-green-bright)',
                }}>
                  {allocInvalid ? `Total: ${allocSum}% — must add up to 100%` : 'Total: 100% ✓'}
                </div>
              )}
            </div>

            {/* ── UPDATE BUTTON ────────────────────── */}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={handleUpdateClick}
                disabled={disabled}
                style={{
                  width: '100%', padding: '10px 16px',
                  background: updateConfirmed
                    ? 'var(--accent-green-dim)'
                    : disabled
                      ? 'var(--accent-green-dim)'
                      : 'var(--accent-green)',
                  border: '1px solid var(--accent-green)',
                  borderRadius: 'var(--radius)',
                  color: (disabled || updateConfirmed) ? 'var(--accent-green-bright)' : '#000',
                  fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace",
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                {disabled ? (
                  <>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10,
                      border: '1.5px solid var(--accent-green)',
                      borderTop: '1.5px solid var(--accent-green-bright)',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                    Updating...
                  </>
                ) : updateConfirmed ? (
                  'Plan updated ✓'
                ) : (
                  'Update My Plan →'
                )}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
