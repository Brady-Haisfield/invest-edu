import { useState, useRef } from 'react';
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
  const [forecastSearchTicker, setForecastSearchTicker] = useState('');
  const [forecastCompanyName, setForecastCompanyName] = useState('');
  const [forecastQuote, setForecastQuote] = useState(null);
  const [forecastStockPE, setForecastStockPE] = useState(null);
  const [forecastSectorPE, setForecastSectorPE] = useState(null);

  // Ref-based handshake: decouple loading animation from API response timing
  const pendingResultRef = useRef(null);
  const animReadyRef = useRef(false);

  function applyResult(result) {
    setForecast(result.forecast);
    setForecastTicker(result.ticker);
    setForecastCompanyName(result.companyName);
    setForecastQuote(result.quote ?? null);
    setForecastStockPE(result.stockPE ?? null);
    setForecastSectorPE(result.sectorAvgPE ?? null);
    setForecastLoading(false);
  }

  function handleAnimationReady() {
    animReadyRef.current = true;
    if (pendingResultRef.current) {
      applyResult(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }

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
    pendingResultRef.current = null;
    animReadyRef.current = false;
    setForecastSearchTicker(ticker);
    setForecastLoading(true);
    setForecastError(null);
    setForecast(null);
    setForecastStockPE(null);
    setForecastSectorPE(null);
    try {
      const result = await fetchForecast(ticker);
      if (animReadyRef.current) {
        applyResult(result);
      } else {
        pendingResultRef.current = result;
      }
    } catch (err) {
      setForecastError(err.message);
      setForecastLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <Nav currentPage={currentPage} onNavigate={setCurrentPage} />

      <DisclaimerBanner />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--space-6) var(--space-8)' }}>

        {/* Home Page */}
        {currentPage === 'home' && (
          <div className="layout-grid" style={{ gridTemplateColumns: '280px 1fr' }}>
            <div className="sidebar">
              <h2 className="section-label" style={{ marginBottom: 'var(--space-5)' }}>Your Profile</h2>
              <InputForm onSubmit={handleSubmit} disabled={loading} />
            </div>

            <div>
              {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
              {loading && <LoadingState />}
              {cards && !loading && <StockGrid cards={cards} />}
              {!loading && !error && !cards && (
                <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, lineHeight: 1.3, fontWeight: 400 }}>
                    Find stocks that fit you
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.6 }}>
                    Tell us your risk tolerance, how long you want to hold, and what sectors interest you. We'll match you with stocks that fit your profile — and explain why each one makes sense.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    {[
                      'Matched to your risk tolerance and timeline',
                      'Real market prices pulled live',
                      'Plain-English explanations — no jargon',
                    ].map((text) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', marginTop: 6, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Forecast Page */}
        {currentPage === 'forecast' && (
          <div className="layout-grid" style={{ gridTemplateColumns: '320px 1fr' }}>
            <div className="sidebar">
              <h2 className="section-label" style={{ marginBottom: 'var(--space-5)' }}>Stock Forecast</h2>
              <ForecastForm onSubmit={handleForecast} disabled={forecastLoading} />
              {forecast && forecastQuote && forecast.bull?.priceTargetRange && forecast.bear?.downsideScenario && (
                <div style={{ marginTop: 'var(--space-5)' }}>
                  <ForecastChart
                    currentPrice={forecastQuote.price}
                    bullMid={Math.round((forecast.bull.priceTargetRange.low + forecast.bull.priceTargetRange.high) / 2)}
                    bearMid={Math.round((forecast.bear.downsideScenario.low + forecast.bear.downsideScenario.high) / 2)}
                  />
                </div>
              )}
            </div>

            <div>
              {forecastError && <ErrorBanner message={forecastError} onDismiss={() => setForecastError(null)} />}
              {forecastLoading && <ForecastLoadingState ticker={forecastSearchTicker} onStep4Active={handleAnimationReady} />}
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
              {!forecastLoading && !forecastError && !forecast && (
                <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, lineHeight: 1.3, fontWeight: 400 }}>
                    Enter a ticker to build your forecast
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.6 }}>
                    We pull live market data, run two valuation models, and generate a plain-English bull and bear case — in about 15 seconds.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    {[
                      'Live market data from Finnhub — price, earnings, margins, and more',
                      'Two valuation models calculated before the AI sees anything',
                      "Historical analog scenarios from this stock's real past",
                    ].map((text) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', marginTop: 6, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
