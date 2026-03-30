// Alpha Vantage — fallback for dividend yield, beta, revenue growth + news sentiment
// Free tier: 25 requests/day total. Two separate counters to stay within budget.

const CACHE_TTL           = 24 * 60 * 60 * 1000;
const NEWS_CACHE_TTL      = 6  * 60 * 60 * 1000; // news refreshes every 6 hours
const cache               = new Map(); // ticker -> { data, time }
const newsSentimentCache  = new Map(); // ticker -> { data, time }
const MAX_DAILY_CALLS     = 12; // overview quota
const MAX_NEWS_DAILY      = 12; // news sentiment quota (total ≤ 24 / 25 limit)

let dailyCallCount    = 0;
let lastCountDate     = null;
let newsDailyCount    = 0;
let newsLastCountDate = null;

function resetCounterIfNeeded() {
  const today = new Date().toDateString();
  if (lastCountDate !== today) {
    dailyCallCount = 0;
    lastCountDate  = today;
  }
}

function resetNewsCounterIfNeeded() {
  const today = new Date().toDateString();
  if (newsLastCountDate !== today) {
    newsDailyCount    = 0;
    newsLastCountDate = today;
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

// News sentiment for a ticker. Returns { sentimentScore, sentimentLabel }.
// sentimentScore is a float from -1 (Bearish) to +1 (Bullish).
// Cache: 6 hours. Tracked against a separate daily call counter.
export async function getNewsSentiment(ticker) {
  resetNewsCounterIfNeeded();

  const hit = newsSentimentCache.get(ticker);
  if (hit && Date.now() - hit.time < NEWS_CACHE_TTL) return hit.data;

  if (newsDailyCount >= MAX_NEWS_DAILY) {
    console.warn('[alphaService] News sentiment daily limit reached — skipping', ticker);
    return null;
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  try {
    newsDailyCount++;
    const res = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(ticker)}&limit=10&apikey=${apiKey}`
    );
    const data = await res.json();

    if (!data.feed || data.Information) {
      console.warn(`[alphaService] news-sentiment ${ticker}: rate limit or bad response`);
      newsSentimentCache.set(ticker, { data: null, time: Date.now() });
      return null;
    }

    const score = parseNum(data.overall_sentiment_score);
    const result = {
      sentimentScore: score,
      sentimentLabel: typeof data.overall_sentiment_label === 'string'
        ? data.overall_sentiment_label
        : null,
    };
    newsSentimentCache.set(ticker, { data: result, time: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[alphaService] news-sentiment ${ticker}:`, err.message);
    newsSentimentCache.set(ticker, { data: null, time: Date.now() });
    return null;
  }
}
