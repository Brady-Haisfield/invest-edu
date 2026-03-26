const MARKET_PREMIUM  = 0.055;  // Long-run US equity risk premium
const MARKET_LONG_RUN = 0.098;  // S&P 500 long-run nominal average

// Known SEC 30-day yields for common bond/income ETFs.
// Finnhub free tier doesn't provide SEC yield — these are more accurate than TTM.
// Last updated: March 2026
const BOND_ETF_KNOWN_YIELDS = {
  'BND':  0.0453,  // Vanguard Total Bond Market
  'AGG':  0.0441,  // iShares Core US Aggregate Bond
  'TLT':  0.0462,  // iShares 20+ Year Treasury
  'VCSH': 0.0461,  // Vanguard Short-Term Corporate Bond
  'VGSH': 0.0433,  // Vanguard Short-Term Treasury
  'VCIT': 0.0481,  // Vanguard Intermediate Corporate Bond
  'LQD':  0.0502,  // iShares Investment Grade Corporate Bond
  'HYG':  0.0721,  // iShares High Yield Corporate Bond
  'JNK':  0.0734,  // SPDR Bloomberg High Yield Bond
  'JEPI': 0.0712,  // JPMorgan Equity Premium Income
  'SCHD': 0.0351,  // Schwab US Dividend Equity
  'VYM':  0.0282,  // Vanguard High Dividend Yield
  'VYMI': 0.0421,  // Vanguard International High Dividend
};

export function calcProjection(card, totalYears, isConservative, treasuryRates) {
  console.log('[projections] ticker:', card.ticker, '| dividendYield (raw Finnhub %):', card.dividendYield);
  switch (card.type) {
    case 'bond_etf': return calcBondETFProjection(card, totalYears, isConservative, treasuryRates);
    case 'reit':     return calcREITProjection(card, totalYears, isConservative);
    case 'etf':      return calcETFProjection(card, totalYears, isConservative);
    case 'stock':
    default:         return calcStockProjection(card, totalYears, isConservative);
  }
}

// ─── STOCKS: Bogle's model + CAPM blend ───────────────────────────────────────

function calcStockProjection(card, years, isConservative) {
  const divYield = normalizeDivYield(card.dividendYield) ?? 0.018;

  let earningsGrowth = null;
  if (isValid(card.epsGrowth3Y))    earningsGrowth = card.epsGrowth3Y;
  else if (isValid(card.revenueGrowth3Y)) earningsGrowth = card.revenueGrowth3Y;
  else earningsGrowth = 0.065;

  earningsGrowth = Math.min(0.25, Math.max(-0.15, earningsGrowth));

  const bogleReturn = divYield + earningsGrowth;

  const riskFree = 0.043;
  const capmReturn = (isValid(card.beta) && card.beta > 0 && card.beta < 3)
    ? riskFree + card.beta * MARKET_PREMIUM
    : MARKET_LONG_RUN;

  let rate = (bogleReturn * 0.5) + (capmReturn * 0.5);
  rate = Math.min(0.20, Math.max(0.01, rate));
  if (isConservative) rate *= 0.80;

  const dataSource = (isValid(card.epsGrowth3Y) || isValid(card.revenueGrowth3Y)) && isValid(card.beta)
    ? 'real' : 'estimated';

  return buildResult(card, rate, divYield, years, dataSource,
    'Bogle model (dividend yield + earnings growth) blended with CAPM');
}

// ─── ETFs: CAPM primary, actual yield ─────────────────────────────────────────

function calcETFProjection(card, years, isConservative) {
  const divYield = BOND_ETF_KNOWN_YIELDS[card.ticker] ?? normalizeDivYield(card.dividendYield) ?? 0.025;

  const riskFree = 0.043;
  const capmReturn = (isValid(card.beta) && card.beta > 0 && card.beta < 3)
    ? riskFree + card.beta * MARKET_PREMIUM
    : MARKET_LONG_RUN;

  const boglePartial = divYield;
  let rate = (boglePartial * 0.3) + (capmReturn * 0.7);
  rate = Math.min(0.18, Math.max(0.01, rate));
  if (isConservative) rate *= 0.82;

  const dataSource = isValid(card.beta) && isValid(card.dividendYield) ? 'real' : 'estimated';

  return buildResult(card, rate, divYield, years, dataSource,
    'CAPM risk-adjusted market return using actual beta');
}

