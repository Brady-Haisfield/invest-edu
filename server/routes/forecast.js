import { Router } from 'express';
import { getStockData } from '../services/forecastService.js';
import { getForecast } from '../services/claudeService.js';

const router = Router();

const TICKER_RE = /^[A-Z]{1,5}$/;

router.post('/', async (req, res, next) => {
  try {
    const raw = req.body.ticker;
    if (!raw || typeof raw !== 'string') {
      const err = new Error('ticker is required.');
      err.statusCode = 400;
      throw err;
    }

    const ticker = raw.trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) {
      const err = new Error('ticker must be 1–5 uppercase letters (e.g. AAPL).');
      err.statusCode = 400;
      throw err;
    }

    const stockData = await getStockData(ticker);
    const forecast = await getForecast(stockData);

    res.json({
      forecast,
      ticker,
      companyName: stockData.profile.name,
      quote: stockData.quote,
      monthlyCloses: stockData.monthlyCloses.slice(-12),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
