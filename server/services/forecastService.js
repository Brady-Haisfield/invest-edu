// Fetches comprehensive stock data from Finnhub for forecast analysis
// Note: fires up to 7 parallel requests per call — within Finnhub free tier limits (60/min)

const BASE = 'https://finnhub.io/api/v1';

function finnhubFetch(path) {
  const key = process.env.FINNHUB_API_KEY;
  return fetch(`${BASE}${path}&token=${key}`).then((r) => r.json());
}

// XBRL concept names vary across filers — try multiple candidates
function extractConcept(items, candidates) {
  if (!Array.isArray(items)) return null;
  for (const name of candidates) {
    const found = items.find((item) => item.concept === name);
    if (found?.value != null) return found.value;
  }
  return null;
}

const REVENUE_CONCEPTS = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'SalesRevenueNet',
  'SalesRevenueGoodsNet',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
];
const NET_INCOME_CONCEPTS = [
  'NetIncomeLoss',
  'NetIncome',
  'ProfitLoss',
  'NetIncomeLossAvailableToCommonStockholdersBasic',
];
const EPS_CONCEPTS = [
  'EarningsPerShareBasic',
  'EarningsPerShareDiluted',
];
const OCF_CONCEPTS = [
  'NetCashProvidedByUsedInOperatingActivities',
  'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
];
const TOTAL_DEBT_CONCEPTS = [
  'LongTermDebt',
  'LongTermDebtNoncurrent',
  'DebtCurrent',
  'LongTermDebtAndCapitalLeaseObligation',
];

function trimFinancials(data) {
  if (!data?.data || !Array.isArray(data.data)) return [];
  return data.data.slice(0, 3).map((period) => ({
    year: period.year,
    period: period.period,
    revenue: extractConcept(period.report?.ic, REVENUE_CONCEPTS),
    netIncome: extractConcept(period.report?.ic, NET_INCOME_CONCEPTS),
    eps: extractConcept(period.report?.ic, EPS_CONCEPTS),
    operatingCashFlow: extractConcept(period.report?.cf, OCF_CONCEPTS),
    totalDebt: extractConcept(period.report?.bs, TOTAL_DEBT_CONCEPTS),
  }));
}

const METRIC_KEYS = [
  'peBasicExclExtraTTM',
  'epsBasicExclExtraItemsTTM',
  'revenueGrowth3Y',
  'revenueGrowth5Y',
  'roeRfy',
  'roaRfy',
  'totalDebt/totalEquityAnnual',
  'currentRatioAnnual',
  'grossMarginTTM',
  'operatingMarginTTM',
  'netMarginTTM',
  'beta',
  'dividendYieldIndicatedAnnual',
  '52WeekHigh',
  '52WeekLow',
  'priceRelativeToS&P50052Week',
];

function trimMetrics(data) {
  if (!data?.metric) return {};
  const out = {};
  for (const key of METRIC_KEYS) {
    if (data.metric[key] != null) out[key] = data.metric[key];
  }
  return out;
}

export async function getStockData(ticker) {
  const TICKER_RE = /^[A-Z]{1,5}$/;
  if (!TICKER_RE.test(ticker)) {
    const err = new Error(`Invalid ticker format: ${ticker}`);
    err.statusCode = 400;
    throw err;
  }

  const now = Math.floor(Date.now() / 1000);
  const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60;
  const newsFrom = new Date(fourteenDaysAgo * 1000).toISOString().split('T')[0];
  const newsTo = new Date(now * 1000).toISOString().split('T')[0];

  const [profileRes, quoteRes, metricsRes, financialsRes, candlesRes, earningsRes, newsRes] =
    await Promise.allSettled([
      finnhubFetch(`/stock/profile2?symbol=${ticker}`),
      finnhubFetch(`/quote?symbol=${ticker}`),
      finnhubFetch(`/stock/metric?symbol=${ticker}&metric=all`),
      finnhubFetch(`/stock/financials-reported?symbol=${ticker}&freq=annual`),
      finnhubFetch(`/stock/candle?symbol=${ticker}&resolution=M&from=${twoYearsAgo}&to=${now}`),
      finnhubFetch(`/stock/earnings?symbol=${ticker}`),
      finnhubFetch(`/company-news?symbol=${ticker}&from=${newsFrom}&to=${newsTo}`),
    ]);

  const quote = quoteRes.status === 'fulfilled' ? quoteRes.value : {};
  if (!quote.c) {
    const err = new Error(`No data found for ticker ${ticker}. Check that it is a valid US exchange ticker.`);
    err.statusCode = 404;
    throw err;
  }

  const profile = profileRes.status === 'fulfilled' ? profileRes.value : {};
  const metricsRaw = metricsRes.status === 'fulfilled' ? metricsRes.value : {};
  const financialsRaw = financialsRes.status === 'fulfilled' ? financialsRes.value : {};
  const candlesRaw = candlesRes.status === 'fulfilled' ? candlesRes.value : {};
  const earningsRaw = earningsRes.status === 'fulfilled' ? earningsRes.value : [];
  const newsRaw = newsRes.status === 'fulfilled' ? newsRes.value : [];

  return {
    ticker,
    profile: {
      name: profile.name ?? ticker,
      sector: profile.finnhubIndustry ?? null,
      industry: profile.finnhubIndustry ?? null,
      country: profile.country ?? null,
      marketCap: profile.marketCapitalization ?? null, // in millions
      ipo: profile.ipo ?? null,
      exchange: profile.exchange ?? null,
    },
    quote: {
      price: quote.c,
      prevClose: quote.pc ?? null,
      changePercent: quote.pc ? (((quote.c - quote.pc) / quote.pc) * 100).toFixed(2) : null,
      high52: quote.h ?? null,
      low52: quote.l ?? null,
    },
    metrics: trimMetrics(metricsRaw),
    annualFinancials: trimFinancials(financialsRaw),
    monthlyCloses: Array.isArray(candlesRaw.c) ? candlesRaw.c : [],
    earnings: Array.isArray(earningsRaw)
      ? earningsRaw.slice(0, 4).map((e) => ({
          period: e.period,
          actual: e.actual,
          estimate: e.estimate,
          surprise: e.surprise,
          surprisePercent: e.surprisePercent,
        }))
      : [],
    recentNews: Array.isArray(newsRaw)
      ? newsRaw.slice(0, 5).map((n) => n.headline).filter(Boolean)
      : [],
  };
}
