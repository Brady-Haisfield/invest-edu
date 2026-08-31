const MARKET_LONG_RUN = 0.098;  // S&P 500 long-run nominal average — used only when
                                 // treasuryRates is entirely unavailable (e.g. FRED down)
const FALLBACK_RISK_FREE = 0.043; // static fallback when live 10-yr yield is unavailable

// Shared CAPM: risk-free rate + beta x (market return - risk-free rate).
// Both legs now use live data when available instead of static assumptions:
// - risk-free rate: live 10-year Treasury yield (treasuryRates.tenYear)
// - market return: live CAPE-derived S&P 500 forward return (treasuryRates.spyForwardReturn,
//   computed in fredService.js from the current Shiller CAPE ratio) instead of a fixed
//   historical average — this makes the implied equity risk premium responsive to today's
//   valuations rather than a constant 5.5%.
// Previously this gated out any beta >= 3 and fell back to a flat market-average return —
// which meant the highest-beta stocks (the ones a high-risk-tolerance profile is most
// likely to be shown) had their risk/return profile silently averaged away instead of
// actually priced in. Raised to a generous beta <= 6 sanity bound (guards against garbage
// data, e.g. a data error producing beta=50 on a thin-volume ticker) rather than excluding
// genuinely volatile real companies.
function calcCapmReturn(beta, treasuryRates) {
  const riskFree     = treasuryRates?.tenYear         ?? FALLBACK_RISK_FREE;
  const marketReturn = treasuryRates?.spyForwardReturn ?? MARKET_LONG_RUN;
  if (isValid(beta) && beta > 0) {
    // Clamp rather than exclude above the sanity bound — must match the same clamp
    // estimateAnnualVol uses below. Excluding beta entirely above the bound while
    // estimateAnnualVol kept scaling volatility up to it created a discontinuity: a
    // beta of 6.5 fell back to a flat market-rate return (low mu) while still getting
    // beta=6-level volatility (high sigma), which paradoxically produced a *narrower*
    // simulated range than beta 3.87 — found via direct testing across a beta sweep.
    return riskFree + Math.min(beta, 6) * (marketReturn - riskFree);
  }
  // No valid beta — use the live market return estimate directly rather than a flat constant.
  return marketReturn;
}

// ─── Monte Carlo range ──────────────────────────────────────────────────────
// Replaces the old fixed ±35%/65% (or analyst-high/low) multiplier for the
// pessimistic/optimistic scenario with an actual simulated distribution, driven by each
// security's own estimated volatility — the same approach robo-advisors (Schwab, etc.)
// use to show a real "better/average/worse" spread instead of one arbitrary number.
// Research: practitioners use Monte Carlo simulation with capital-market-assumption
// inputs to generate outcome ranges, not a flat percentage of the point estimate.

const MARKET_ANNUAL_VOL = 0.16;  // long-run S&P 500 annualized volatility (commonly cited ~15-20%)
const IDIOSYNCRATIC_VOL = 0.20;  // rule-of-thumb single-stock-specific volatility not captured by beta alone
const MC_SIMULATIONS    = 1000;

// Estimated annualized volatility per security, used as the Monte Carlo simulation input.
// No historical price series is available from the free-tier APIs this app uses, so this
// is a structural estimate rather than a measured one:
// - bond ETFs: duration-driven price sensitivity (bonds don't have an equity beta worth using)
// - diversified ETFs: beta x market volatility only (idiosyncratic risk is diversified away)
// - individual stocks/REITs: beta-driven (systematic) risk combined with a flat
//   idiosyncratic-risk assumption, since a single company's total volatility is
//   consistently higher than what its market beta alone implies.
function estimateAnnualVol(card) {
  if (card.type === 'bond_etf') {
    const dur = card.averageDuration ?? 5;
    return Math.min(0.25, Math.max(0.03, dur * 0.012));
  }
  const beta = (isValid(card.beta) && card.beta > 0) ? Math.min(card.beta, 6) : 1;
  if (card.type === 'etf') {
    return Math.max(0.05, beta * MARKET_ANNUAL_VOL);
  }
  return Math.sqrt((beta * MARKET_ANNUAL_VOL) ** 2 + IDIOSYNCRATIC_VOL ** 2);
}

// Box-Muller standard normal sampler.
function randNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Simulates MC_SIMULATIONS lognormal (geometric Brownian motion) terminal outcomes using
// the blended expected return as drift and the security's estimated volatility, then
// returns the 10th/90th percentile as the pessimistic/optimistic range.
function monteCarloRange(amount, annualReturn, annualVol, years) {
  if (!(amount > 0) || !(years > 0) || !(annualVol > 0)) {
    return { p10: amount, p90: amount };
  }
  const drift     = (annualReturn - 0.5 * annualVol * annualVol) * years;
  const diffusion = annualVol * Math.sqrt(years);
  const outcomes  = new Array(MC_SIMULATIONS);
  for (let i = 0; i < MC_SIMULATIONS; i++) {
    outcomes[i] = amount * Math.exp(drift + diffusion * randNormal());
  }
  outcomes.sort((a, b) => a - b);
  return {
    p10: outcomes[Math.floor(MC_SIMULATIONS * 0.10)],
    p90: outcomes[Math.floor(MC_SIMULATIONS * 0.90)],
  };
}

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
    default:         return calcStockProjection(card, totalYears, isConservative, treasuryRates);
  }
}

