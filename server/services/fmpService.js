// Financial Modeling Prep — analyst estimates and ETF data
// Free tier: 250 requests/day. Per-ticker 24hr in-memory cache.

const CACHE_TTL          = 24 * 60 * 60 * 1000;
const HOLDINGS_CACHE_TTL = 7  * 24 * 60 * 60 * 1000; // holdings change infrequently
const cache = new Map(); // key -> { data, time }

const FMP_BASE = 'https://financialmodelingprep.com/api';

async function fmpFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP ${res.status}`);
  return res.json();
}

// Forward EPS growth from analyst consensus estimates.
// Returns { epsGrowthFwd: number|null }
export async function getAnalystData(ticker) {
  const key = `analyst:${ticker}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;

  const apiKey = process.env.FMP_API_KEY;
  try {
    const url = `${FMP_BASE}/v3/analyst-estimates/${encodeURIComponent(ticker)}?limit=3&apikey=${apiKey}`;
    const data = await fmpFetch(url);

    if (!Array.isArray(data) || data.length < 2) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    // data[0] = latest/upcoming year, data[1] = prior year estimate
    const fwdEps  = data[0]?.estimatedEpsAvg;
    const baseEps = data[1]?.estimatedEpsAvg;
    let epsGrowthFwd = null;
    if (fwdEps != null && baseEps != null && Math.abs(baseEps) > 0.01) {
      epsGrowthFwd = (fwdEps - baseEps) / Math.abs(baseEps);
      // Clamp to reasonable range
      epsGrowthFwd = Math.min(0.50, Math.max(-0.30, epsGrowthFwd));
    }

    const result = { epsGrowthFwd };
    cache.set(key, { data: result, time: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[fmpService] analyst ${ticker}:`, err.message);
    cache.set(key, { data: null, time: Date.now() });
    return null;
  }
}

// Analyst consensus price targets.
// Returns { targetHigh, targetLow, targetConsensus, targetMedian }
export async function getPriceTarget(ticker) {
  const key = `pt:${ticker}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;

  const apiKey = process.env.FMP_API_KEY;
  try {
    const url = `${FMP_BASE}/stable/price-target-consensus?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
    const data = await fmpFetch(url);

    if (!data || (Array.isArray(data) && data.length === 0)) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    const item = Array.isArray(data) ? data[0] : data;
    if (!item || typeof item !== 'object') {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    const result = {
      targetHigh:      item.targetHigh      != null ? Number(item.targetHigh)      : null,
      targetLow:       item.targetLow       != null ? Number(item.targetLow)       : null,
      targetConsensus: item.targetConsensus != null ? Number(item.targetConsensus) : null,
      targetMedian:    item.targetMedian    != null ? Number(item.targetMedian)    : null,
    };
    cache.set(key, { data: result, time: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[fmpService] price-target ${ticker}:`, err.message);
    cache.set(key, { data: null, time: Date.now() });
    return null;
  }
}

// Analyst grades/sentiment consensus summary.
// Returns { strongBuy, buy, hold, sell, strongSell, consensus }
export async function getAnalystSentiment(ticker) {
  const key = `grades:${ticker}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;

  const apiKey = process.env.FMP_API_KEY;
  try {
    const url = `${FMP_BASE}/stable/grades-consensus?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
    const data = await fmpFetch(url);

    if (!data || (Array.isArray(data) && data.length === 0)) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    const item = Array.isArray(data) ? data[0] : data;
    if (!item || typeof item !== 'object') {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    const result = {
      strongBuy:  item.strongBuy  != null ? Number(item.strongBuy)  : null,
      buy:        item.buy        != null ? Number(item.buy)        : null,
      hold:       item.hold       != null ? Number(item.hold)       : null,
      sell:       item.sell       != null ? Number(item.sell)       : null,
      strongSell: item.strongSell != null ? Number(item.strongSell) : null,
      consensus:  typeof item.consensus === 'string' ? item.consensus : null,
    };
    cache.set(key, { data: result, time: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[fmpService] grades-consensus ${ticker}:`, err.message);
    cache.set(key, { data: null, time: Date.now() });
    return null;
  }
}

// ETF expense ratio, dividend yield, and duration from FMP stable ETF info endpoint.
// Cached 7 days — expense ratios change rarely.
// Returns { expenseRatio: number|null, dividendYield: number|null, averageDuration: number|null }
export async function getETFInfo(ticker) {
  const key = `etf:${ticker}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < HOLDINGS_CACHE_TTL) return hit.data;

  const apiKey = process.env.FMP_API_KEY;
  try {
    const url = `https://financialmodelingprep.com/stable/etf-info?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
    const data = await fmpFetch(url);

    if (!data || (Array.isArray(data) && data.length === 0)) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    const info = Array.isArray(data) ? data[0] : data;
    if (!info || typeof info !== 'object') {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    // expenseRatio: FMP returns as decimal (e.g. 0.0003 = 0.03%) — store as-is; StockCard multiplies by 100 for display
    // dividendYield: FMP returns as decimal (e.g. 0.015 = 1.5%) — convert to % to match Finnhub convention
    // averageDuration: try all known FMP field names
    const durRaw = info.averageDuration ?? info.avgDuration ?? info.duration ?? null;
    const result = {
      expenseRatio:    info.expenseRatio  != null ? Number(info.expenseRatio)        : null,
      dividendYield:   info.dividendYield != null ? Number(info.dividendYield) * 100 : null,
      averageDuration: durRaw             != null ? Number(durRaw)                   : null,
    };
    cache.set(key, { data: result, time: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[fmpService] etf-info ${ticker}:`, err.message);
    cache.set(key, { data: null, time: Date.now() });
    return null;
  }
}

// Top ETF holdings by weight.
// Returns [{ ticker, weight }] sorted descending, or null.
// Cached 7 days — composition changes rarely.
export async function getETFHoldings(ticker) {
  const key = `holdings:${ticker}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < HOLDINGS_CACHE_TTL) return hit.data;

  const apiKey = process.env.FMP_API_KEY;
  try {
    const url = `https://financialmodelingprep.com/stable/etf-holdings?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
    const data = await fmpFetch(url);

    if (!Array.isArray(data) || data.length === 0) {
      cache.set(key, { data: null, time: Date.now() }); // short TTL for null (24h)
      return null;
    }

    // weightPercentage is in % (e.g. 6.5 = 6.5%). Convert to decimal.
    const holdings = data
      .map((h) => ({
        ticker: h.asset ?? h.symbol ?? null,
        weight: h.weightPercentage != null ? Number(h.weightPercentage) / 100
              : h.weight           != null ? Number(h.weight)
              : null,
      }))
      .filter((h) => h.ticker && typeof h.ticker === 'string' && /^[A-Z]{1,5}$/.test(h.ticker) && h.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);

    if (holdings.length === 0) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    cache.set(key, { data: holdings, time: Date.now() });
    return holdings;
  } catch (err) {
    console.warn(`[fmpService] etf-holdings ${ticker}:`, err.message);
    cache.set(key, { data: null, time: Date.now() });
    return null;
  }
}
