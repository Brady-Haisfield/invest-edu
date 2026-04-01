# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Getting Started

When the user opens this project, always greet them with:

> "Welcome back! To start the app run:
> ```
> npm run dev
> ```
> Then open **http://localhost:5173** in your browser."

## Project Goal

Meridian is a financial education web app — **not** a trading or financial advice platform. It has two features:

1. **Stock Suggestions** — users input risk tolerance, investment amount, hold period, and optional sectors. Claude generates 5 stock picks with 2-sentence plain-English explanations tailored to their profile (what the company does + why it fits this investor).
2. **Stock Forecast** — users search any US-listed stock by ticker or company name (with autocomplete). The app fetches Finnhub data and Claude generates a Bull Case / Bear Case / Verdict dashboard with confidence score, sector P/E comparison chip, price range chart, and historical analog scenarios.

All Claude responses are framed as educational. A disclaimer is always visible in the UI.

## Commands

```bash
# Install all dependencies
npm install && npm install --prefix server && npm install --prefix client

# Run both servers concurrently (recommended)
npm run dev

# Run individually
npm run dev --prefix server   # Express on :3001
npm run dev --prefix client   # Vite on :5173

# Production build (client only)
npm run build --prefix client
```

No test suite exists yet.

## Environment

`server/.env` is required (never committed). See `server/.env.example`:
```
ANTHROPIC_API_KEY=...
FINNHUB_API_KEY=...
PORT=3001
```

## Architecture

**Monorepo structure:** root `package.json` runs both servers via `concurrently`. `server/` is an ES module Express app; `client/` is a React + Vite app. Vite proxies `/api/*` → `http://localhost:3001` in dev.

### Request flows

**Suggestions:**
```
POST /api/suggestions
  → validateInputs()
  → claudeService.getSuggestions()          # returns [{ticker, reasoning}] × 5
  → Promise.allSettled(tickers.map(getQuote))  # per ticker: quote + profile + metric (P/E)
  → merge + return { cards: [...] }         # failed Finnhub calls return null fields, not errors
```

**Forecast:**
```
POST /api/forecast  { ticker }
  → forecastService.getStockData()
      Wave 1 — 7 parallel Finnhub calls via Promise.allSettled:
        profile, quote, metric, financials-reported, earnings, company-news, peers
      Wave 2 — metrics for up to 5 peers (to compute sector avg P/E as median)
  → claudeService.getForecast()             # returns {
                                            #   keyMetrics, verdict, bull, bear,
                                            #   educationalNote, historicalScenarios, confidenceScore
                                            # }
  → { forecast, ticker, companyName, quote, stockPE, sectorAvgPE }
```

**Search (autocomplete):**
```
GET /api/search?q=QUERY
  → Finnhub /search?q=  (filtered to Common Stock, excludes symbols with dots, max 8)
  → { results: [{ticker, name}] }
```

### Key design decisions

