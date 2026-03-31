const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let cachedRates = null;
let cacheTime = null;

// Shiller CAPE is not available as a FRED series.
// Using a current hardcoded estimate (updated periodically).
// As of March 2026, S&P 500 CAPE ≈ 36, dividend yield ≈ 1.3%.
const CAPE_ESTIMATE   = 36;
const SP500_DIV_YIELD = 0.013;

export async function getTreasuryRates() {
  if (cachedRates && Date.now() - cacheTime < CACHE_TTL) {
    console.log('[FRED] cache hit:', true, 'spyForwardReturn:', (cachedRates.spyForwardReturn * 100).toFixed(2) + '%');
    return cachedRates;
  }
  console.log('[FRED] cache hit:', false, '— fetching fresh rates');

  const FRED_KEY = process.env.FRED_API_KEY;

  // DGS2/5/10 = US Treasury yields (in %, e.g. 4.42 → 0.0442)
  // T10YIE    = 10-year breakeven inflation rate (in %, e.g. 2.31 → 0.0231)
  const series = ['DGS2', 'DGS5', 'DGS10', 'T10YIE'];

  const results = await Promise.allSettled(
    series.map((id) =>
      fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&sort_order=desc&limit=1&file_type=json`
      ).then((r) => r.json())
    )
  );

  function parseObs(r) {
    if (r.status !== 'fulfilled') return null;
    const val = parseFloat(r.value?.observations?.[0]?.value);
    return isNaN(val) ? null : val;
  }

  const [dgs2, dgs5, dgs10, t10yieRaw] = results.map(parseObs);

  // Treasury yields from FRED are in %, divide by 100
  const twoYear  = dgs2  != null ? dgs2  / 100 : 0.043;
  const fiveYear = dgs5  != null ? dgs5  / 100 : 0.044;
  const tenYear  = dgs10 != null ? dgs10 / 100 : 0.045;

  // T10YIE is in %, divide by 100
  const inflationExpect = t10yieRaw != null ? t10yieRaw / 100 : 0.025;

  // Shiller earnings yield + dividend buffer + inflation expectations
  const earningsYield    = 1 / CAPE_ESTIMATE;
  const spyForwardReturn = Math.min(0.15, Math.max(0.02, earningsYield + 0.015 + inflationExpect));

  console.log(`[fredService] DGS10=${dgs10 ?? 'fallback'} | T10YIE=${t10yieRaw ?? 'fallback'} | CAPE=${CAPE_ESTIMATE}(est) | spyForwardReturn=${(spyForwardReturn * 100).toFixed(2)}%`);

  const rates = {
    twoYear,
    fiveYear,
    tenYear,
    cape:          CAPE_ESTIMATE,
    sp500DivYield: SP500_DIV_YIELD,
    inflationExpect,
    spyForwardReturn,
  };

  cachedRates = rates;
  cacheTime = Date.now();
  return cachedRates;
}
