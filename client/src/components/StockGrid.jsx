import StockCard from './StockCard.jsx';

export default function StockGrid({ cards }) {
  return (
    <div>
      <p className="section-label" style={{ marginBottom: 'var(--space-4)' }}>
        {cards.length} educational suggestion{cards.length !== 1 ? 's' : ''}
      </p>
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
