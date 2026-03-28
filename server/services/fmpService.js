// Financial Modeling Prep — analyst estimates and ETF data
// Free tier: 250 requests/day. Per-ticker 24hr in-memory cache.

const CACHE_TTL = 24 * 60 * 60 * 1000;
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

// ETF expense ratio and dividend yield from FMP ETF info endpoint.
// Returns { expenseRatio: number|null, dividendYield: number|null }
export async function getETFInfo(ticker) {
  const key = `etf:${ticker}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;

  const apiKey = process.env.FMP_API_KEY;
  try {
    const url = `${FMP_BASE}/v4/etf-info?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
    const data = await fmpFetch(url);

    if (!Array.isArray(data) || data.length === 0) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    const info = data[0];
    // expenseRatio comes as a decimal (e.g. 0.0003 for 0.03%)
    // dividendYield comes as a decimal (e.g. 0.015 for 1.5%)
    const result = {
      expenseRatio:  info.expenseRatio  != null ? Number(info.expenseRatio)  : null,
      dividendYield: info.dividendYield != null ? Number(info.dividendYield) * 100 : null, // store as % like Finnhub
    };
    cache.set(key, { data: result, time: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[fmpService] etf-info ${ticker}:`, err.message);
    cache.set(key, { data: null, time: Date.now() });
    return null;
  }
}
