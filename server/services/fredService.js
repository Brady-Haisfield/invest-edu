const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let cachedRates = null;
let cacheTime = null;

export async function getTreasuryRates() {
  if (cachedRates && Date.now() - cacheTime < CACHE_TTL) {
    return cachedRates;
  }

  const FRED_KEY = process.env.FRED_API_KEY;
  const series = ['DGS2', 'DGS5', 'DGS10'];

  const results = await Promise.allSettled(
    series.map((id) =>
      fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&sort_order=desc&limit=1&file_type=json`
      ).then((r) => r.json())
    )
  );

  const [twoYear, fiveYear, tenYear] = results.map((r) => {
    if (r.status !== 'fulfilled') return null;
    const val = parseFloat(r.value?.observations?.[0]?.value);
    return isNaN(val) ? null : val / 100;
  });

  const rates = {
    twoYear:  twoYear  ?? 0.043,
    fiveYear: fiveYear ?? 0.044,
    tenYear:  tenYear  ?? 0.045,
  };

  cachedRates = rates;
  cacheTime = Date.now();
  return cachedRates;
}
