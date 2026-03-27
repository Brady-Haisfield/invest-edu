import { useState } from 'react';
import StockCard from './StockCard.jsx';
import AllocationBuilder from './AllocationBuilder.jsx';
import { calcProjection } from '../utils/projections.js';
import { savePlan } from '../services/auth.js';

const BUCKETS = [
  {
    label: 'Stability & Income',
    description: 'Bonds, dividends, capital preservation',
    roles: ['income-oriented holding', 'capital-preservation option', 'defensive sector exposure'],
  },
  {
    label: 'Balanced Growth',
    description: 'Index funds, blue-chip stocks',
    roles: ['core growth holding', 'broad market exposure'],
  },
  {
    label: 'Real Estate Income',
    description: 'REITs, property-linked income',
    roles: ['real estate income exposure'],
  },
  {
    label: 'Inflation-Sensitive',
    description: 'Commodities, energy, inflation hedges',
    roles: ['inflation-sensitive exposure'],
  },
];

const HOLD_LABELS = { short: '< 1 year hold', medium: '1–5 year hold', long: '5+ year hold' };
const HOLD_YEARS  = { short: 2, medium: 5, long: 10 };

function calcEqualProjection(card, inputs, treasuryRates) {
  if (!inputs?.amount || !inputs?.holdPeriod) return null;
  const n = 5; // always 5 cards
  const amount = Math.floor(inputs.amount / n);
  const holdYears = HOLD_YEARS[inputs.holdPeriod] ?? 10;
  const conservative = inputs.goalMode === 'approaching-retirement' || inputs.goalMode === 'already-retired';
  const result = calcProjection({ ...card, _allocatedAmount: amount }, holdYears, conservative, treasuryRates);
  return { amount, projected: result.baseValue, income: result.annualIncome, holdYears };
}

const INCOME_MIDPOINTS = {
  'Under $30,000': 25000,
  '$30,000 – $60,000': 45000,
  '$60,000 – $100,000': 80000,
  '$100,000 – $200,000': 150000,
  '$200,000 – $500,000': 350000,
  '$500,000+': 600000,
};

const GOAL_MODE_LABELS = {
  'just-starting': 'just starting out',
  'growing-wealth': 'wealth-building',
  'approaching-retirement': 'pre-retirement',
  'already-retired': 'retired',
};

function calcRiskCapacity(inputs) {
  let score = 50;
  if (inputs.emergencyFund === 'Yes') score += 15;
  else if (inputs.emergencyFund === 'No') score -= 20;

  const majorExpenses = ['Buying a home', 'College tuition', 'Medical expenses'];
  const hasMajor = (inputs.upcomingExpenses ?? []).some((e) => majorExpenses.includes(e));
  if (hasMajor) score -= 15;
  else score += 10;

  const emp = inputs.employmentStatus ?? '';
  if (emp === 'Employed' || emp === 'Self-Employed') score += 10;
  else if (emp === 'Retired' || emp === 'Between Jobs') score -= 10;

  const existing = inputs.existingInvestments ?? [];
  score += Math.min(existing.length * 10, 20);

  const age = inputs.age;
  if (age) {
    if (age < 40) score += 15;
    else if (age < 55) score += 5;
    else if (age < 65) score -= 5;
    else score -= 15;
  }

  const incomeMid = INCOME_MIDPOINTS[inputs.annualIncome];
  if (incomeMid >= 100000) score += 10;
  else if (incomeMid && incomeMid <= 25000) score -= 10;

  return score;
}

