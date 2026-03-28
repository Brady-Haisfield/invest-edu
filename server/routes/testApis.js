import { Router } from 'express';

const router = Router();

const FRED_BASE  = 'https://api.stlouisfed.org/fred/series/observations';
const FMP_BASE   = 'https://financialmodelingprep.com/api';
const ALPHA_BASE = 'https://www.alphavantage.co/query';

router.get('/', async (req, res) => {
  const FRED_KEY  = process.env.FRED_API_KEY;
  const FMP_KEY   = process.env.FMP_API_KEY;
  const ALPHA_KEY = process.env.ALPHA_VANTAGE_API_KEY;

  const results = {};

  // ── FRED ─────────────────────────────────────────────────────────────────────
  try {
    const [dgs10Res, capeRes] = await Promise.all([
      fetch(`${FRED_BASE}?series_id=DGS10&api_key=${FRED_KEY}&sort_order=desc&limit=1&file_type=json`).then(r => r.json()),
      fetch(`${FRED_BASE}?series_id=CAPE&api_key=${FRED_KEY}&sort_order=desc&limit=1&file_type=json`).then(r => r.json()),
    ]);
    results.fred = {
      DGS10: dgs10Res?.observations?.[0] ?? dgs10Res,
      CAPE:  capeRes?.observations?.[0]  ?? capeRes,
    };
  } catch (err) {
    results.fred = { error: err.message };
  }

  // ── FMP ──────────────────────────────────────────────────────────────────────
  try {
    const data = await fetch(`${FMP_BASE}/v3/analyst-estimates/AAPL?limit=2&apikey=${FMP_KEY}`).then(r => r.json());
    results.fmp = Array.isArray(data) ? data.slice(0, 2) : data;
  } catch (err) {
    results.fmp = { error: err.message };
  }

  // ── Alpha Vantage ─────────────────────────────────────────────────────────────
  try {
    const data = await fetch(`${ALPHA_BASE}?function=OVERVIEW&symbol=AAPL&apikey=${ALPHA_KEY}`).then(r => r.json());
    // Return only the fields we actually use, plus any rate-limit message
    results.alphaVantage = data.Information
      ? { rateLimitMessage: data.Information }
      : {
          Symbol:                      data.Symbol,
          Name:                        data.Name,
          Beta:                        data.Beta,
          DividendYield:               data.DividendYield,
          QuarterlyRevenueGrowthYOY:   data.QuarterlyRevenueGrowthYOY,
          ForwardPE:                   data.ForwardPE,
        };
  } catch (err) {
    results.alphaVantage = { error: err.message };
  }

  res.json(results);
});

export default router;
