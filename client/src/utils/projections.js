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
  console.log('[projections] ticker:', card.ticker, '| dividendYield:', card.dividendYield, '| epsGrowthFwd:', card.epsGrowthFwd ?? 'n/a');
  switch (card.type) {
    case 'bond_etf': return calcBondETFProjection(card, totalYears, isConservative, treasuryRates);
    case 'reit':     return calcREITProjection(card, totalYears, isConservative, treasuryRates);
    case 'etf':      return calcETFProjection(card, totalYears, isConservative, treasuryRates);
    case 'stock':
    default:         return calcStockProjection(card, totalYears, isConservative);
  }
}

// ─── STOCKS: 4-source dynamic model ───────────────────────────────────────────

function calcStockProjection(card, years, isConservative) {
  // SOURCE 1: Analyst price target implied return (most forward-looking)
  let analystImpliedReturn = null;
  if (isValid(card.priceTargetConsensus) && isValid(card.price) && card.price > 0) {
    const impliedOneYear = (card.priceTargetConsensus - card.price) / card.price;
    // Analyst targets are 12-month; assume mean reversion at 60% for multi-year hold
    analystImpliedReturn = impliedOneYear * 0.6;
  }

  // SOURCE 2: Bogle model (dividend yield + forward EPS growth)
  const divYield = normalizeDivYield(card.dividendYield) ?? 0.018;
  let earningsGrowth;
  let growthSource;
  if (isValid(card.epsGrowthFwd)) {
    earningsGrowth = card.epsGrowthFwd;
    growthSource = 'analyst';
  } else if (isValid(card.epsGrowth3Y)) {
    earningsGrowth = card.epsGrowth3Y;
    growthSource = 'historical';
  } else if (isValid(card.revenueGrowth3Y)) {
    earningsGrowth = card.revenueGrowth3Y;
    growthSource = 'historical';
  } else {
    earningsGrowth = 0.065;
    growthSource = 'industry';
  }
  earningsGrowth = Math.min(0.25, Math.max(-0.15, earningsGrowth));
  const bogleReturn = divYield + earningsGrowth;

  // SOURCE 3: CAPM
  const riskFree = 0.043;
  const capmReturn = (isValid(card.beta) && card.beta > 0 && card.beta < 3)
    ? riskFree + card.beta * MARKET_PREMIUM
    : MARKET_LONG_RUN;

  // SOURCE 4: News sentiment nudge (−1.5% to +1.5%)
  const sentimentAdj = isValid(card.newsSentimentScore)
    ? card.newsSentimentScore * 0.015
    : 0;

  // Blend — analyst targets carry most weight when available
  let blendedRate;
  if (analystImpliedReturn != null) {
    blendedRate = (analystImpliedReturn * 0.40) +
                  (bogleReturn          * 0.35) +
                  (capmReturn           * 0.25) +
                  sentimentAdj;
  } else {
    blendedRate = (bogleReturn * 0.50) +
                  (capmReturn  * 0.50) +
                  sentimentAdj;
  }

  // Floor at 0% — time diversifies short-term losses on a long hold
  blendedRate = Math.max(0, blendedRate);
  if (isConservative) blendedRate *= 0.80;

  // Scenarios: use actual analyst high/low if available, else ±35% of base
  let pessimisticRate, optimisticRate;
  if (isValid(card.priceTargetLow) && isValid(card.priceTargetHigh) && isValid(card.price) && card.price > 0) {
    pessimisticRate = Math.max(0, ((card.priceTargetLow  - card.price) / card.price) * 0.6);
    optimisticRate  =              ((card.priceTargetHigh - card.price) / card.price) * 0.6;
    if (isConservative) {
      pessimisticRate *= 0.80;
      optimisticRate  *= 0.80;
    }
  } else {
    pessimisticRate = Math.max(0, blendedRate * 0.65);
    optimisticRate  = blendedRate * 1.35;
  }

  // Build data source label
  const sources = [];
  if (analystImpliedReturn != null)  sources.push('analyst price targets');
  if (growthSource === 'analyst')    sources.push('forward EPS estimates');
  else if (growthSource === 'historical') sources.push('historical earnings');
  if (isValid(card.newsSentimentScore)) sources.push('news sentiment');
  sources.push('CAPM');
  const dataSource = sources.join(' + ');

  return buildResult(card, blendedRate, divYield, years, dataSource,
    'Weighted blend of Wall St. analyst price targets (40%), Bogle fundamental model (35%), and CAPM (25%), adjusted for news sentiment',
    null, pessimisticRate, optimisticRate);
}

