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

export default function DashboardPanel({
  profileInputs,
  refineInputs,
  onRefineChange,
  isAutoUpdating,
  disabled,
  onEditProfile,
}) {
  const p = profileInputs ?? {};
  const r = refineInputs;

  const goalMode   = p.goalMode ?? 'growing-wealth';
  const isRetired  = goalMode === 'already-retired';
  const isNearRet  = goalMode === 'approaching-retirement' || isRetired;
  const currentAge = p.age ?? null;

  const takeHome   = Number(r.monthlyTakeHome) || 0;
  const expenses   = Number(r.monthlyExpenses) || 0;
  const surplus    = takeHome - expenses;
  const showSurplus = r.monthlyTakeHome !== '' || r.monthlyExpenses !== '';

  const yearsToRetire = (r.targetRetirementAge !== '' && currentAge)
    ? Math.max(0, Number(r.targetRetirementAge) - Number(currentAge))
    : null;

  function field(key, value) {
    onRefineChange({ [key]: value });
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
          <span className="section-label">Your Profile</span>
          <button
            type="button"
            onClick={onEditProfile}
            style={{
              background: 'none', border: 'none', padding: '2px 0',
              color: 'var(--accent-green-bright)', fontSize: 11,
              fontFamily: "'DM Mono', monospace", cursor: 'pointer',
            }}
          >
            Edit →
          </button>
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

      {/* Refine fields */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="section-label">Refine Your Results</span>
          {isAutoUpdating && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8,
                border: '1.5px solid var(--border)', borderTop: '1.5px solid var(--accent-green)',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              updating
            </span>
          )}
        </div>

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

        {/* ── RETIREMENT ──────────────────────── */}
        <SectionHeading>Retirement</SectionHeading>

        <div>
          <FieldLabel>Pension?</FieldLabel>
          <PillGroup
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'not-sure', label: 'Not sure' },
            ]}
            value={r.hasPension}
            onChange={(v) => field('hasPension', v)}
          />
        </div>

        {isNearRet && (
          <div>
            <FieldLabel>Expected Social Security / mo</FieldLabel>
            <DollarInput
              value={r.expectedSocialSecurity}
              onChange={(v) => field('expectedSocialSecurity', v)}
            />
            <Subtitle>Optional — check ssa.gov for your estimate</Subtitle>
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

      </div>
    </div>
  );
}
