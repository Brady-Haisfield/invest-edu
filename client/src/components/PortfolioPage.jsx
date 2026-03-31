import { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { getHoldings, deleteHolding, getQuotes } from '../services/auth.js';
import AddInvestmentModal from './AddInvestmentModal.jsx';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

// 5-minute client-side quote cache for "From Your Plan" section
const planQuoteCache = new Map(); // ticker → { currentPrice, dayChangePct, fetchedAt }

function fmtMoney(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDelta(n) {
  if (n == null) return '—';
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n >= 0 ? '+$' : '-$') + abs;
}

function fmtPct(n) {
  if (n == null) return '';
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function fmtRelativeTime(date, now) {
  if (!date) return '';
  const secs = Math.round((now - date) / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs} seconds ago`;
  const mins = Math.round(secs / 60);
  return `${mins} minute${mins === 1 ? '' : 's'} ago`;
}

function SummaryBox({ label, value, sub, valueColor }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 'var(--space-4)',
    }}>
      <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: valueColor ?? 'var(--text-primary)', fontFamily: "'DM Mono', monospace", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function PortfolioPage({ token, suggestionCards, onPortfolioChange }) {
  const [holdings, setHoldings]       = useState(null); // null = loading
  const [showModal, setShowModal]     = useState(false);
  const [modalCard, setModalCard]     = useState(null);  // pre-filled from suggestion card
  const [editHolding, setEditHolding] = useState(null);  // existing holding being edited
  const [deletingId, setDeletingId]   = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [now, setNow]                 = useState(new Date());
  const [planQuotes, setPlanQuotes]   = useState({});
  const chartRef      = useRef(null);
  const chartInstance = useRef(null);

  const loadHoldings = useCallback(async () => {
    try {
      const data = await getHoldings(token);
      setHoldings(data.holdings);
      setLastRefreshed(new Date());
      onPortfolioChange?.(new Set(data.holdings.map((h) => h.ticker)));
    } catch {
      setHoldings([]);
    }
  }, [token, onPortfolioChange]);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  // Auto-refresh prices every 60 seconds
  useEffect(() => {
    const id = setInterval(loadHoldings, 60000);
    return () => clearInterval(id);
  }, [loadHoldings]);

  // Update clock every 5 seconds for relative timestamp display
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  // Return % bar chart — rebuild whenever holdings change
  useEffect(() => {
    if (!chartRef.current || !holdings) return;

    const withReturns = holdings.filter((h) => h.gainLossPct != null);
    if (withReturns.length === 0) return;

    const existing = Chart.getChart(chartRef.current);
    if (existing) existing.destroy();

    const BREAKEVEN = 0.01; // treat |pct| < 0.01 as zero
    const labels   = withReturns.map((h) => h.ticker);
    const rawData  = withReturns.map((h) => h.gainLossPct);
    // Replace near-zero with a tiny positive so the bar stays visible
    const dispData = rawData.map((v) => Math.abs(v) < BREAKEVEN ? 0.1 : v);

    const bgColors = rawData.map((v) =>
      Math.abs(v) < BREAKEVEN ? 'rgba(150,150,160,0.4)' :
      (v >= 0 ? 'rgba(74,158,106,0.55)' : 'rgba(239,68,68,0.4)')
    );
    const bdColors = rawData.map((v) =>
      Math.abs(v) < BREAKEVEN ? 'rgba(150,150,160,0.75)' :
      (v >= 0 ? 'rgba(74,158,106,0.9)' : 'rgba(239,68,68,0.8)')
    );

    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Return %',
          data: dispData,
          backgroundColor: bgColors,
          borderColor: bdColors,
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const actual = rawData[ctx.dataIndex];
                if (Math.abs(actual) < BREAKEVEN) return 'Return: 0.00% (breakeven)';
                return (actual >= 0 ? '+' : '') + actual.toFixed(2) + '%';
              },
            },
            bodyFont: { family: "'DM Mono', monospace", size: 11 },
            titleFont: { family: "'DM Mono', monospace", size: 11 },
          },
        },
        scales: {
          x: {
            ticks: { color: '#888', font: { family: "'DM Mono', monospace", size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            min: Math.min(0, ...dispData),
            ticks: {
              color: '#888',
              font: { family: "'DM Mono', monospace", size: 10 },
              callback: (v) => v + '%',
            },
            grid: {
              // Emphasise the zero baseline; use a lighter color for all other lines
              color: (ctx) => ctx.tick.value === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)',
              lineWidth: (ctx) => ctx.tick.value === 0 ? 1.5 : 1,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    };
  }, [holdings]);

  // Fetch live quotes for "From Your Plan" tickers (5-min client-side cache)
  useEffect(() => {
    if (!holdings || !suggestionCards?.length) return;
    const portfolioSet = new Set(holdings.map((h) => h.ticker));
    const tickers = suggestionCards
      .filter((c) => !portfolioSet.has(c.ticker))
      .map((c) => c.ticker);
    if (tickers.length === 0) return;

    const CACHE_TTL = 5 * 60 * 1000;
    const stale = tickers.filter((t) => {
      const cached = planQuoteCache.get(t);
      return !cached || Date.now() - cached.fetchedAt > CACHE_TTL;
    });

    // Populate state from cache immediately for any already-cached tickers
    const fromCache = {};
    tickers.forEach((t) => {
      const cached = planQuoteCache.get(t);
      if (cached) fromCache[t] = cached;
    });
    if (Object.keys(fromCache).length > 0) setPlanQuotes((prev) => ({ ...prev, ...fromCache }));

    // Fetch only stale tickers (or all on first load when cache is empty)
    if (stale.length === 0) return;
    getQuotes(token, stale)
      .then((data) => {
        const updates = {};
        Object.entries(data.quotes ?? {}).forEach(([ticker, q]) => {
          const entry = { ...q, fetchedAt: Date.now() };
          planQuoteCache.set(ticker, entry);
          updates[ticker] = entry;
        });
        setPlanQuotes((prev) => ({ ...prev, ...updates }));
      })
      .catch(() => {});
  }, [holdings, suggestionCards, token]);

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await deleteHolding(token, id);
      await loadHoldings();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  function openNewModal(card) {
    setEditHolding(null);
    setModalCard(card ?? null);
    setShowModal(true);
  }

  function openEditModal(holding) {
    setModalCard(null);
    setEditHolding(holding);
    setShowModal(true);
  }

  function handleModalClose() {
    setShowModal(false);
    setModalCard(null);
    setEditHolding(null);
  }

  function handleAddSuccess() {
    handleModalClose();
    loadHoldings();
  }

  // Derived stats
  const totalInvested    = holdings?.reduce((s, h) => s + h.amountInvested, 0) ?? 0;
  const totalCurrent     = holdings?.reduce((s, h) => s + (h.currentValue ?? h.amountInvested), 0) ?? 0;
  const totalGainLoss    = totalCurrent - totalInvested;
  const totalGainLossPct = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : null;
  const totalDayChange   = holdings?.reduce((s, h) => s + (h.dayChange ?? 0), 0) ?? 0;

  const portfolioTickerSet = new Set(holdings?.map((h) => h.ticker) ?? []);
  const notInPortfolio     = (suggestionCards ?? []).filter((c) => !portfolioTickerSet.has(c.ticker));
  const hasNullValue       = holdings?.some((h) => h.currentValue == null) ?? false;

  // Loading
  if (!holdings) {
    return (
      <div style={{ padding: 'var(--space-8)', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
        Loading portfolio…
      </div>
    );
  }

  const modalProps = editHolding
    ? {
        token,
        editId:              editHolding.id,
        initialTicker:       editHolding.ticker,
        initialName:         editHolding.name,
        initialSecurityType: editHolding.securityType,
        initialAmount:       editHolding.amountInvested,
        initialPurchasePrice:  editHolding.purchasePrice,
        initialPurchaseMonth:  editHolding.purchaseMonth,
        initialPurchaseYear:   editHolding.purchaseYear,
        initialAccountType:    editHolding.accountType,
        onSuccess: handleAddSuccess,
        onClose:   handleModalClose,
      }
    : {
        token,
        initialTicker:       modalCard?.ticker,
        initialName:         modalCard?.name,
        initialSecurityType: modalCard?.type,
        onSuccess: handleAddSuccess,
        onClose:   handleModalClose,
      };

  // Empty state
  if (holdings.length === 0) {
    return (
      <>
        {showModal && <AddInvestmentModal {...modalProps} />}

        <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-5)', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: 'var(--accent-green-bright)',
          }}>+</div>

          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 26, fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
            Track your investments
          </h2>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 380, lineHeight: 1.6, margin: 0 }}>
            Log what you own and see how it's performing in real time. Your portfolio is private and only visible to you.
          </p>

          <button type="button" className="btn-primary" onClick={() => openNewModal(null)} style={{ width: 'auto', padding: '10px 28px' }}>
            Add Your First Investment
          </button>

          {notInPortfolio.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)', width: '100%', maxWidth: 480, textAlign: 'left' }}>
              <p className="section-label" style={{ marginBottom: 'var(--space-3)' }}>From Your Plan</p>
              {notInPortfolio.map((c) => (
                <div key={c.ticker} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="ticker-badge" style={{ fontSize: 11 }}>{c.ticker}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openNewModal(c)}
                    style={{
                      fontSize: 11, color: 'var(--accent-green-bright)',
                      fontFamily: "'DM Mono', monospace", background: 'none',
                      border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px', cursor: 'pointer',
                    }}
                  >Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  const withReturns = holdings.filter((h) => h.gainLossPct != null);

  // Main portfolio view
  return (
    <>
      {showModal && <AddInvestmentModal {...modalProps} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', paddingBottom: 80 }}>

        {/* Summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
          <SummaryBox label="Total Invested"  value={fmtMoney(totalInvested)} />
          <SummaryBox label="Current Value"   value={fmtMoney(totalCurrent)} />
          <SummaryBox
            label="Total Return"
            value={fmtDelta(totalGainLoss)}
            sub={fmtPct(totalGainLossPct)}
            valueColor={totalGainLoss >= 0 ? 'var(--accent-green-bright)' : 'var(--accent-red)'}
          />
          <SummaryBox
            label="Today's Change"
            value={fmtDelta(totalDayChange || null)}
            valueColor={totalDayChange >= 0 ? 'var(--accent-green-bright)' : 'var(--accent-red)'}
          />
        </div>

        {/* Return % Chart — only rendered when at least one holding has return data */}
        {withReturns.length === 0 ? (
          <div style={{
            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
          }}>
            <span style={{ color: 'var(--accent-amber)', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
              ⚠ Add purchase prices to your holdings using the edit button to see your return chart.
            </span>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
          }}>
            <p className="section-label" style={{ marginBottom: 'var(--space-4)' }}>Return % by Holding</p>
            <div style={{ height: 200 }}>
              <canvas ref={chartRef} />
            </div>
          </div>
        )}

        {/* Holdings table */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--border)',
          }}>
            <p className="section-label">Holdings ({holdings.length})</p>
            <button
              type="button"
              onClick={() => openNewModal(null)}
              style={{
                fontSize: 11, fontFamily: "'DM Mono', monospace",
                color: 'var(--accent-green-bright)',
                background: 'var(--accent-green-dim)',
                border: '1px solid var(--accent-green)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 12px', cursor: 'pointer',
              }}
            >+ Add</button>
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr 100px 110px 130px 90px 36px 36px',
            gap: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-5)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Ticker', 'Name', 'Invested', 'Value', 'Return', 'Today', '', ''].map((h, i) => (
              <span key={i} className="section-label" style={{ fontSize: 9 }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {holdings.map((h) => (
            <div
              key={h.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr 100px 110px 130px 90px 36px 36px',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-5)',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span className="ticker-badge" style={{ fontSize: 10 }}>{h.ticker}</span>

              <span style={{
                fontSize: 12, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{h.name ?? '—'}</span>

              <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)' }}>
                {fmtMoney(h.amountInvested)}
              </span>

              <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)' }}>
                {h.currentValue != null ? fmtMoney(h.currentValue) : <span style={{ color: 'var(--text-muted)' }}>—*</span>}
              </span>

              <span style={{
                fontSize: 11, fontFamily: "'DM Mono', monospace",
                color: h.gainLoss == null
                  ? 'var(--text-muted)'
                  : h.gainLoss >= 0 ? 'var(--accent-green-bright)' : 'var(--accent-red)',
              }}>
                {h.gainLoss == null ? '—' : `${fmtDelta(h.gainLoss)} (${fmtPct(h.gainLossPct)})`}
              </span>

              <span style={{
                fontSize: 11, fontFamily: "'DM Mono', monospace",
                color: h.dayChange == null
                  ? 'var(--text-muted)'
                  : h.dayChange >= 0 ? 'var(--accent-green-bright)' : 'var(--accent-red)',
              }}>
                {fmtDelta(h.dayChange)}
              </span>

              {/* Edit button */}
              <button
                type="button"
                onClick={() => openEditModal(h)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  padding: 0, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-blue)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="Edit"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleDelete(h.id)}
                disabled={deletingId === h.id}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  fontSize: 16, padding: 0, lineHeight: 1,
                  opacity: deletingId === h.id ? 0.4 : 1,
                  transition: 'opacity 0.1s',
                }}
                onMouseEnter={(e) => { if (deletingId !== h.id) e.currentTarget.style.color = 'var(--accent-red)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="Remove"
              >×</button>
            </div>
          ))}

          {/* Footnote + last updated */}
          <div style={{ padding: 'var(--space-3) var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {hasNullValue ? (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                * Current value unavailable — add a purchase price to enable return tracking.
              </span>
            ) : <span />}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
              {lastRefreshed ? `Last updated ${fmtRelativeTime(lastRefreshed, now)}` : ''}
            </span>
          </div>
        </div>

        {/* From Your Plan */}
        {notInPortfolio.length > 0 && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
          }}>
            <p className="section-label" style={{ marginBottom: 'var(--space-3)' }}>
              From Your Plan — Not Yet Tracked
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {notInPortfolio.map((c) => {
                const q = planQuotes[c.ticker];
                return (
                  <div key={c.ticker} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="ticker-badge" style={{ fontSize: 10 }}>{c.ticker}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      {q?.currentPrice != null && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)' }}>
                            ${q.currentPrice.toFixed(2)}
                          </div>
                          {q.dayChangePct != null && (
                            <div style={{
                              fontSize: 10, fontFamily: "'DM Mono', monospace",
                              color: q.dayChangePct >= 0 ? 'var(--accent-green-bright)' : 'var(--accent-red)',
                            }}>
                              {q.dayChangePct >= 0 ? '+' : ''}{q.dayChangePct.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => openNewModal(c)}
                        style={{
                          fontSize: 11, fontFamily: "'DM Mono', monospace",
                          color: 'var(--accent-green-bright)', background: 'none',
                          border: '1px solid var(--accent-green)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 10px', cursor: 'pointer',
                        }}
                      >Add to Portfolio</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => openNewModal(null)}
        style={{
          position: 'fixed', bottom: 32, right: 32, zIndex: 50,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent-green)', color: '#fff',
          fontSize: 26, fontWeight: 300,
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(74,158,106,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(74,158,106,0.55)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(74,158,106,0.4)'; }}
        title="Add investment"
      >+</button>
    </>
  );
}
