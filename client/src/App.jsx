import { useState } from 'react';
import { fetchSuggestions } from './api/suggestions.js';
import DisclaimerBanner from './components/DisclaimerBanner.jsx';
import InputForm from './components/InputForm.jsx';
import StockGrid from './components/StockGrid.jsx';
import LoadingState from './components/LoadingState.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';

export default function App() {
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(formData) {
    setLoading(true);
    setError(null);
    setCards(null);
    try {
      const result = await fetchSuggestions(formData);
      setCards(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem 1.5rem',
      maxWidth: 1100,
      margin: '0 auto',
    }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          marginBottom: '4px',
        }}>
          <span style={{ color: 'var(--accent-blue)' }}>Invest</span>Edu
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Learn about investing by exploring stocks matched to your profile
        </p>
      </header>

      <DisclaimerBanner />

      {/* Layout: form on left, results on right (or stacked on mobile) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cards || loading ? '320px 1fr' : '400px',
        gap: '2rem',
        alignItems: 'start',
      }}>
        {/* Form column */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Your Profile
          </h2>
          <InputForm onSubmit={handleSubmit} disabled={loading} />
        </div>

        {/* Results column */}
        {(loading || error || cards) && (
          <div>
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
            {loading && <LoadingState />}
            {cards && !loading && <StockGrid cards={cards} />}
          </div>
        )}
      </div>
    </div>
  );
}
