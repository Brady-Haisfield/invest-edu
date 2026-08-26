// Broad, pre-computed candidate universe for the suggestions feature.
//
// Finnhub's free tier exposes a bulk symbol-list endpoint (/stock/symbol?exchange=US) —
// verified directly: ~31,000 entries, ~18,400 Common Stock, ~6,500 ETP (ETFs), ~424 REIT.
// No fundamentals screener exists on any free tier, but the 60/min rate limit that makes a
// *live* broad scan infeasible doesn't apply to a *background* job spread over hours — so
// this seeds the full ticker list once, then rolls through fetching fundamentals a batch at
// a time (server/jobs/universeRefreshJob.js), storing results in Supabase. Live requests
// then query this table (fast, no API calls) instead of scanning live.

import supabaseAdmin from './supabase.js';
import { getQuote } from './finnhubService.js';

const BASE = 'https://finnhub.io/api/v1';

function finnhubFetch(path) {
  const key = process.env.FINNHUB_API_KEY;
  return fetch(`${BASE}${path}&token=${key}`).then((r) => r.json());
}

// Same filtering approach as routes/search.js (Common Stock, no dotted symbols) extended
// to also capture ETFs and REITs for the broader universe.
const TYPE_MAP = { 'Common Stock': 'stock', 'ETP': 'etf', 'REIT': 'reit' };
const TICKER_RE = /^[A-Z]{1,5}$/;
// Real major-exchange listings only — verified via the mic field distribution: OOTC
// (over-the-counter/pink-sheet) makes up the majority (14,496 of ~25,300 Common
// Stock/ETP/REIT entries) and directly contradicts the existing "no penny stocks or
// OTC-only securities" rule already in claudeService.js's SYSTEM_PROMPT.
const REAL_EXCHANGE_MICS = new Set(['XNAS', 'XNYS', 'ARCX', 'BATS', 'XASE']); // Nasdaq, NYSE, NYSE Arca, Cboe BZX, NYSE American

// One-time (idempotent) seed of the ticker/name/type universe — no fundamentals fetched
// here, so this is cheap (~1 API call) regardless of how many rows it inserts. Safe to
// call on every server startup: ignoreDuplicates means already-seeded/refreshed rows are
// never overwritten.
export async function seedUniverse() {
  try {
    const list = await finnhubFetch('/stock/symbol?exchange=US');
    if (!Array.isArray(list)) {
      console.warn('[universeService] unexpected symbol list response, skipping seed');
      return;
    }

    const rows = list
      .filter((r) => TYPE_MAP[r.type] && typeof r.symbol === 'string' && TICKER_RE.test(r.symbol) && REAL_EXCHANGE_MICS.has(r.mic))
      .map((r) => ({ ticker: r.symbol, name: r.description ?? r.symbol, type: TYPE_MAP[r.type] }));

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error, count } = await supabaseAdmin
        .from('market_universe')
        .upsert(batch, { onConflict: 'ticker', ignoreDuplicates: true, count: 'exact' });
      if (error) {
        console.warn('[universeService] seed batch error:', error.message);
        continue;
      }
      inserted += count ?? 0;
    }
    console.log(`[universeService] seed complete: ${rows.length} candidate rows processed, ${inserted} newly inserted`);
  } catch (err) {
    console.warn('[universeService] seed failed:', err.message);
  }
}

// Refreshes the N stalest rows (oldest updated_at, nulls first) with live fundamentals.
// Self-pacing and resumable by construction — no separate progress cursor needed, and
// safe across server restarts since progress lives in the updated_at column itself.
export async function refreshBatch(n = 30) {
  const { data: rows, error } = await supabaseAdmin
    .from('market_universe')
    .select('ticker')
    .order('updated_at', { ascending: true, nullsFirst: true })
    .limit(n);

  if (error) {
    console.warn('[universeService] refreshBatch select error:', error.message);
    return { attempted: 0, updated: 0 };
  }
  if (!rows || rows.length === 0) return { attempted: 0, updated: 0 };

  const tickers = rows.map((r) => r.ticker);
  const quoteResults = await Promise.allSettled(tickers.map((t) => getQuote(t)));

  let updated = 0;
  for (let i = 0; i < tickers.length; i++) {
    const r = quoteResults[i];
    // Always touch updated_at, even on failure, so a bad/delisted ticker doesn't get
    // re-selected every cycle — it just falls to the back of the queue like everything else.
    const patch = { updated_at: new Date().toISOString() };
    if (r.status === 'fulfilled') {
      const q = r.value;
      Object.assign(patch, {
        name: q.name, sector: q.sector, price: q.price, pe_ratio: q.peRatio,
        market_cap: q.marketCap, dividend_yield: q.dividendYield, beta: q.beta,
      });
      updated++;
    }
    const { error: upErr } = await supabaseAdmin.from('market_universe').update(patch).eq('ticker', tickers[i]);
    if (upErr) console.warn(`[universeService] update failed for ${tickers[i]}:`, upErr.message);
  }

  console.log(`[universeService] refreshBatch: ${updated}/${tickers.length} tickers refreshed with live data`);
  return { attempted: tickers.length, updated };
}

