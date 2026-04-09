import { API_BASE } from './base.js';

export async function fetchSuggestions(formData, token) {
  const res = await fetch(`${API_BASE}/api/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(formData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  const treasuryRates = data.treasuryRates ?? null;
  console.log('[fetchSuggestions] treasuryRates.spyForwardReturn:', treasuryRates?.spyForwardReturn);
  return { cards: data.cards, advisorNarrative: data.advisorNarrative ?? null, treasuryRates };
}

export async function fetchMarketRates() {
  try {
    console.log('[fetchMarketRates] calling /api/market-rates...');
    const res = await fetch(`${API_BASE}/api/market-rates`);
    const data = await res.json();
    console.log('[fetchMarketRates] raw response:', data);
    console.log('[fetchMarketRates] spyForwardReturn:', data.marketRates?.spyForwardReturn);
    return data.marketRates ?? null;
  } catch (err) {
    console.error('[fetchMarketRates] failed:', err.message);
    return null;
  }
}
