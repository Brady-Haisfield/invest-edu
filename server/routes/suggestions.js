import { Router } from 'express';
import { validateInputs } from '../utils/validators.js';
import { getSuggestions } from '../services/claudeService.js';
import { getQuote } from '../services/yahooService.js';
import { getTreasuryRates } from '../services/fredService.js';
import { getAnalystData, getETFInfo, getPriceTarget, getAnalystSentiment, getETFHoldings } from '../services/fmpService.js';
import { getOverview, getNewsSentiment } from '../services/alphaService.js';

const router = Router();

function isValidNum(v) {
  return v != null && !isNaN(v) && isFinite(v);
}

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

    // ── Layer 1: Finnhub quotes ───────────────────────────────────────────────
    const quoteResults = await Promise.allSettled(
      suggestions.map((s) => getQuote(s.ticker))
    );

    // Build initial cards from Finnhub data
    const baseCards = suggestions.map((s, i) => {
      const result = quoteResults[i];
      const extra = {
        type:           s.type,
        portfolioRole:  s.portfolioRole,
        retirementLens: s.retirementLens,
        watchOut:       s.watchOut,
      };
      if (result.status === 'rejected') {
        console.warn(`[Finnhub] Quote failed for ${s.ticker}:`, result.reason?.message);
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

    // ── Layer 2: FMP — analyst estimates (stocks) or ETF info (ETFs) ─────────
    const fmpResults = await Promise.allSettled(
      baseCards.map((card) => {
        if (card.type === 'etf' || card.type === 'bond_etf') return getETFInfo(card.ticker);
        return getAnalystData(card.ticker);
      })
    );

    // ── Layer 3: Alpha Vantage — only when Finnhub + FMP left key fields null ─
    const alphaResults = await Promise.allSettled(
      baseCards.map((card, i) => {
        const fmpData = fmpResults[i].status === 'fulfilled' ? fmpResults[i].value : null;
        const needsDivYield  = !isValidNum(card.dividendYield) && !isValidNum(fmpData?.dividendYield);
        const needsBeta      = !isValidNum(card.beta);
        const needsRevGrowth = !isValidNum(card.revenueGrowth3Y) && !isValidNum(card.epsGrowth3Y);
        if (needsDivYield || needsBeta || needsRevGrowth) {
          return getOverview(card.ticker);
        }
        return Promise.resolve(null);
      })
    );

    // ── Layer 4: analyst enrichment (stocks) + holdings/news (ETFs/REITs) ─────
    const [ptResults, sentimentResults, newsResults, holdingsResults] = await Promise.all([
      // Price targets: stocks and REITs
      Promise.allSettled(baseCards.map((c) =>
        (c.type === 'stock' || c.type === 'reit') ? getPriceTarget(c.ticker) : Promise.resolve(null)
      )),
      // Analyst sentiment: stocks only
      Promise.allSettled(baseCards.map((c) =>
        c.type === 'stock' ? getAnalystSentiment(c.ticker) : Promise.resolve(null)
      )),
      // News sentiment: all card types
      Promise.allSettled(baseCards.map((c) => getNewsSentiment(c.ticker))),
      // ETF holdings: ETF and bond_etf only
      Promise.allSettled(baseCards.map((c) =>
        (c.type === 'etf' || c.type === 'bond_etf') ? getETFHoldings(c.ticker) : Promise.resolve(null)
      )),
    ]);

    // ── Layer 4b: for ETFs with holdings, fetch price targets + quotes ────────
    // Compute a holdings-weighted analyst implied return per ETF card.
    const etfHoldingsReturnResults = await Promise.allSettled(
      baseCards.map(async (card, i) => {
        if (card.type !== 'etf' && card.type !== 'bond_etf') return null;
        const holdings = holdingsResults[i].status === 'fulfilled' ? holdingsResults[i].value : null;
        if (!holdings || holdings.length === 0) return null;

        const top5 = holdings.slice(0, 5);
        const [ptData, quoteData] = await Promise.all([
          Promise.allSettled(top5.map((h) => getPriceTarget(h.ticker))),
          Promise.allSettled(top5.map((h) => getQuote(h.ticker))),
        ]);

        let totalWeight = 0;
        let weightedReturn = 0;
        top5.forEach((h, j) => {
          const pt = ptData[j].status    === 'fulfilled' ? ptData[j].value    : null;
          const q  = quoteData[j].status === 'fulfilled' ? quoteData[j].value : null;
          if (pt?.targetConsensus && q?.price && q.price > 0) {
            const impliedReturn = ((pt.targetConsensus - q.price) / q.price) * 0.6;
            weightedReturn += impliedReturn * h.weight;
            totalWeight    += h.weight;
          }
        });

        return totalWeight > 0 ? weightedReturn / totalWeight : null;
      })
    );

    // ── Merge all layers ──────────────────────────────────────────────────────
    const cards = baseCards.map((card, i) => {
      const fmpData            = fmpResults[i].status              === 'fulfilled' ? fmpResults[i].value              : null;
      const alphaData          = alphaResults[i].status            === 'fulfilled' ? alphaResults[i].value            : null;
      const ptData             = ptResults[i].status               === 'fulfilled' ? ptResults[i].value               : null;
      const sentimentData      = sentimentResults[i].status        === 'fulfilled' ? sentimentResults[i].value        : null;
      const newsData           = newsResults[i].status             === 'fulfilled' ? newsResults[i].value             : null;
      const etfHoldingsReturn  = etfHoldingsReturnResults[i].status === 'fulfilled' ? etfHoldingsReturnResults[i].value : null;

      // Enrich with FMP
      const enriched = { ...card };
      if (fmpData) {
        // For ETFs/bond_etfs: FMP expenseRatio and optional dividend yield
        if (fmpData.expenseRatio != null) enriched.expenseRatio = fmpData.expenseRatio;
        // FMP dividendYield fills in when Finnhub returned null
        if (!isValidNum(enriched.dividendYield) && isValidNum(fmpData.dividendYield)) {
          enriched.dividendYield = fmpData.dividendYield;
        }
        // FMP forward EPS growth estimate (stocks)
        if (fmpData.epsGrowthFwd != null) enriched.epsGrowthFwd = fmpData.epsGrowthFwd;
      }

      // Enrich with Alpha Vantage (fills only where still null)
      if (alphaData) {
        if (!isValidNum(enriched.dividendYield) && isValidNum(alphaData.dividendYield)) {
          enriched.dividendYield = alphaData.dividendYield;
        }
        if (!isValidNum(enriched.beta) && isValidNum(alphaData.beta)) {
          enriched.beta = alphaData.beta;
        }
        if (!isValidNum(enriched.revenueGrowth3Y) && isValidNum(alphaData.revGrowthYOY)) {
          enriched.revenueGrowth3Y = alphaData.revGrowthYOY;
        }
      }

      // Enrich with analyst price targets (stocks only)
      if (ptData) {
        enriched.priceTargetConsensus = ptData.targetConsensus;
        enriched.priceTargetHigh      = ptData.targetHigh;
        enriched.priceTargetLow       = ptData.targetLow;
      }

      // Enrich with analyst sentiment consensus (stocks only)
      if (sentimentData) {
        enriched.analystConsensus = sentimentData.consensus;
      }

      // News sentiment — all card types
      if (newsData) {
        enriched.newsSentimentScore = newsData.sentimentScore;
        enriched.newsSentimentLabel = newsData.sentimentLabel;
      }

      // ETF holdings-weighted analyst implied return
      if (etfHoldingsReturn != null) {
        enriched.etfHoldingsReturn = etfHoldingsReturn;
      }

      // Average duration from ETF info (bond ETFs)
      if (fmpData?.averageDuration != null) {
        enriched.averageDuration = fmpData.averageDuration;
      }

      return enriched;
    });

    // Debug: log key projection inputs for each card to identify pipeline failures
    console.log('[suggestions] Enriched card data:');
    cards.forEach((c) => {
      console.log(`  ${c.ticker} (${c.type}) | dividendYield=${c.dividendYield} | epsGrowthFwd=${c.epsGrowthFwd ?? 'n/a'} | epsGrowth3Y=${c.epsGrowth3Y} | revenueGrowth3Y=${c.revenueGrowth3Y} | beta=${c.beta} | expenseRatio=${c.expenseRatio ?? 'n/a'}`);
    });
    console.log('[suggestions] treasuryRates:', JSON.stringify(treasuryRates));

    res.json({ cards, advisorNarrative: advisorNarrative ?? null, treasuryRates });
  } catch (err) {
    next(err);
  }
});

export default router;
