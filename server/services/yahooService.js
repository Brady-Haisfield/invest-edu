// Uses Finnhub free API for stock quotes
// Get a free key at finnhub.io

const BASE = 'https://finnhub.io/api/v1';

function finnhubFetch(path) {
  const key = process.env.FINNHUB_API_KEY;
  return fetch(`${BASE}${path}&token=${key}`).then((r) => r.json());
}

export async function getQuote(ticker) {
  const [quote, profile] = await Promise.all([
    finnhubFetch(`/quote?symbol=${ticker}`),
    finnhubFetch(`/stock/profile2?symbol=${ticker}`),
  ]);

  // Finnhub returns c=0 when ticker is invalid
  if (!quote.c) throw new Error(`No data for ${ticker}`);

  return {
    ticker,
    name: profile.name ?? ticker,
    price: quote.c ?? null,            // current price
    fiftyTwoWeekLow: quote.l ?? null,  // today's low (52wk not in free tier)
    fiftyTwoWeekHigh: quote.h ?? null, // today's high
    peRatio: null,                     // not in Finnhub free tier
    marketCap: profile.marketCapitalization
      ? profile.marketCapitalization * 1e6
      : null,
    sector: profile.finnhubIndustry ?? null,
    currency: profile.currency ?? 'USD',
  };
}