// ─── STOCKS: 4-source dynamic model ───────────────────────────────────────────

function calcStockProjection(card, years, isConservative, treasuryRates) {
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

  // SOURCE 3: CAPM — live risk-free rate + live market-return-derived premium, see
  // calcCapmReturn above. No longer excludes high-beta stocks.
  const capmReturn = calcCapmReturn(card.beta, treasuryRates);

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

  // Floor at 0%, ceiling at 40% — the ceiling is a numerical sanity guard (e.g. against a
  // corrupted analyst target or data glitch), not a real constraint on high-conviction
  // names; unlike the old beta<3 gate it doesn't quietly average away genuine high-beta,
  // high-growth companies below that threshold.
  blendedRate = Math.min(0.40, Math.max(0, blendedRate));
  if (isConservative) blendedRate *= 0.80;

  // Build data source label
  const sources = [];
  if (analystImpliedReturn != null)  sources.push('analyst price targets');
  if (growthSource === 'analyst')    sources.push('forward EPS estimates');
  else if (growthSource === 'historical') sources.push('historical earnings');
  if (isValid(card.newsSentimentScore)) sources.push('news sentiment');
  sources.push('CAPM');
  const dataSource = sources.join(' + ');

  return buildResult(card, blendedRate, divYield, years, dataSource,
    'Weighted blend of Wall St. analyst price targets (40%), Bogle fundamental model (35%), and CAPM (25%), adjusted for news sentiment');
}

// ─── ETFs: CAPM + optional holdings-weighted analyst targets + news sentiment ─

function calcETFProjection(card, years, isConservative, treasuryRates) {
  const divYield = BOND_ETF_KNOWN_YIELDS[card.ticker]
    ?? normalizeDivYield(card.dividendYield)
    ?? 0.025;

  const capmReturn = calcCapmReturn(card.beta, treasuryRates);

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

  const amount = card._allocatedAmount;
  const vol = estimateAnnualVol(card);
  const { p10, p90 } = monteCarloRange(amount, rate, vol, years);
  const pessimisticValue = Math.round(p10);
  const optimisticValue  = Math.round(p90);
  const pessimisticRate  = amount > 0 ? Math.pow(Math.max(pessimisticValue, 0) / amount, 1 / years) - 1 : 0;
  const optimisticRate   = amount > 0 ? Math.pow(Math.max(optimisticValue,  0) / amount, 1 / years) - 1 : 0;

  const incomeYield   = actualYield ?? rate;
  const maturityLabel = years <= 2 ? '2' : years <= 5 ? '5' : '10';
  const dataSource    = 'live Treasury yields + duration adjustment';

  return {
    baseRate:         rate,
    pessimisticRate,
    optimisticRate,
    baseValue:        Math.round(amount * Math.pow(1 + rate, years)),
    pessimisticValue,
    optimisticValue,
    annualIncome:     Math.round(amount * incomeYield),
    dataSource,
    methodology: `Live ${maturityLabel}-year Treasury yield from US Federal Reserve${durationDrag < 0 ? ', duration-adjusted for rate sensitivity' : ''} · range simulated via Monte Carlo (${(vol * 100).toFixed(0)}% est. annual volatility)`,
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

  const capmReturn = calcCapmReturn(card.beta, treasuryRates);

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

function buildResult(card, rate, divYield, years, dataSource, methodology, assetNote = null) {
  const amount = card._allocatedAmount;
  const vol = estimateAnnualVol(card);
  const { p10, p90 } = monteCarloRange(amount, rate, vol, years);
  const pessimisticValue = Math.round(p10);
  const optimisticValue  = Math.round(p90);
  // Equivalent annualized rates, derived from the simulated values, for display consistency.
  const pessimisticRate = amount > 0 ? Math.pow(Math.max(pessimisticValue, 0) / amount, 1 / years) - 1 : 0;
  const optimisticRate  = amount > 0 ? Math.pow(Math.max(optimisticValue,  0) / amount, 1 / years) - 1 : 0;
  return {
    baseRate:         rate,
    pessimisticRate,
    optimisticRate,
    baseValue:        Math.round(amount * Math.pow(1 + rate, years)),
    pessimisticValue,
    optimisticValue,
    annualIncome:     Math.round(amount * divYield),
    dataSource,
    methodology: `${methodology} · range simulated via Monte Carlo (${(vol * 100).toFixed(0)}% est. annual volatility)`,
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
