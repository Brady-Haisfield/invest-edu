import StockCard from './StockCard.jsx';

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

function buildProfileSummary(inputs) {
  if (!inputs) return null;
  const risk = inputs.riskProfile
    ? inputs.riskProfile.charAt(0).toUpperCase() + inputs.riskProfile.slice(1) + ' risk'
    : null;
  const hold = HOLD_LABELS[inputs.holdPeriod] || null;
  const amount = inputs.amount ? `$${Number(inputs.amount).toLocaleString()}` : null;
  const sectors = inputs.sectors?.length ? inputs.sectors.join(', ') : null;
  return [risk, hold, amount, sectors].filter(Boolean).join(' · ');
}

export default function StockGrid({ cards, inputs }) {
  const buckets = BUCKETS.map((b) => ({
    ...b,
    count: cards.filter((c) => c.portfolioRole && b.roles.includes(c.portfolioRole)).length,
  }));

  const profileSummary = buildProfileSummary(inputs);

  return (
    <div>
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
          <span style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace",
          }}>Allocation framework</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 'var(--space-3)',
        }}>
          {buckets.map((b) => {
            const active = b.count > 0;
            return (
              <div
                key={b.label}
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${active ? 'var(--accent-green)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-green-dim)' : 'var(--bg)',
                  boxShadow: active ? '0 0 14px rgba(74, 158, 106, 0.18)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  fontSize: 11, fontWeight: 700, marginBottom: 4,
                  color: active ? 'var(--accent-green-bright)' : 'var(--text-muted)',
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {active ? `${b.count}×` : '—'}
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 3,
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  {b.label}
                </div>
                <div style={{
                  fontSize: 10, lineHeight: 1.4,
                  color: active ? 'var(--text-secondary)' : 'var(--text-muted)',
                }}>
                  {b.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {cards.map((card) => (
          <StockCard key={card.ticker} card={card} />
        ))}
      </div>
    </div>
  );
}
