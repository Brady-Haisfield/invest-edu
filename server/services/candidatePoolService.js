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
const DEFAULT_ANCHORS = ['MSFT', 'UNH', 'AMZN', 'JPM'];

// Added on top of sector anchors only when risk tolerance is "high" — chosen because
// their Finnhub peer lists reliably surface real, smaller/higher-beta companies rather
// than more mega-caps, regardless of which sector the user picked. Verified directly
// (biotech, quantum/emerging-tech, semiconductor-equipment sub-industries); a few other
// candidates tried (RBLX, COIN, SOFI) didn't pan out — COIN's peers are large financial
// exchanges, RBLX's peer list is mostly unfamiliar/likely-illiquid tickers.
const HIGH_RISK_ARCHETYPE_ANCHORS = ['MRNA', 'IONQ', 'ENPH'];

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

// Finnhub's peer lists are ranked by similarity, not market cap — smaller/newer names
// often sit near the end (e.g. behind MSFT: ...FTNT, GEN, FROG, PATH, S — the last one,
// SentinelOne, is far smaller/higher-beta than MSFT itself). PEERS_PER_ANCHOR was 6,
// which cut the list before reaching those — raised to 8 so genuinely volatile options
// actually make it into the pool for high-risk-tolerance users instead of only mega-caps.
const PEERS_PER_ANCHOR = 8;
const MAX_ANCHORS       = 6;  // sector anchors: e.g. 3 matched sectors x up to 2 anchors each
const MAX_POOL_SIZE     = 75; // safety cap on final quote-fetch fanout (raised for archetype anchors)

// No new data source — beta and marketCap are already fetched for every candidate.
// Market cap is the primary signal for "not very known" (a $5T company with beta 2.2,
// like NVDA, is extremely famous — flagging it as "speculative" would defeat the point).
// Beta is a secondary filter to exclude sleepy small-caps that just happen to be small.
const SPECULATIVE_CAP_MAX  = 30e9; // $30B — below typical mega/large-cap territory
const SPECULATIVE_BETA_MIN = 1.3;  // still meaningfully more volatile than the market

function resolveSectorAnchors(sectors) {
  if (!sectors || sectors.length === 0) return DEFAULT_ANCHORS;
  const mapped = sectors.slice(0, 3).flatMap((s) => SECTOR_ANCHOR_MAP[s] ?? []);
  const unique = [...new Set(mapped)].slice(0, MAX_ANCHORS);
  return unique.length > 0 ? unique : DEFAULT_ANCHORS;
}

function resolveAnchors(inputs) {
  const sectorAnchors = resolveSectorAnchors(inputs?.sectors);
  if (inputs?.riskProfile !== 'high') return sectorAnchors;
  return [...new Set([...sectorAnchors, ...HIGH_RISK_ARCHETYPE_ANCHORS])];
}

// Returns [] on total failure — callers should fall back to unconstrained picking.
export async function buildCandidatePool(inputs) {
  try {
    const anchors = resolveAnchors(inputs);

    const peerResults = await Promise.allSettled(anchors.map((a) => getPeers(a)));

    // CORE_TICKERS added first so they're never dropped by the MAX_POOL_SIZE truncation
    // below — the behavioral rules depend on them (VGSH for debt, SCHP for TIPS, etc.).
    const tickers = new Set();
    CORE_TICKERS.forEach((t) => tickers.add(t));
    anchors.forEach((a) => tickers.add(a)); // anchors themselves are legitimate candidates
    peerResults.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      r.value.slice(0, PEERS_PER_ANCHOR).forEach((t) => tickers.add(t));
    });

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
      const isCore = CORE_TICKER_TYPES[ticker] != null;
      const speculative = !isCore
        && q.marketCap != null && q.marketCap < SPECULATIVE_CAP_MAX
        && (q.beta == null || q.beta >= SPECULATIVE_BETA_MIN);
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
        speculative,
      });
    });

    const specCount = pool.filter((c) => c.speculative).length;
    console.log(`[candidatePoolService] pool built: ${pool.length} candidates (${specCount} high-volatility) from anchors [${anchors.join(', ')}]`);
    return pool;
  } catch (err) {
    console.warn('[candidatePoolService] pool build failed, will fall back to unconstrained picking:', err.message);
    return [];
  }
}
