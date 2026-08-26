// Builds a live, real-ticker candidate pool for the suggestions feature so Claude
// picks from actual current holdings + fundamentals instead of its training memory.
//
// Primary source: the pre-computed market_universe table (see universeService.js and
// jobs/universeRefreshJob.js), which is seeded from Finnhub's full ~25,000-ticker US
// symbol list and refreshed with live fundamentals a batch at a time in the background —
// this is what actually answers "give Meridian access to every publicly traded company/ETF
// you could invest in at a regular brokerage." Falls back to live Finnhub /stock/peers
// lookups (the original approach) when the universe table doesn't have enough coverage
// yet for a given sector — e.g. early in the rolling refresh, or right after first deploy.
//
// FMP's ETF-holdings endpoint was evaluated for sourcing candidates and is not available
// on this account's plan — confirmed by direct testing: /stable/etf-holdings 404s,
// /stable/etf/holdings 402s ("Restricted Endpoint... upgrade your plan").

import { getPeers, getQuote } from './finnhubService.js';
import { queryUniverse } from './universeService.js';

// Market-structure metadata (recognizable large-caps per sector, used only to seed
// Finnhub's peer lookup in the fallback path) — not a stock pick in itself.
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

// Applied on top of whichever base pool (universe or fallback) whenever risk tolerance is
// "high" — targets specific sub-industries (biotech, quantum, semiconductor-equipment)
// that a generic sector query or peer-lookup may still under-represent. Verified directly;
// a few other candidates tried (RBLX, COIN, SOFI) didn't pan out — COIN's peers are large
// financial exchanges, RBLX's peer list is mostly unfamiliar/likely-illiquid tickers.
const HIGH_RISK_ARCHETYPE_ANCHORS = ['MRNA', 'IONQ', 'ENPH'];

// Real REIT variety for renters — the existing "mention REIT exposure... include at least
// 1 REIT" behavioral rule (claudeService.js) previously had almost nothing real to choose
// from besides VNQ every time. Used as a fallback anchor when the universe table doesn't
// have REIT coverage yet; 'O' (Realty Income) is a well-known, liquid individual REIT.
const RENTER_REIT_ANCHORS = ['PLD', 'O'];

// Fixed core instruments already named in claudeService's SYSTEM_PROMPT rules
// (debt rule -> VGSH, RULE 0b TIPS replacement -> SCHP, renter rule -> VNQ, etc.) —
// always guaranteed present in the final pool regardless of which path built the rest.
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
// SentinelOne, is far smaller/higher-beta than MSFT itself), so this is generous enough
// to reach them.
const PEERS_PER_ANCHOR = 8;
const MAX_ANCHORS       = 6;  // sector anchors: e.g. 3 matched sectors x up to 2 anchors each
const MAX_POOL_SIZE     = 75; // safety cap on fallback-path quote-fetch fanout

// Below this many matching rows, the universe table doesn't have enough coverage yet for
// this query (e.g. early in the rolling refresh) — prefer the live peer-lookup fallback.
const MIN_UNIVERSE_ROWS = 15;

// No new data source — beta and marketCap are already fetched for every candidate.
// Market cap is the primary signal for "not very known" (a $5T company with beta 2.2,
// like NVDA, is extremely famous — flagging it as "speculative" would defeat the point).
// Beta is a secondary filter to exclude sleepy small-caps that just happen to be small.
const SPECULATIVE_CAP_MAX  = 30e9; // $30B — below typical mega/large-cap territory
const SPECULATIVE_BETA_MIN = 1.3;  // still meaningfully more volatile than the market

function flagSpeculative(ticker, marketCap, beta) {
  const isCore = CORE_TICKER_TYPES[ticker] != null;
  return !isCore
    && marketCap != null && marketCap < SPECULATIVE_CAP_MAX
    && (beta == null || beta >= SPECULATIVE_BETA_MIN);
}

function resolveSectorAnchors(sectors) {
  if (!sectors || sectors.length === 0) return DEFAULT_ANCHORS;
  const mapped = sectors.slice(0, 3).flatMap((s) => SECTOR_ANCHOR_MAP[s] ?? []);
  const unique = [...new Set(mapped)].slice(0, MAX_ANCHORS);
  return unique.length > 0 ? unique : DEFAULT_ANCHORS;
}