- **Lazy Anthropic client** — `getClient()` in `claudeService.js` initializes on first call, not at import time. Required because ES module imports are hoisted before `dotenv.config()` runs in `index.js`.
- **`Promise.allSettled` everywhere** — all multi-Finnhub-call patterns use `allSettled` so one failed endpoint never blocks the entire response.
- **Claude returns JSON only** — both prompts instruct Claude to return raw JSON (no markdown fences). Responses are fence-stripped and validated before use; malformed responses throw a `502`.
- **XBRL concept name variance** — `forecastService.js` tries multiple candidate XBRL concept names (e.g. `Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax`) when extracting reported financials, since filers use different tags.
- **CORS** — Express whitelists `localhost:5173` and `127.0.0.1:5173`. Vite proxies all `/api` calls, so port drift (Vite falling back to 5174/5175) doesn't break API calls, but the browser URL must match.
- **Sector P/E benchmark** — computed as the median of `peBasicExclExtraTTM` fetched live from `/stock/metric` for up to 5 peers returned by `/stock/peers`. Outliers (PE ≤ 0 or ≥ 200) are filtered before taking the median. `sectorAvgPE` is `null` if no valid peer PEs are found.
- **Candle endpoint removed** — Finnhub `/stock/candle` returns 403 on the free tier. `ForecastChart.jsx` shows only projection lines from current price to bull/bear midpoint targets. No historical price line.
- **Historical scenarios** — the `historicalScenarios` array in the Claude response comes entirely from Claude's training knowledge of the stock's history — not from fetched data. Claude is prompted to find 2-3 real historical periods with similar conditions.
- **Confidence score** — Claude returns a `confidenceScore` (0–100) as a top-level field. Rendered as a colored progress bar in the Verdict `CaseCard` (green ≥ 65, amber ≥ 45, red < 45).
- **Price target validation** — `getForecast()` in `claudeService.js` validates that bull targets are strictly above current price and bear targets are strictly below. Throws 502 if invalid.
- **Autocomplete filtering** — symbols containing `.` are excluded to remove foreign exchange listings (AAPL.MX etc.), keeping only US-listed tickers.
- **Loading state animation** — `ForecastLoadingState.jsx` advances steps on a fixed 2 s timer regardless of API timing. A ref-based handshake in `App.jsx` (`pendingResultRef` + `animReadyRef`) holds the API result until step 4 is active before dismissing the loader. On error, loading is cleared immediately.
- **Chart.js used directly** — `ForecastChart.jsx` manages a canvas ref manually; `react-chartjs-2` is installed but unused. `LineController` must be explicitly registered. Use `Chart.getChart(canvas)` to destroy before recreating — required in React StrictMode.
- **Forecast prompt language rules** — `FORECAST_SYSTEM_PROMPT` enforces plain-English output (≤ 20 words per sentence, jargon defined inline). Keep this tone when modifying the prompt.
- **Suggestions prompt brevity** — `SYSTEM_PROMPT` for suggestions enforces exactly 2 sentences per `reasoning`: sentence 1 = what the company does, sentence 2 = why it fits this investor's profile.

### Styling conventions

- CSS variables at `:root` in `client/src/styles/global.css`. Key variables: `--bg`, `--bg-card`, `--bg-input`, `--bg-hover`, `--border`, `--border-2`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-green`, `--accent-green-bright`, `--accent-green-dim`, `--accent-red`, `--accent-red-dim`, `--accent-amber`, `--accent-blue`, `--radius`, `--radius-lg`, `--space-1` through `--space-10`.
- Typography: **Instrument Serif** (headlines), **DM Mono** (all numbers, tickers, prices, percentages), **DM Sans** (body, buttons). Loaded from Google Fonts.
- CSS classes in `global.css` for all static styles. Inline styles only for dynamic/computed values (confidence bar width, outcome color based on `+`/`-` prefix, lean badge colors).
- Reusable components: `MetricChip.jsx`, `CaseCard.jsx`, `ScenarioRow.jsx`, `LoadingStep.jsx` — all in `client/src/components/`.
- No CSS modules, no Tailwind.

## Finnhub Free Tier Limitations

- **`/stock/candle`** — returns 403. Removed from codebase.
- **`/stock/peers`** — works on free tier; used in wave 2 to compute sector avg P/E.
- **`/stock/financials-reported`** — works but XBRL concept names vary by filer. `forecastService.js` tries multiple candidate names per field.
- **`/stock/metric`** — works; provides TTM ratios. P/E returns `null` for unprofitable companies.
- **Data depth:** 3 years of annual financials, 4 quarters of earnings surprises, last 14 days of company news, real-time quote.
- **Historical scenario data** — not from Finnhub. Generated by Claude from its training knowledge.

## Future Features

- User accounts and authentication
- Saved forecasts and search history (requires adding a database)
- Save/share forecast as image or link
- Paid Finnhub tier for historical price candles and deeper financials
- Mobile app
