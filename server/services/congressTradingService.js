// Congressional stock-trading disclosure data — STOCK Act (2012) requires members of
// Congress to publicly disclose trades within 45 days. This is purely a factual,
// disclosed-after-the-fact annotation on suggestion cards ("here's a public record"),
// never a signal that influences which tickers get picked — the disclosure lag (often
// weeks) means acting on it as if it were current insight would be misleading, so the
// lag figure is always surfaced alongside the trade, not hidden.
//
// Source: kadoa-org/congress-trading-monitor (MIT licensed, GitHub-hosted static JSON,
// no API key, no auth) — verified directly: serves a per-ticker file with current data.

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — this data doesn't need to be fresher
const cache = new Map(); // ticker -> { data, time }

const BASE_URL = 'https://raw.githubusercontent.com/kadoa-org/congress-trading-monitor/main/public/data/ticker';
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

// Returns { tradeCount, mostRecent: { date, type, filerName, chamber, party, daysToFile } }
// or null if there's no data / the fetch fails — always optional, never blocks the card.
export async function getRecentDisclosures(ticker) {
  const key = ticker.toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;

  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(key)}.json`);
    if (!res.ok) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }
    const json = await res.json();
    const trades = Array.isArray(json?.trades) ? json.trades : [];
    if (trades.length === 0) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    const cutoff = Date.now() - TWELVE_MONTHS_MS;
    const recent = trades.filter((t) => t.transaction_date && new Date(t.transaction_date).getTime() >= cutoff);
    if (recent.length === 0) {
      cache.set(key, { data: null, time: Date.now() });
      return null;
    }

    // Trades are already ordered most-recent-first in the source file.
    const latest = recent[0];
    const result = {
      tradeCount: recent.length,
      mostRecent: {
        date:       latest.transaction_date ?? null,
        type:       latest.transaction_type ?? null,
        filerName:  latest.filer_name ?? null,
        chamber:    latest.chamber ?? null,
        party:      latest.party ?? null,
        daysToFile: latest.days_to_file ?? null,
      },
    };
    cache.set(key, { data: result, time: Date.now() });
    return result;
  } catch (err) {
    console.warn(`[congressTradingService] failed for ${ticker}:`, err.message);
    cache.set(key, { data: null, time: Date.now() });
    return null;
  }
}