// ─── ETFs: CAPM + optional holdings-weighted analyst targets + news sentiment ─

function calcETFProjection(card, years, isConservative, treasuryRates) {
  const divYield = BOND_ETF_KNOWN_YIELDS[card.ticker]
    ?? normalizeDivYield(card.dividendYield)
    ?? 0.025;

  const riskFree = 0.043;
  let capmReturn;
  if (isValid(card.beta) && card.beta > 0 && card.beta < 3) {
    capmReturn = riskFree + card.beta * MARKET_PREMIUM;
  } else if (treasuryRates?.spyForwardReturn) {
    capmReturn = treasuryRates.spyForwardReturn;
  } else {
    capmReturn = MARKET_LONG_RUN;
  }

  const baseRate = (divYield * 0.3) + (capmReturn * 0.7);

  // Blend in holdings-weighted analyst implied return at 30% when available
  let rate;
  const hasHoldings = isValid(card.etfHoldingsReturn);
  if (hasHoldings) {
    rate = (card.etfHoldingsReturn * 0.30) + (baseRate * 0.70);
  } else {
    rate = baseRate;
  }

  // News sentiment nudge ±1.5%
  const sentimentAdj = isValid(card.newsSentimentScore) ? card.newsSentimentScore * 0.015 : 0;
  rate = rate + sentimentAdj;

  rate = Math.min(0.18, Math.max(0.01, rate));
  if (isConservative) rate *= 0.82;

  const hasRealData = isValid(card.beta) && isValid(card.dividendYield);
  const usedCape    = !isValid(card.beta) && !!treasuryRates?.spyForwardReturn;
  const hasSentiment = isValid(card.newsSentimentScore);

  let dataSource;
  if (hasHoldings) {
    dataSource = 'holdings-weighted analyst targets + CAPM' + (hasSentiment ? ' + news sentiment' : '');
  } else if (hasSentiment) {
    dataSource = 'CAPM market model + news sentiment';
  } else if (hasRealData) {
    dataSource = 'market data';
  } else if (usedCape) {
    dataSource = 'Shiller CAPE market estimate';
  } else {
    dataSource = 'industry average';
  }

  const methodNote = hasHoldings
    ? 'Holdings-weighted analyst price targets (30%) blended with CAPM (70%), adjusted for news sentiment'
    : usedCape
      ? 'Shiller CAPE earnings yield + inflation expectations'
      : 'CAPM risk-adjusted market return using actual beta';

  return buildResult(card, rate, divYield, years, dataSource, methodNote);
}

// ─── BOND ETFs: Treasury yield + duration adjustment + news sentiment ─────────

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

  // Duration-based interest rate sensitivity adjustment.
  // If duration > 7 years, long-duration bonds are sensitive to rate moves.
  // Rate change estimate = amount inflation expectations exceed the 2% Fed target.
  // Formula: annual drag = -(duration × rateChangeEstimate) / years  (one-time price impact annualised)
  let durationDrag = 0;
  let durationNote = null;
  const dur = card.averageDuration ?? null;
  if (dur != null && dur > 7 && treasuryRates?.inflationExpect) {
    const rateChangeEstimate = Math.max(0, treasuryRates.inflationExpect - 0.02);
    if (rateChangeEstimate > 0) {
      durationDrag = -(dur * rateChangeEstimate) / years;
      durationNote = `Duration ${dur.toFixed(1)} yrs — rate sensitivity applied`;
    }
  }

  // News sentiment nudge ±1.5%
  const sentimentAdj = isValid(card.newsSentimentScore) ? card.newsSentimentScore * 0.015 : 0;

  rate = Math.max(0.005, rate + durationDrag + sentimentAdj);

  const pessimisticRate = Math.max(0.005, rate - 0.015);
  const optimisticRate  = rate + 0.010;

  const incomeYield   = actualYield ?? rate;
  const maturityLabel = years <= 2 ? '2' : years <= 5 ? '5' : '10';
  const dataSource    = 'live Treasury yields + duration adjustment';

  return {
    baseRate:         rate,
    pessimisticRate,
    optimisticRate,
    baseValue:        Math.round(card._allocatedAmount * Math.pow(1 + rate, years)),
    pessimisticValue: Math.round(card._allocatedAmount * Math.pow(1 + pessimisticRate, years)),
    optimisticValue:  Math.round(card._allocatedAmount * Math.pow(1 + optimisticRate, years)),
    annualIncome:     Math.round(card._allocatedAmount * incomeYield),
    dataSource,
    methodology: `Live ${maturityLabel}-year Treasury yield from US Federal Reserve${durationDrag < 0 ? ', duration-adjusted for rate sensitivity' : ''}`,
    assetNote: durationNote ?? 'Bond return based on current Treasury yield. Rising rates reduce bond prices.',
  };
}

