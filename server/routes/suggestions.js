import { Router } from 'express';
import { validateInputs } from '../utils/validators.js';
import { getSuggestions } from '../services/claudeService.js';
import { getQuote } from '../services/yahooService.js';
import { getTreasuryRates } from '../services/fredService.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const inputs = validateInputs(req.body);

    // Fetch suggestions and treasury rates in parallel
    const [suggestionsResult, treasuryResult] = await Promise.allSettled([
      getSuggestions(inputs),
      getTreasuryRates(),
    ]);

    if (suggestionsResult.status === 'rejected') throw suggestionsResult.reason;
    const { advisorNarrative, suggestions } = suggestionsResult.value;
    const treasuryRates = treasuryResult.status === 'fulfilled' ? treasuryResult.value : null;

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
      const extra = {
        type: s.type,
        portfolioRole: s.portfolioRole,
        retirementLens: s.retirementLens,
        watchOut: s.watchOut,
      };
      if (result.status === 'rejected') {
        console.warn(`[Yahoo] Quote failed for ${s.ticker}:`, result.reason?.message);
        return {
          ticker: s.ticker, name: s.ticker, price: null, fiftyTwoWeekLow: null,
          fiftyTwoWeekHigh: null, peRatio: null, marketCap: null, sector: null,
          revenueGrowth3Y: null, revenueGrowth5Y: null, dividendYield: null,
          beta: null, grossMarginTTM: null, epsGrowth3Y: null,
          operatingCashFlow: null, freeCashFlow: null, ffo: null, sharesOutstanding: null,
          reasoning: s.reasoning, ...extra,
        };
      }
      return { ...result.value, reasoning: s.reasoning, ...extra };
    });

    res.json({ cards, advisorNarrative: advisorNarrative ?? null, treasuryRates });
  } catch (err) {
    next(err);
  }
});

export default router;
