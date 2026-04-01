// Finnhub free API — stock quotes and metrics for the suggestions pipeline

const BASE = 'https://finnhub.io/api/v1';

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
