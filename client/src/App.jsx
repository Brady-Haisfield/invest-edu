import { useState } from 'react';
import { fetchSuggestions } from './api/suggestions.js';
import { fetchForecast } from './api/forecast.js';
import DisclaimerBanner from './components/DisclaimerBanner.jsx';
import Nav from './components/Nav.jsx';
import InputForm from './components/InputForm.jsx';
import StockGrid from './components/StockGrid.jsx';
import LoadingState from './components/LoadingState.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import ForecastForm from './components/ForecastForm.jsx';
import ForecastResult from './components/ForecastResult.jsx';
import ForecastLoadingState from './components/ForecastLoadingState.jsx';
import ForecastChart from './components/ForecastChart.jsx';

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');

  // Home page state
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Forecast page state
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);
  const [forecastTicker, setForecastTicker] = useState('');
  const [forecastCompanyName, setForecastCompanyName] = useState('');
  const [forecastQuote, setForecastQuote] = useState(null);
  const [forecastStockPE, setForecastStockPE] = useState(null);
  const [forecastSectorPE, setForecastSectorPE] = useState(null);

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

  async function handleForecast(ticker) {
    setForecastLoading(true);
    setForecastError(null);
    setForecast(null);
    setForecastStockPE(null);
    setForecastSectorPE(null);
    try {
      const result = await fetchForecast(ticker);
      setForecast(result.forecast);
      setForecastTicker(result.ticker);
      setForecastCompanyName(result.companyName);
      setForecastQuote(result.quote ?? null);
      setForecastStockPE(result.stockPE ?? null);
      setForecastSectorPE(result.sectorAvgPE ?? null);
    } catch (err) {
      setForecastError(err.message);
    } finally {
      setForecastLoading(false);
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
      <header style={{ marginBottom: '1.5rem' }}>
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

      <Nav currentPage={currentPage} onNavigate={setCurrentPage} />

      <DisclaimerBanner />

      {/* Home Page */}
      {currentPage === 'home' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: cards || loading ? '320px 1fr' : '400px',
          gap: '2rem',
          alignItems: 'start',
        }}>
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

          {(loading || error || cards) && (
            <div>
              {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
              {loading && <LoadingState />}
              {cards && !loading && <StockGrid cards={cards} />}
            </div>
          )}
        </div>
      )}

      {/* Forecast Page */}
      {currentPage === 'forecast' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: forecastLoading || forecast ? '320px 1fr' : '400px',
          gap: '2rem',
          alignItems: 'start',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Stock Forecast
            </h2>
            <ForecastForm onSubmit={handleForecast} disabled={forecastLoading} />
            {forecast && forecastQuote && forecast.bull?.priceTargetRange && forecast.bear?.downsideScenario && (
              <ForecastChart
                currentPrice={forecastQuote.price}
                bullMid={Math.round((forecast.bull.priceTargetRange.low + forecast.bull.priceTargetRange.high) / 2)}
                bearMid={Math.round((forecast.bear.downsideScenario.low + forecast.bear.downsideScenario.high) / 2)}
              />
            )}
          </div>

          {(forecastLoading || forecastError || forecast) && (
            <div>
              {forecastError && <ErrorBanner message={forecastError} onDismiss={() => setForecastError(null)} />}
              {forecastLoading && <ForecastLoadingState />}
              {forecast && !forecastLoading && (
                <ForecastResult
                  forecast={forecast}
                  ticker={forecastTicker}
                  companyName={forecastCompanyName}
                  quote={forecastQuote}
                  stockPE={forecastStockPE}
                  sectorAvgPE={forecastSectorPE}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