function getRiskCapacityLevel(score) {
  if (score >= 65) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

function WealthSnapshot({ inputs }) {
  if (!inputs) return null;

  const amount = inputs.amount || 0;
  const incomeMid = INCOME_MIDPOINTS[inputs.annualIncome] || null;
  let assetsContext = '';
  if (incomeMid) {
    if (amount > incomeMid * 3) assetsContext = 'Significant relative to income — preservation matters';
    else if (amount >= incomeMid) assetsContext = 'Healthy foundation to build from';
    else assetsContext = 'Early stage — growth focus makes sense';
  }

  const age = inputs.age;
  let retirementValue = '—';
  let retirementNote = '';
  if (inputs.goalMode === 'already-retired') {
    retirementValue = '—';
    retirementNote = 'In retirement now';
  } else {
    const years = age ? Math.max(0, 67 - age) : null;
    if (years !== null) {
      retirementValue = `~${years} yrs`;
      if (inputs.goalMode === 'approaching-retirement') {
        retirementNote = 'Preservation window is narrow';
      } else if (years > 20) {
        retirementNote = 'Time is your biggest asset';
      } else if (years >= 10) {
        retirementNote = 'Time to start being intentional';
      } else {
        retirementNote = 'Transition planning recommended';
      }
    }
  }

  const capacityScore = calcRiskCapacity(inputs);
  const capacityLevel = getRiskCapacityLevel(capacityScore);
  const capacityNotes = {
    High:     'Your financial situation can absorb investment losses well',
    Moderate: 'Some cushion exists but protect against major downturns',
    Low:      'Limit exposure to volatile assets — losses would be hard to recover',
  };
  const capacityColors = {
    High:     'var(--accent-green-bright)',
    Moderate: 'var(--accent-amber)',
    Low:      'var(--accent-red)',
  };

  const goalLabel = GOAL_MODE_LABELS[inputs.goalMode] || inputs.goalMode;
  const isRetiring = inputs.goalMode === 'approaching-retirement' || inputs.goalMode === 'already-retired';
  let prioritySentence;
  if (isRetiring && capacityLevel !== 'High') {
    prioritySentence = 'Your priority should be income generation and capital preservation.';
  } else if (isRetiring) {
    prioritySentence = 'You have room to maintain some growth exposure alongside income.';
  } else if (inputs.goalMode === 'growing-wealth') {
    prioritySentence = 'A balanced mix of growth and income suits your stage well.';
  } else {
    prioritySentence = 'Long-term growth should be your primary focus right now.';
  }
  const agePart = age ? `${age}-year-old ` : '';
  const summary = `Based on your profile, you're a ${agePart}${goalLabel} investor with ${capacityLevel.toLowerCase()} risk capacity and ${inputs.riskProfile || 'medium'} risk tolerance. ${prioritySentence}`;

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
          Your Wealth Snapshot
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        {/* Investable Assets */}
        <div style={{ padding: 'var(--space-4)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Investable Assets</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
            ${amount.toLocaleString()}
          </div>
          {assetsContext && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{assetsContext}</div>}
        </div>

        {/* Years to Retirement */}
        <div style={{ padding: 'var(--space-4)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Years to Retirement</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)', marginBottom: 4 }}>
            {retirementValue}
          </div>
          {retirementNote && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{retirementNote}</div>}
        </div>

        {/* Risk Capacity — spans full width */}
        <div style={{ gridColumn: '1 / -1', padding: 'var(--space-4)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Risk Capacity</div>
          <div style={{ marginBottom: 6 }}>
            <span style={{
              display: 'inline-block', padding: '2px 12px', borderRadius: 999,
              fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace",
              background: `color-mix(in srgb, ${capacityColors[capacityLevel]} 15%, transparent)`,
              color: capacityColors[capacityLevel],
              border: `1px solid color-mix(in srgb, ${capacityColors[capacityLevel]} 40%, transparent)`,
            }}>
              {capacityLevel}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{capacityNotes[capacityLevel]}</div>
        </div>
      </div>

      {/* Summary sentence */}
      <div style={{
        padding: 'var(--space-4)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent-green)',
        borderRadius: 'var(--radius)',
      }}>
        <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Your Situation</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{summary}</p>
      </div>
    </div>
  );
}

function buildProfileSummary(inputs) {
  if (!inputs) return null;
  const risk    = inputs.riskProfile ? inputs.riskProfile.charAt(0).toUpperCase() + inputs.riskProfile.slice(1) + ' risk' : null;
  const hold    = HOLD_LABELS[inputs.holdPeriod] || null;
  const amount  = inputs.amount ? `$${Number(inputs.amount).toLocaleString()}` : null;
  const sectors = inputs.sectors?.length ? inputs.sectors.join(', ') : null;
  return [risk, hold, amount, sectors].filter(Boolean).join(' · ');
}

function buildRedFlags(inputs) {
  if (!inputs) return [];
  const flags = [];

  if (inputs.emergencyFund === 'No') {
    flags.push({
      kind: 'warning',
      text: "You don't have an emergency fund yet. Consider building 3–6 months of expenses in cash before investing — so you don't have to sell investments at a loss if something comes up.",
    });
  }

  const expenses = inputs.upcomingExpenses ?? [];
  if (expenses.includes('College tuition') && inputs.holdPeriod === 'short') {
    flags.push({
      kind: 'warning',
      text: "You have college tuition coming up and a short hold period. Stocks can be volatile in under a year — make sure any money needed soon stays liquid and isn't tied up in the market.",
    });
  }

  if (expenses.includes('Buying a home')) {
    flags.push({
      kind: 'warning',
      text: "You're planning to buy a home. Down payment money is usually needed within 1–3 years — keep it in a high-yield savings account or short-term bonds, not in stocks.",
    });
  }

  const age = Number(inputs.age);
  if (age >= 60 && inputs.riskProfile === 'high') {
    flags.push({
      kind: 'warning',
      text: 'You are 60 or older and selected high risk. A major market drop close to or during retirement can be hard to recover from — most advisors recommend shifting toward more stable, income-producing assets at this stage.',
    });
  }

  const existing = inputs.existingInvestments ?? [];
  const income = inputs.annualIncome ?? '';
  const highIncome = ['$75k–$100k', '$100k–$150k', '$150k+'].includes(income);
  if (!existing.includes('401(k) or IRA') && highIncome) {
    flags.push({
      kind: 'tip',
      text: "You haven't mentioned a 401(k) or IRA. At your income level, maxing out tax-advantaged accounts first can save thousands in taxes each year — often a better first move than a taxable brokerage account.",
    });
  }

  if (inputs.goalMode === 'already-retired' && inputs.riskProfile !== 'low') {
    flags.push({
      kind: 'warning',
      text: "You're already retired but selected a medium or high risk profile. Early retirement withdrawals during a market downturn can permanently reduce your portfolio — a conservative, income-focused approach tends to hold up better.",
    });
  }

  return flags;
}

function RedFlagsPanel({ inputs }) {
  const flags = buildRedFlags(inputs);
  if (flags.length === 0) return null;

  return (
    <div style={{
      marginBottom: 'var(--space-5)',
      padding: 'var(--space-4)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
          Things to consider first
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {flags.map((f, i) => (
          <div
            key={i}
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius)',
              background: f.kind === 'warning' ? 'rgba(248,113,113,0.05)' : 'rgba(251,191,36,0.05)',
              border: `1px solid ${f.kind === 'warning' ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)'}`,
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{f.kind === 'warning' ? '⚠️' : '💡'}</span>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StockGrid({ cards, inputs, advisorNarrative, treasuryRates, user, token, onSignInClick }) {
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaved, setPlanSaved]   = useState(false);

  async function handleSavePlan() {
    if (!token) return;
    setSavingPlan(true);
    try {
      const planName = `Plan — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      await savePlan(token, { planName, inputs, cards, advisorNarrative: advisorNarrative ?? null });
      setPlanSaved(true);
      setTimeout(() => setPlanSaved(false), 2000);
    } catch {
      // non-critical
    } finally {
      setSavingPlan(false);
    }
  }
  const buckets = BUCKETS.map((b) => ({
    ...b,
    count: cards.filter((c) => c.portfolioRole && b.roles.includes(c.portfolioRole)).length,
  }));

  const profileSummary = buildProfileSummary(inputs);

  return (
    <div>
      {/* Wealth snapshot */}
      <WealthSnapshot inputs={inputs} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <p className="section-label" style={{ margin: 0 }}>
          {cards.length} educational suggestion{cards.length !== 1 ? 's' : ''}
        </p>
        {profileSummary && (
          <p className="section-label" style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {profileSummary}
          </p>
        )}
      </div>

      {/* Allocation framework */}
      <div style={{
        padding: 'var(--space-4)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-5)',
      }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
            Allocation framework
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          {buckets.map((b) => {
            const active = b.count > 0;
            return (
              <div
                key={b.label}
                style={{
                  padding: 'var(--space-3)', borderRadius: 'var(--radius)',
                  border: `1px solid ${active ? 'var(--accent-green)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-green-dim)' : 'var(--bg)',
                  boxShadow: active ? '0 0 14px rgba(74, 158, 106, 0.18)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: active ? 'var(--accent-green-bright)' : 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                  {active ? `${b.count}×` : '—'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 3, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {b.label}
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.4, color: active ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                  {b.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {cards.map((card) => (
          <StockCard key={card.ticker} card={card} equalProjection={calcEqualProjection(card, inputs, treasuryRates)} />
        ))}
      </div>

      {/* Red flags / things to consider */}
      <RedFlagsPanel inputs={inputs} />

      {/* Advisor narrative panel */}
      {advisorNarrative && (
        <div style={{
          marginTop: 'var(--space-5)',
          padding: 'var(--space-5)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent-green)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          gap: 'var(--space-4)',
          alignItems: 'flex-start',
        }}>
          {/* Avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
            color: 'var(--accent-green-bright)', marginTop: 2,
          }}>AI</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="section-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
              Your Advisor's Take
            </span>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 var(--space-3)' }}>
              {advisorNarrative}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, fontFamily: "'DM Mono', monospace" }}>
              Based on your complete profile · Educational only · Not financial advice
            </p>
          </div>
        </div>
      )}

      {/* Save plan */}
      {inputs?.amount > 0 && (
        <div style={{ marginTop: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {user ? (
            <button
              type="button"
              onClick={handleSavePlan}
              disabled={savingPlan || planSaved}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: `1px solid ${planSaved ? 'var(--accent-green)' : 'var(--border-2)'}`,
                borderRadius: 'var(--radius)',
                color: planSaved ? 'var(--accent-green-bright)' : 'var(--text-secondary)',
                fontSize: 11, cursor: savingPlan || planSaved ? 'default' : 'pointer',
                fontFamily: "'DM Mono', monospace",
                transition: 'border-color 0.2s, color 0.2s',
              }}
            >
              {planSaved ? 'Plan saved!' : savingPlan ? 'Saving...' : 'Save This Plan'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignInClick}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace",
                padding: 0, textDecoration: 'underline',
              }}
            >
              Sign in to save this plan
            </button>
          )}
        </div>
      )}

      {/* Allocation builder */}
      {inputs?.amount > 0 && (
        <AllocationBuilder cards={cards} inputs={inputs} treasuryRates={treasuryRates} />
      )}
    </div>
  );
}