// Builds candidates from live quotes for a given anchor list plus their Finnhub peers.
// Shared by the full live-peer fallback path, the high-risk archetype top-up, and the
// renter REIT top-up (defaultType lets that last case tag results 'reit' instead of
// 'stock' — CORE_TICKERS types still win when a ticker happens to be one of those).
async function buildFromAnchors(anchorList, extraTickers = [], defaultType = 'stock') {
  const peerResults = await Promise.allSettled(anchorList.map((a) => getPeers(a)));

  const tickers = new Set(extraTickers);
  anchorList.forEach((a) => tickers.add(a));
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
    pool.push({
      ticker,
      name:          q.name,
      sector:        q.sector,
      type:          CORE_TICKER_TYPES[ticker] ?? defaultType,
      price:         q.price,
      peRatio:       q.peRatio,
      marketCap:     q.marketCap,
      dividendYield: q.dividendYield,
      beta:          q.beta,
      speculative:   flagSpeculative(ticker, q.marketCap, q.beta),
    });
  });
  return pool;
}

// Returns [] on total failure — callers should fall back to unconstrained picking.
export async function buildCandidatePool(inputs) {
  try {
    // Primary path: the pre-computed broad universe table.
    const universeRows = await queryUniverse({ sectorLabels: inputs?.sectors, types: ['stock'], limit: 150 });

    let pool;
    if (universeRows.length >= MIN_UNIVERSE_ROWS) {
      pool = universeRows.map((r) => ({ ...r, speculative: flagSpeculative(r.ticker, r.marketCap, r.beta) }));
      console.log(`[candidatePoolService] pool built from market_universe: ${pool.length} candidates`);
    } else {
      const anchors = resolveSectorAnchors(inputs?.sectors);
      pool = await buildFromAnchors(anchors);
      console.log(`[candidatePoolService] market_universe coverage too thin (${universeRows.length} rows) — used live peer-lookup fallback: ${pool.length} candidates from anchors [${anchors.join(', ')}]`);
    }

    // High-risk archetype top-up applies regardless of which path built the base pool.
    if (inputs?.riskProfile === 'high') {
      const archetypePool = await buildFromAnchors(HIGH_RISK_ARCHETYPE_ANCHORS);
      const seen = new Set(pool.map((c) => c.ticker));
      archetypePool.forEach((c) => { if (!seen.has(c.ticker)) { pool.push(c); seen.add(c.ticker); } });
    }

    // Renters get real REIT variety, not just VNQ — regardless of which sector was picked.
    if (inputs?.homeownership === 'renting') {
      const universeReits = await queryUniverse({ types: ['reit'], limit: 10 });
      const reitPool = universeReits.length > 0
        ? universeReits.map((r) => ({ ...r, speculative: flagSpeculative(r.ticker, r.marketCap, r.beta) }))
        : await buildFromAnchors(RENTER_REIT_ANCHORS, [], 'reit');
      const seen = new Set(pool.map((c) => c.ticker));
      reitPool.slice(0, 5).forEach((c) => { if (!seen.has(c.ticker)) { pool.push(c); seen.add(c.ticker); } });
    }

    // Core tickers must always be present — the behavioral rules depend on them
    // regardless of which path built the rest of the pool.
    const seen = new Set(pool.map((c) => c.ticker));
    const missingCore = CORE_TICKERS.filter((t) => !seen.has(t));
    if (missingCore.length > 0) {
      const coreResults = await Promise.allSettled(missingCore.map((t) => getQuote(t)));
      missingCore.forEach((ticker, i) => {
        const r = coreResults[i];
        if (r.status !== 'fulfilled') return;
        const q = r.value;
        pool.unshift({
          ticker,
          name:          q.name,
          sector:        q.sector,
          type:          CORE_TICKER_TYPES[ticker],
          price:         q.price,
          peRatio:       q.peRatio,
          marketCap:     q.marketCap,
          dividendYield: q.dividendYield,
          beta:          q.beta,
          speculative:   false,
        });
      });
    }

    const specCount = pool.filter((c) => c.speculative).length;
    console.log(`[candidatePoolService] final pool: ${pool.length} candidates (${specCount} high-volatility)`);
    return pool;
  } catch (err) {
    console.warn('[candidatePoolService] pool build failed, will fall back to unconstrained picking:', err.message);
    return [];
  }
}
