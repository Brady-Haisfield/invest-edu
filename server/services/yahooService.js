// Uses Finnhub free API for stock quotes
// Get a free key at finnhub.io

const BASE = 'https://finnhub.io/api/v1';

function finnhubFetch(path) {
  const key = process.env.FINNHUB_API_KEY;
  return fetch(`${BASE}${path}&token=${key}`).then((r) => r.json());
}

export async function getQuote(ticker) {
  const [quote, profile, metricResult] = await Promise.allSettled([
    finnhubFetch(`/quote?symbol=${ticker}`),
    finnhubFetch(`/stock/profile2?symbol=${ticker}`),
    finnhubFetch(`/stock/metric?symbol=${ticker}&metric=all`),
  ]);

  const q = quote.status === 'fulfilled' ? quote.value : {};
  const p = profile.status === 'fulfilled' ? profile.value : {};
  const m = metricResult.status === 'fulfilled' ? metricResult.value : {};

  // Finnhub returns c=0 when ticker is invalid
  if (!q.c) throw new Error(`No data for ${ticker}`);

  const peRatio = m.metric?.peBasicExclExtraTTM ?? m.metric?.peTTM ?? null;

  return {
    ticker,
    name: p.name ?? ticker,
    price: q.c ?? null,
    fiftyTwoWeekLow: q.l ?? null,
    fiftyTwoWeekHigh: q.h ?? null,
    peRatio,
    marketCap: p.marketCapitalization ? p.marketCapitalization * 1e6 : null,
    sector: p.finnhubIndustry ?? null,
    currency: p.currency ?? 'USD',
  };
}
