import StockCard from './StockCard.jsx';

export default function StockGrid({ cards }) {
  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Showing {cards.length} educational suggestion{cards.length !== 1 ? 's' : ''}
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {cards.map((card) => (
          <StockCard key={card.ticker} card={card} />
        ))}
      </div>
    </div>
  );
}
