// Alpha Vantage — fallback for dividend yield, beta, revenue growth
// Free tier: 25 requests/day. Per-ticker 24hr cache + daily request counter.

const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = new Map(); // ticker -> { data, time }
const MAX_DAILY_CALLS = 20; // conservative buffer below the 25/day limit

let dailyCallCount = 0;
let lastCountDate  = null;

function resetCounterIfNeeded() {
  const today = new Date().toDateString();
  if (lastCountDate !== today) {
    dailyCallCount = 0;
    lastCountDate  = today;
  }
}

function parseNum(val) {
  if (val == null || val === 'None' || val === '-' || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// Fetches OVERVIEW for a ticker. Returns:
// { dividendYield, beta, revGrowthYOY }
// dividendYield is in the same "percent" format as Finnhub (e.g. 1.5 means 1.5%)
// revGrowthYOY is a decimal (e.g. 0.08 means 8%)
export async function getOverview(ticker) {
  resetCounterIfNeeded();

  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;

  if (dailyCallCount >= MAX_DAILY_CALLS) {
    console.warn('[alphaService] Daily call limit reached — skipping', ticker);
    return null;
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  try {
    dailyCallCount++;
    const res = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`
    );
    const data = await res.json();

    // Rate limit or invalid key returns { Information: '...' }
    if (!data.Symbol || data.Information) {
      console.warn(`[alphaService] ${ticker}: rate limit or bad key`);
      cache.set(ticker, { data: null, time: Date.now() });
      return null;
    }

    // AV DividendYield is a decimal (e.g. "0.0051" = 0.51%) — convert to % like Finnhub
    const rawDivYield = parseNum(data.DividendYield);
    const dividendYield = rawDivYield != null ? rawDivYield * 100 : null;

    const result = {
      dividendYield, // in % (e.g. 1.5 for 1.5%)
      beta:         parseNum(data.Beta),
      revGrowthYOY: parseNum(data.QuarterlyRevenueGrowthYOY), // decimal
    };

    cache.set(ticker, { data: result, time: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[alphaService] ${ticker}:`, err.message);
    cache.set(ticker, { data: null, time: Date.now() });
    return null;
  }
}
