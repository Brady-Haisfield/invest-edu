// Builds a live, real-ticker candidate pool for the suggestions feature so Claude
// picks from actual current holdings + fundamentals instead of its training memory.
//
// No screener/universe endpoint exists on Finnhub/FMP/Alpha Vantage's free tiers.
// FMP's ETF-holdings endpoint was the original plan but is not available on this
// account's plan — confirmed by direct testing: /stable/etf-holdings 404s,
// /stable/etf/holdings 402s ("Restricted Endpoint... upgrade your plan"). Instead this
// sources candidates from Finnhub's /stock/peers (already used in forecastService.js
// for sector P/E), seeded from 2 well-known anchor tickers per sector — a single
// anchor returns only a narrow sub-industry (e.g. AAPL's peers are storage/hardware
// names, not broad "big tech"), so 2 anchors per sector gives real breadth.

import { getPeers, getQuote } from './finnhubService.js';

// Market-structure metadata (recognizable large-caps per sector, used only to seed
// Finnhub's peer lookup) — not a stock pick in itself; the actual candidates are
// whatever real peers Finnhub returns for these seeds.
export const SECTOR_ANCHOR_MAP = {
  'Technology':  ['MSFT', 'NVDA'],
  'Healthcare':  ['UNH', 'JNJ'],
  'Finance':     ['JPM', 'V'],
  'Energy':      ['XOM', 'CVX'],
  'Consumer':    ['AMZN', 'COST'],
  'Utilities':   ['NEE'],
  'Real Estate': ['PLD'],
  'Industrials': ['CAT'],
  'Materials':   ['LIN'],
};

// Used when the user didn't specify a sector preference — broad spread of growth/defensive.
const DEFAULT_ANCHORS = ['MSFT', 'UNH', 'AMZN'];

// Fixed core instruments already named in claudeService's SYSTEM_PROMPT rules
// (debt rule -> VGSH, RULE 0b TIPS replacement -> SCHP, renter rule -> VNQ, etc.)
export const CORE_TICKERS = ['VTI', 'SCHD', 'BND', 'VGSH', 'SCHP', 'VNQ'];

const CORE_TICKER_TYPES = {
  VTI:  'etf',
  SCHD: 'etf',
  BND:  'bond_etf',
  VGSH: 'bond_etf',
  SCHP: 'bond_etf',
  VNQ:  'reit',
};

const PEERS_PER_ANCHOR = 6;
const MAX_ANCHORS       = 6;  // e.g. 3 matched sectors x up to 2 anchors each
const MAX_POOL_SIZE     = 45; // safety cap on final quote-fetch fanout

function resolveAnchors(sectors) {
  if (!sectors || sectors.length === 0) return DEFAULT_ANCHORS;
  const mapped = sectors.slice(0, 3).flatMap((s) => SECTOR_ANCHOR_MAP[s] ?? []);
  const unique = [...new Set(mapped)].slice(0, MAX_ANCHORS);
  return unique.length > 0 ? unique : DEFAULT_ANCHORS;
}

// Returns [] on total failure — callers should fall back to unconstrained picking.
export async function buildCandidatePool(inputs) {
  try {
    const anchors = resolveAnchors(inputs?.sectors);

    const peerResults = await Promise.allSettled(anchors.map((a) => getPeers(a)));

    const tickers = new Set();
    anchors.forEach((a) => tickers.add(a)); // anchors themselves are legitimate candidates
    peerResults.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      r.value.slice(0, PEERS_PER_ANCHOR).forEach((t) => tickers.add(t));
    });
    CORE_TICKERS.forEach((t) => tickers.add(t));

    const tickerList = [...tickers].slice(0, MAX_POOL_SIZE);
    if (tickerList.length === 0) return [];

    const quoteResults = await Promise.allSettled(tickerList.map((t) => getQuote(t)));

    const pool = [];
    tickerList.forEach((ticker, i) => {
      const r = quoteResults[i];
      if (r.status !== 'fulfilled') {
        console.warn(`[candidatePoolService] quote failed for ${ticker}:`, r.reason?.message);
        return;
      }
      const q = r.value;
      pool.push({
        ticker,
        name:          q.name,
        sector:        q.sector,
        type:          CORE_TICKER_TYPES[ticker] ?? 'stock',
        price:         q.price,
        peRatio:       q.peRatio,
        marketCap:     q.marketCap,
        dividendYield: q.dividendYield,
        beta:          q.beta,
      });
    });

    console.log(`[candidatePoolService] pool built: ${pool.length} candidates from anchors [${anchors.join(', ')}]`);
    return pool;
  } catch (err) {
    console.warn('[candidatePoolService] pool build failed, will fall back to unconstrained picking:', err.message);
    return [];
  }
}