// ─── REITs: analyst targets + dividend yield + FFO growth + yield spread ──────

function calcREITProjection(card, years, isConservative, treasuryRates) {
  const divYield = normalizeDivYield(card.dividendYield) ?? 0.048;

  // FFO growth proxy
  let ffoGrowth;
  if (isValid(card.revenueGrowth3Y))      ffoGrowth = card.revenueGrowth3Y;
  else if (isValid(card.revenueGrowth5Y)) ffoGrowth = card.revenueGrowth5Y;
  else ffoGrowth = 0.03;
  ffoGrowth = Math.min(0.15, Math.max(-0.10, ffoGrowth));

  const reitBogle = (divYield * 0.70) + (ffoGrowth * 0.30);

  const riskFree   = 0.043;
  const capmReturn = (isValid(card.beta) && card.beta > 0 && card.beta < 3)
    ? riskFree + card.beta * MARKET_PREMIUM
    : 0.085;

  // Enhancement 1 — analyst price target implied return
  let analystImpliedReturn = null;
  if (isValid(card.priceTargetConsensus) && isValid(card.price) && card.price > 0) {
    analystImpliedReturn = ((card.priceTargetConsensus - card.price) / card.price) * 0.6;
  }

  let blendedRate;
  if (analystImpliedReturn != null) {
    blendedRate = (analystImpliedReturn * 0.35) +
                  (reitBogle           * 0.40) +
                  (capmReturn          * 0.25);
  } else {
    blendedRate = (reitBogle * 0.60) + (capmReturn * 0.40);
  }

  // News sentiment nudge ±1.5%
  blendedRate += isValid(card.newsSentimentScore) ? card.newsSentimentScore * 0.015 : 0;

  // Enhancement 2 — yield spread vs live 10-year Treasury
  const tenYearRate  = treasuryRates?.tenYear ?? 0.045;
  const yieldSpread  = divYield - tenYearRate;
  let spreadAdj      = 0;
  if      (yieldSpread >  0.02) spreadAdj =  0.005; // REIT yield well above Treasuries — attractive
  else if (yieldSpread <  0)    spreadAdj = -0.010; // Treasury yield > REIT yield — expensive vs risk-free

  blendedRate = Math.min(0.18, Math.max(0.01, blendedRate + spreadAdj));
  if (isConservative) blendedRate *= 0.85;

  // Data source label
  const hasRealData    = isValid(card.dividendYield) && (isValid(card.revenueGrowth3Y) || isValid(card.revenueGrowth5Y));
  const hasAnalyst     = analystImpliedReturn != null;
  const hasSentiment   = isValid(card.newsSentimentScore);

  const sourceParts = [];
  if (hasAnalyst)   sourceParts.push('analyst price targets');
  if (hasRealData)  sourceParts.push('dividend yield + FFO growth proxy');
  else              sourceParts.push('industry average');
  sourceParts.push('REIT yield spread vs live Treasury rate');
  if (hasSentiment) sourceParts.push('news sentiment');
  const dataSource = sourceParts.join(' + ');

  const spreadNote = yieldSpread > 0.02
    ? `Yield spread +${(yieldSpread * 100).toFixed(1)}% above 10-yr Treasury — REIT looks attractive vs bonds`
    : yieldSpread < 0
      ? `Yield spread ${(yieldSpread * 100).toFixed(1)}% below 10-yr Treasury — Treasury yields competing with REIT income`
      : null;

  return buildResult(card, blendedRate, divYield, years, dataSource,
    hasAnalyst
      ? 'REIT model: analyst targets (35%) + Bogle dividend+FFO (40%) + CAPM (25%), yield spread vs Treasury applied'
      : 'REIT model: dividend yield (70%) + FFO growth proxy (30%), CAPM-adjusted, yield spread vs Treasury applied',
    spreadNote ?? 'EPS excluded — depreciation distorts REIT earnings. Revenue growth used as FFO proxy.');
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function buildResult(card, rate, divYield, years, dataSource, methodology, assetNote = null, pessimisticOverride = null, optimisticOverride = null) {
  const pessimisticRate = pessimisticOverride ?? rate * 0.60;
  const optimisticRate  = optimisticOverride  ?? rate * 1.40;
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
