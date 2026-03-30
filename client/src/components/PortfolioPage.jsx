import { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { getHoldings, deleteHolding } from '../services/auth.js';
import AddInvestmentModal from './AddInvestmentModal.jsx';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

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
  const [modalCard, setModalCard]     = useState(null); // pre-filled card
  const [deletingId, setDeletingId]   = useState(null);
  const chartRef      = useRef(null);
  const chartInstance = useRef(null);

  const loadHoldings = useCallback(async () => {
    try {
      const data = await getHoldings(token);
      setHoldings(data.holdings);
      onPortfolioChange?.(new Set(data.holdings.map((h) => h.ticker)));
    } catch {
      setHoldings([]);
    }
  }, [token, onPortfolioChange]);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  // Chart — rebuild whenever holdings change
  useEffect(() => {
    if (!chartRef.current || !holdings || holdings.length === 0) return;

    const existing = Chart.getChart(chartRef.current);
    if (existing) existing.destroy();

    const labels    = holdings.map((h) => h.ticker);
    const invested  = holdings.map((h) => h.amountInvested);
    const current   = holdings.map((h) => h.currentValue ?? h.amountInvested);
    const isGain    = holdings.map((h, i) => current[i] >= invested[i]);

    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Invested',
            data: invested,
            backgroundColor: 'rgba(120,120,140,0.35)',
            borderColor: 'rgba(120,120,140,0.6)',
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Current Value',
            data: current,
            backgroundColor: isGain.map((g) => g ? 'rgba(74,158,106,0.55)' : 'rgba(239,68,68,0.4)'),
            borderColor:     isGain.map((g) => g ? 'rgba(74,158,106,0.9)' : 'rgba(239,68,68,0.8)'),
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#888', font: { family: "'DM Mono', monospace", size: 10 }, padding: 16 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`,
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
            ticks: {
              color: '#888',
              font: { family: "'DM Mono', monospace", size: 10 },
              callback: (v) => '$' + Number(v).toLocaleString(),
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    };
  }, [holdings]);

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

  function openModal(card) {
    setModalCard(card ?? null);
    setShowModal(true);
  }

  function handleAddSuccess() {
    setShowModal(false);
    setModalCard(null);
    loadHoldings();
  }

  // Summary stats
  const totalInvested   = holdings?.reduce((s, h) => s + h.amountInvested, 0) ?? 0;
  const totalCurrent    = holdings?.reduce((s, h) => s + (h.currentValue ?? h.amountInvested), 0) ?? 0;
  const totalGainLoss   = totalCurrent - totalInvested;
  const totalGainLossPct = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : null;
  const totalDayChange  = holdings?.reduce((s, h) => s + (h.dayChange ?? 0), 0) ?? 0;

  // From Your Plan
  const portfolioTickerSet = new Set(holdings?.map((h) => h.ticker) ?? []);
  const notInPortfolio     = (suggestionCards ?? []).filter((c) => !portfolioTickerSet.has(c.ticker));

  // Loading
  if (!holdings) {
    return (
      <div style={{ padding: 'var(--space-8)', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
        Loading portfolio…
      </div>
    );
  }

  // Empty state
  if (holdings.length === 0) {
    return (
      <>
        {showModal && (
          <AddInvestmentModal
            token={token}
            initialTicker={modalCard?.ticker}
            initialName={modalCard?.name}
            initialSecurityType={modalCard?.type}
            onSuccess={handleAddSuccess}
            onClose={() => { setShowModal(false); setModalCard(null); }}
          />
        )}

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

          <button type="button" className="btn-primary" onClick={() => openModal(null)} style={{ width: 'auto', padding: '10px 28px' }}>
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
                    onClick={() => openModal(c)}
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

  // Main portfolio view
  return (
    <>
      {showModal && (
        <AddInvestmentModal
          token={token}
          initialTicker={modalCard?.ticker}
          initialName={modalCard?.name}
          initialSecurityType={modalCard?.type}
          onSuccess={handleAddSuccess}
          onClose={() => { setShowModal(false); setModalCard(null); }}
        />
      )}

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

        {/* Chart */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
        }}>
          <p className="section-label" style={{ marginBottom: 'var(--space-4)' }}>Portfolio Allocation</p>
          <div style={{ height: 240 }}>
            <canvas ref={chartRef} />
          </div>
        </div>

        {/* Holdings table */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          {/* Table header row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--border)',
          }}>
            <p className="section-label">Holdings ({holdings.length})</p>
            <button
              type="button"
              onClick={() => openModal(null)}
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
            gridTemplateColumns: '70px 1fr 100px 100px 130px 90px 36px',
            gap: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-5)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Ticker', 'Name', 'Invested', 'Value', 'Return', "Today", ''].map((h) => (
              <span key={h} className="section-label" style={{ fontSize: 9 }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {holdings.map((h) => (
            <div
              key={h.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr 100px 100px 130px 90px 36px',
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
                {fmtMoney(h.currentValue)}
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
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Remove"
              >×</button>
            </div>
          ))}
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
              {notInPortfolio.map((c) => (
                <div key={c.ticker} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="ticker-badge" style={{ fontSize: 10 }}>{c.ticker}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal(c)}
                    style={{
                      fontSize: 11, fontFamily: "'DM Mono', monospace",
                      color: 'var(--accent-green-bright)', background: 'none',
                      border: '1px solid var(--accent-green)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px', cursor: 'pointer',
                    }}
                  >Add to Portfolio</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => openModal(null)}
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