// Heuristic keyword map from the app's validated sector labels (KNOWN_SECTORS in
// utils/validators.js) to Finnhub's free-text industry taxonomy (finnhubIndustry) — these
// don't line up 1:1 (e.g. NVDA is "Semiconductors" not "Technology"), so this matches
// broadly on purpose. candidatePoolService.js falls back to the existing peer-lookup
// approach when a query returns too few rows, so an imperfect match here degrades
// gracefully rather than silently under-serving a sector.
const SECTOR_KEYWORDS = {
  'Technology':  ['Technology', 'Software', 'Semiconductor', 'Internet', 'Hardware', 'IT Services'],
  'Healthcare':  ['Health', 'Biotechnology', 'Pharmaceutical', 'Medical'],
  'Finance':     ['Bank', 'Financial', 'Insurance', 'Investment', 'Capital Markets'],
  'Energy':      ['Energy', 'Oil', 'Gas', 'Petroleum'],
  'Consumer':    ['Consumer', 'Retail', 'Apparel', 'Restaurant'],
  'Utilities':   ['Utilit', 'Electric', 'Power'],
  'Real Estate': ['Real Estate'],
  'Industrials': ['Industrial', 'Machinery', 'Aerospace', 'Defense', 'Manufacturing'],
  'Materials':   ['Materials', 'Chemical', 'Mining', 'Metals'],
};

// filters: { sectorLabels?: string[] (validated KNOWN_SECTORS values), types?: string[], limit?: number }
// Returns [] on any failure or when there simply aren't enough refreshed rows yet —
// callers should treat that as "not enough coverage yet" and fall back accordingly.
//
// Sector matching happens in JS with word-boundary regex rather than a Postgres ILIKE
// wildcard — found empirically that '%Technology%' also matches "Biotechnology" (the
// substring is right there: Bio-technology), which would put biotech stocks in a
// Technology-sector query. \b anchoring avoids that: no word boundary exists between
// "Bio" and "technology" since both are letters, so it correctly excludes it while still
// matching standalone "Technology".
export async function queryUniverse({ sectorLabels, types, limit = 150 } = {}) {
  try {
    let query = supabaseAdmin.from('market_universe').select('*').not('updated_at', 'is', null);

    if (types?.length) query = query.in('type', types);

    // Fetch a wider batch when sector-filtering (so JS filtering below still has enough
    // to work with) than when just asking for a type (e.g. REIT top-up doesn't need this).
    const fetchLimit = sectorLabels?.length ? Math.max(limit * 10, 2000) : limit;
    const { data, error } = await query.limit(fetchLimit);
    if (error) {
      console.warn('[universeService] queryUniverse error:', error.message);
      return [];
    }

    let rows = data ?? [];
    if (sectorLabels?.length) {
      const keywords = sectorLabels.flatMap((s) => SECTOR_KEYWORDS[s] ?? []);
      if (keywords.length > 0) {
        const patterns = keywords.map((k) => new RegExp(`\\b${k}`, 'i'));
        rows = rows.filter((r) => r.sector && patterns.some((p) => p.test(r.sector)));
      }
    }
    rows = rows.slice(0, limit);

    return rows.map((r) => ({
      ticker: r.ticker,
      name: r.name,
      sector: r.sector,
      type: r.type,
      price: r.price,
      peRatio: r.pe_ratio,
      marketCap: r.market_cap,
      dividendYield: r.dividend_yield,
      beta: r.beta,
    }));
  } catch (err) {
    console.warn('[universeService] queryUniverse failed:', err.message);
    return [];
  }
}
