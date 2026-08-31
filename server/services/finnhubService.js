// Finnhub free API — stock quotes and metrics for the suggestions pipeline

const BASE = 'https://finnhub.io/api/v1';

// Short cache — candidate-pool screening can request the same popular tickers
// repeatedly across users; prices don't need to be fresher than this for that purpose.
const QUOTE_CACHE_TTL = 10 * 60 * 1000;
const quoteCache = new Map(); // ticker -> { data, time }

function finnhubFetch(path) {
  const key = process.env.FINNHUB_API_KEY;
  return fetch(`${BASE}${path}&token=${key}`).then((r) => r.json());
}

function extractConcept(statements, conceptNames) {
  for (const name of conceptNames) {
    const item = statements.find((s) => s.concept === name);
    if (item?.value != null) return Number(item.value);
  }
  return null;
}

function extractFFO(financials) {
  const reports = financials?.data;
  if (!Array.isArray(reports) || reports.length === 0) return null;

  const latest = reports[0];
  const ic = latest.report?.ic ?? [];
  const cf = latest.report?.cf ?? [];

  const netIncome = extractConcept(ic, [
    'NetIncomeLoss',
    'NetIncome',
    'ProfitLoss',
    'NetIncomeLossAttributableToParent',
  ]);

  const depreciation = extractConcept(cf, [
    'DepreciationAndAmortization',
    'DepreciationDepletionAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
    'Depreciation',
  ]);

  if (netIncome == null || depreciation == null) return null;
  return netIncome + depreciation;
}

// Recent real headlines for a ticker — same /company-news endpoint already used in
// forecastService.js, extended here to keep url/source/datetime (forecastService only
// keeps headline text for its prompt; suggestion cards show these directly to the user,
// so the source/link matter for letting them verify it themselves).
const NEWS_CACHE_TTL = 60 * 60 * 1000; // 1h — headlines don't need to be fresher than this
const newsCache = new Map(); // ticker -> { data, time }

export async function getRecentHeadlines(ticker, limit = 3) {
  const hit = newsCache.get(ticker);
  if (hit && Date.now() - hit.time < NEWS_CACHE_TTL) return hit.data;

  try {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60;
    const from = new Date(sevenDaysAgo * 1000).toISOString().split('T')[0];
    const to = new Date(now * 1000).toISOString().split('T')[0];

    const news = await finnhubFetch(`/company-news?symbol=${ticker}&from=${from}&to=${to}`);
    const headlines = Array.isArray(news)
      ? news
          .filter((n) => n.headline && n.datetime)
          .sort((a, b) => b.datetime - a.datetime)
          .slice(0, limit)
          .map((n) => ({
            headline: n.headline,
            source:   n.source ?? null,
            url:      n.url ?? null,
            date:     new Date(n.datetime * 1000).toISOString(),
          }))
      : [];

    newsCache.set(ticker, { data: headlines, time: Date.now() });
    return headlines;
  } catch (err) {
    console.warn(`[finnhubService] getRecentHeadlines failed for ${ticker}:`, err.message);
    return [];
  }
}

// Same-sub-industry peer tickers for a seed ticker — used by candidatePoolService.js
// to source real, live candidates (FMP's ETF-holdings endpoint isn't available on this
// account's plan, confirmed via direct testing: 402/404 on every holdings path tried).
export async function getPeers(ticker) {
  try {
    const peers = await finnhubFetch(`/stock/peers?symbol=${ticker}`);
    return Array.isArray(peers) ? peers.filter((p) => typeof p === 'string' && /^[A-Z]{1,5}$/.test(p)) : [];
  } catch {
    return [];
  }
}

export async function getQuote(ticker) {
  const hit = quoteCache.get(ticker);
  if (hit && Date.now() - hit.time < QUOTE_CACHE_TTL) return hit.data;

  const data = await fetchQuote(ticker);
  quoteCache.set(ticker, { data, time: Date.now() });
  return data;
}

async function fetchQuote(ticker) {
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

  const peRatio    = m.metric?.peBasicExclExtraTTM ?? m.metric?.peTTM ?? null;
  const industry   = p.finnhubIndustry ?? '';
  const isREIT     = industry.includes('Real Estate') || industry.includes('REIT');

  // Conditional FFO fetch for REITs — best-effort, never blocks the response
  let ffo = null;
  if (isREIT) {
    try {
      const financialsResult = await finnhubFetch(
        `/stock/financials-reported?symbol=${ticker}&freq=annual`
      );
      ffo = extractFFO(financialsResult);
    } catch {
      // FFO is informational — silently skip on error
    }
  }

  return {
    ticker,
    name:             p.name ?? ticker,
    price:            q.c ?? null,
    fiftyTwoWeekLow:  q.l ?? null,
    fiftyTwoWeekHigh: q.h ?? null,
    peRatio,
    marketCap:        p.marketCapitalization ? p.marketCapitalization * 1e6 : null,
    sector:           p.finnhubIndustry ?? null,
    currency:         p.currency ?? 'USD',
    revenueGrowth3Y:  m.metric?.revenueGrowth3Y  ?? null,
    revenueGrowth5Y:  m.metric?.revenueGrowth5Y  ?? null,
    dividendYield:    m.metric?.dividendYieldIndicatedAnnual
                      ?? m.metric?.currentDividendYieldTTM
                      ?? m.metric?.dividendYieldTTM
                      ?? m.metric?.trailingDividendYield
                      ?? m.metric?.forwardDividendYield
                      ?? null,
    beta:             m.metric?.beta             ?? null,
    grossMarginTTM:   m.metric?.grossMarginTTM   ?? null,
    epsGrowth3Y:      m.metric?.epsGrowth3Y      ?? null,
    operatingCashFlow: m.metric?.operatingCashFlowPerShareTTM ?? null,
    freeCashFlow:      m.metric?.freeCashFlowPerShareTTM      ?? null,
    ffo:               ffo ?? null,
    sharesOutstanding: p.shareOutstanding ?? null,
  };
}