// ─── BOND ETFs: Treasury yield matched to hold period ─────────────────────────

function calcBondETFProjection(card, years, isConservative, treasuryRates) {
  let benchmarkRate;
  if (years <= 2)      benchmarkRate = treasuryRates?.twoYear  ?? 0.043;
  else if (years <= 5) benchmarkRate = treasuryRates?.fiveYear ?? 0.044;
  else                 benchmarkRate = treasuryRates?.tenYear  ?? 0.045;

  const knownYield  = BOND_ETF_KNOWN_YIELDS[card.ticker] ?? null;
  const actualYield = knownYield ?? normalizeDivYield(card.dividendYield);
  let rate;
  if (actualYield && actualYield > 0.01 && actualYield < 0.15) {
    rate = (actualYield * 0.6) + (benchmarkRate * 0.4);
  } else {
    rate = benchmarkRate;
  }

  if (isConservative) rate *= 0.90;

  const pessimisticRate = Math.max(0.005, rate - 0.015);
  const optimisticRate  = rate + 0.010;

  const incomeYield = actualYield ?? rate;
  const dataSource  = knownYield ? 'real' : actualYield ? 'real' : 'estimated';
  const maturityLabel = years <= 2 ? '2' : years <= 5 ? '5' : '10';

  return {
    baseRate:         rate,
    pessimisticRate,
    optimisticRate,
    baseValue:        Math.round(card._allocatedAmount * Math.pow(1 + rate, years)),
    pessimisticValue: Math.round(card._allocatedAmount * Math.pow(1 + pessimisticRate, years)),
    optimisticValue:  Math.round(card._allocatedAmount * Math.pow(1 + optimisticRate, years)),
    annualIncome:     Math.round(card._allocatedAmount * incomeYield),
    dataSource,
    methodology: `Live ${maturityLabel}-year Treasury yield from US Federal Reserve`,
    assetNote: 'Bond return based on current Treasury yield. Rising rates reduce bond prices.',
  };
}

// ─── REITs: Dividend yield + FFO growth ───────────────────────────────────────

function calcREITProjection(card, years, isConservative) {
  const divYield = normalizeDivYield(card.dividendYield) ?? 0.048;

  let ffoGrowth = null;
  if (isValid(card.revenueGrowth3Y))      ffoGrowth = card.revenueGrowth3Y;
  else if (isValid(card.revenueGrowth5Y)) ffoGrowth = card.revenueGrowth5Y;
  else ffoGrowth = 0.03;

  ffoGrowth = Math.min(0.15, Math.max(-0.10, ffoGrowth));

  const reitBogle = (divYield * 0.70) + (ffoGrowth * 0.30);

  const riskFree = 0.043;
  const capmReturn = (isValid(card.beta) && card.beta > 0 && card.beta < 3)
    ? riskFree + card.beta * MARKET_PREMIUM
    : 0.085;

  let rate = (reitBogle * 0.60) + (capmReturn * 0.40);
  rate = Math.min(0.18, Math.max(0.01, rate));
  if (isConservative) rate *= 0.85;

  const dataSource = isValid(card.dividendYield) && (isValid(card.revenueGrowth3Y) || isValid(card.revenueGrowth5Y))
    ? 'real' : 'estimated';

  return buildResult(card, rate, divYield, years, dataSource,
    'REIT model: dividend yield (70%) + FFO growth proxy (30%), CAPM-adjusted',
    'EPS excluded — depreciation distorts REIT earnings. Revenue growth used as FFO proxy.');
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function buildResult(card, rate, divYield, years, dataSource, methodology, assetNote = null) {
  const pessimisticRate = rate * 0.60;
  const optimisticRate  = rate * 1.40;
  return {
    baseRate:         rate,
    pessimisticRate,
    optimisticRate,
    baseValue:        Math.round(card._allocatedAmount * Math.pow(1 + rate, years)),
    pessimisticValue: Math.round(card._allocatedAmount * Math.pow(1 + pessimisticRate, years)),
    optimisticValue:  Math.round(card._allocatedAmount * Math.pow(1 + optimisticRate, years)),
    annualIncome:     Math.round(card._allocatedAmount * divYield),
    dataSource,
    methodology,
    assetNote,
  };
}

function normalizeDivYield(val) {
  if (val == null) return null;
  if (val > 25) return null; // data error guard
  return val / 100;
}

function isValid(val) {
  return val != null && !isNaN(val) && isFinite(val);
}
