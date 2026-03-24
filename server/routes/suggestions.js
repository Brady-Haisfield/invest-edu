import { Router } from 'express';
import { validateInputs } from '../utils/validators.js';
import { getSuggestions } from '../services/claudeService.js';
import { getQuote } from '../services/yahooService.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const inputs = validateInputs(req.body);

    const suggestions = await getSuggestions(inputs);

    if (suggestions.length === 0) {
      const err = new Error('AI did not return any valid stock suggestions. Please try again.');
      err.statusCode = 502;
      throw err;
    }

    const quoteResults = await Promise.allSettled(
      suggestions.map((s) => getQuote(s.ticker))
    );

    const cards = suggestions.map((s, i) => {
      const result = quoteResults[i];
      if (result.status === 'rejected') {
        console.warn(`[Yahoo] Quote failed for ${s.ticker}:`, result.reason?.message);
        // Still return the card with just Claude's data — market data shows as N/A
        return { ticker: s.ticker, name: s.ticker, price: null, fiftyTwoWeekLow: null, fiftyTwoWeekHigh: null, peRatio: null, marketCap: null, sector: null, reasoning: s.reasoning };
      }
      return { ...result.value, reasoning: s.reasoning };
    });

    res.json({ cards });
  } catch (err) {
    next(err);
  }
});

export default router;
