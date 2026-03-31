import { useState, useEffect, useRef } from 'react';
import { addHolding } from '../services/auth.js';

const ACCOUNT_OPTIONS = [
  '', 'Taxable brokerage', 'Roth IRA', 'Traditional IRA', '401(k) / employer plan', 'Not sure',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AddInvestmentModal({
  token,
  initialTicker, initialName, initialSecurityType,
  initialAmount, initialPurchasePrice, initialPurchaseMonth, initialPurchaseYear, initialAccountType,
  editId,
  onSuccess, onClose,
}) {
  const now = new Date();
  const tickerLocked = !!initialTicker || !!editId;

  const [ticker, setTicker]               = useState(initialTicker ?? '');
  const [tickerName, setTickerName]       = useState(initialName ?? '');
  const [securityType, setSecurityType]   = useState(initialSecurityType ?? '');
  const [amount, setAmount]               = useState(initialAmount != null ? String(initialAmount) : '');
  const [purchasePrice, setPurchasePrice] = useState(initialPurchasePrice != null ? String(initialPurchasePrice) : '');
  const [purchaseMonth, setPurchaseMonth] = useState(initialPurchaseMonth ?? now.getMonth() + 1);
  const [purchaseYear, setPurchaseYear]   = useState(initialPurchaseYear ?? now.getFullYear());
  const [accountType, setAccountType]     = useState(initialAccountType ?? '');
  const [suggestions, setSuggestions]     = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState('');

  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

  // Autocomplete search (only when ticker is not pre-filled)
  useEffect(() => {
    if (tickerLocked) return;
    const query = ticker.trim();
    if (query.length < 1) { setSuggestions([]); setShowDropdown(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setShowDropdown((data.results ?? []).length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [ticker, tickerLocked]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function selectSuggestion(item) {
    setTicker(item.ticker);
    setTickerName(item.name ?? '');
    setSuggestions([]);
    setShowDropdown(false);
    setError('');
  }

  async function handleSubmit() {
    const cleanTicker = ticker.trim().toUpperCase();
    const amountParsed = parseFloat(amount.replace(/[^0-9.]/g, ''));
    const purchasePriceParsed = purchasePrice.trim()
      ? parseFloat(purchasePrice.replace(/[^0-9.]/g, ''))
      : null;

    if (!cleanTicker) { setError('Ticker is required'); return; }
    if (isNaN(amountParsed) || amountParsed <= 0) { setError('Please enter a valid amount'); return; }
    if (purchasePriceParsed !== null && (isNaN(purchasePriceParsed) || purchasePriceParsed <= 0)) {
      setError('Purchase price must be a positive number'); return;
    }

    const payload = editId ? {
      amountInvested: amountParsed,
      purchasePrice: purchasePriceParsed,
      purchaseMonth: Number(purchaseMonth),
      purchaseYear: Number(purchaseYear),
      accountType: accountType || null,
    } : {
      ticker: cleanTicker,
      name: tickerName || null,
      securityType: securityType || null,
      amountInvested: amountParsed,
      purchasePrice: purchasePriceParsed,
      purchaseMonth: Number(purchaseMonth),
      purchaseYear: Number(purchaseYear),
      accountType: accountType || null,
      addedFrom: initialTicker ? 'suggestion' : 'manual',
    };

    console.log(editId ? 'PATCH body:' : 'POST body:', payload);
    const url = editId ? `/api/auth/portfolio/holdings/${editId}` : '/api/auth/portfolio/add';
    const method = editId ? 'PATCH' : 'POST';

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || `Server error ${response.status}`);
        return;
      }
      onSuccess(cleanTicker);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Could not add holding. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const yearOptions = Array.from({ length: 30 }, (_, i) => now.getFullYear() - i);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-5)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)',
        width: '100%', maxWidth: 420,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h3 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 20, fontWeight: 400, color: 'var(--text-primary)' }}>
            {editId ? 'Edit Holding' : 'Add to Portfolio'}
          </h3>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Ticker */}
          <div ref={wrapperRef} style={{ position: 'relative' }}>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => { setTicker(e.target.value.toUpperCase()); setError(''); }}
              placeholder="e.g. AAPL"
              maxLength={10}
              disabled={tickerLocked || submitting}
              className="ticker-input"
              style={{ width: '100%', backgroundColor: 'var(--bg-input)', fontSize: 14 }}
              autoFocus={!tickerLocked}
            />
            {showDropdown && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}>
                {suggestions.map((s) => (
                  <button
                    key={s.ticker} type="button"
                    onClick={() => selectSuggestion(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '8px 12px',
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--accent-green-bright)', minWidth: 50 }}>{s.ticker}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount invested */}
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Amount Invested</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none',
                fontFamily: "'DM Mono', monospace",
              }}>$</span>
              <input
                type="text"
                value={amount}
                onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="5000"
                disabled={submitting}
                className="ticker-input"
                style={{ paddingLeft: 26, backgroundColor: 'var(--bg-input)', fontSize: 14, width: '100%' }}
              />
            </div>
          </div>

          {/* Purchase price */}
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>
              Purchase Price Per Share
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 var(--space-2)', lineHeight: 1.4 }}>
              Enter the price you paid per share for accurate gain/loss tracking. Leave blank to log the investment without return calculations.
            </p>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none',
                fontFamily: "'DM Mono', monospace",
              }}>$</span>
              <input
                type="text"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="e.g. 185.50"
                disabled={submitting}
                className="ticker-input"
                style={{ paddingLeft: 26, backgroundColor: 'var(--bg-input)', fontSize: 14, width: '100%' }}
              />
            </div>
            {!purchasePrice.trim() && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 'var(--radius)', padding: '7px 10px', marginTop: 'var(--space-2)',
              }}>
                <span style={{ color: 'var(--accent-amber)', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                  ⚠ Without a purchase price, we cannot calculate your investment returns.
                </span>
              </div>
            )}
          </div>

          {/* Purchase date */}
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Purchase Date</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={purchaseMonth}
                onChange={(e) => setPurchaseMonth(Number(e.target.value))}
                disabled={submitting}
                className="ticker-input"
                style={{ flex: 1, backgroundColor: 'var(--bg-input)', fontSize: 13 }}
              >
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <select
                value={purchaseYear}
                onChange={(e) => setPurchaseYear(Number(e.target.value))}
                disabled={submitting}
                className="ticker-input"
                style={{ flex: 1, backgroundColor: 'var(--bg-input)', fontSize: 13 }}
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Account type */}
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Account Type <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              disabled={submitting}
              className="ticker-input"
              style={{ width: '100%', backgroundColor: 'var(--bg-input)', fontSize: 13 }}
            >
              {ACCOUNT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt || 'Select account type…'}</option>
              ))}
            </select>
          </div>

          {error && (
            <p style={{ color: 'var(--accent-red)', fontSize: 11, margin: 0 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
            <button
              type="button" onClick={onClose} disabled={submitting}
              style={{
                flex: 1, padding: '10px 0',
                background: 'none', border: '1px solid var(--border-2)',
                borderRadius: 'var(--radius)', color: 'var(--text-muted)',
                fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary"
              style={{ flex: 2 }}
            >
              {submitting ? (editId ? 'Saving…' : 'Adding…') : (editId ? 'Save Changes' : 'Add to Portfolio')}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
