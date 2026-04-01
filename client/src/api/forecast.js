import { API_BASE } from './base.js';

export async function fetchForecast(ticker) {
  const res = await fetch(`${API_BASE}/api/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data; // { forecast, ticker, companyName }
}
