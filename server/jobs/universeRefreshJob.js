// Starts the background market-universe refresh: seed once, then roll through refreshing
// the stalest rows on an interval. Runs in-process — no new infra beyond the Express
// server that's already running continuously on Railway, same "single long-lived process"
// pattern this app already relies on for its in-memory caches.

import { seedUniverse, refreshBatch } from '../services/universeService.js';

// getQuote() fires ~3 Finnhub sub-calls per ticker, nearly simultaneously (Promise.allSettled).
// 30 was observed empirically to burst well past the 60/min free-tier ceiling (many refreshes
// silently failed under rapid manual testing) — 15 x 3 = 45 concurrent calls stays comfortably
// under it.
const BATCH_SIZE = 15;
const INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes

export function startUniverseRefreshJob() {
  seedUniverse().then(() => {
    console.log('[universeRefreshJob] started — refreshing', BATCH_SIZE, 'tickers every', INTERVAL_MS / 1000, 'seconds');
  });

  setInterval(() => {
    refreshBatch(BATCH_SIZE).catch((err) => {
      console.warn('[universeRefreshJob] batch failed:', err.message);
    });
  }, INTERVAL_MS);
}
