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

InvestEdu is a financial education web app — **not** a trading or financial advice platform. It has two features:

1. **Stock Suggestions** — users input risk profile, investment amount, hold period, and optional sectors. Claude generates 5 educational stock picks with reasoning tailored to their profile.
2. **Stock Forecast** — users search any US-listed stock by name or ticker. The app fetches comprehensive Finnhub data and Claude generates a Bear Case / Bull Case / Verdict dashboard.

All Claude responses are framed as educational. A disclaimer is always visible in the UI.

Planned future features: user accounts, search history, saved stocks (requires adding a database).

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
  → claudeService.getSuggestions()     # returns [{ticker, reasoning}] × 5
  → Promise.allSettled(tickers.map(getQuote))  # Finnhub quote + profile per ticker
  → merge + return { cards: [...] }    # failed Finnhub calls return null market data, not errors
```

**Forecast:**
```
POST /api/forecast  { ticker }
  → forecastService.getStockData()     # 7 Finnhub calls in parallel via Promise.allSettled:
                                       #   profile, quote, metric, financials-reported,
                                       #   candle (monthly 2yr), earnings, company-news
  → claudeService.getForecast()        # returns { keyMetrics, verdict, bull, bear, educationalNote }
  → { forecast, ticker, companyName, quote, monthlyCloses }   # monthlyCloses = last 12 monthly closes
```

**Search (autocomplete):**
```
GET /api/search?q=QUERY
  → Finnhub /search?q=  (filtered to Common Stock, max 8 results)
  → { results: [{ticker, name}] }
```

### Key design decisions

- **Lazy Anthropic client** — `getClient()` in `claudeService.js` initializes on first call, not at import time. Required because ES module imports are hoisted before `dotenv.config()` runs in `index.js`.
- **`Promise.allSettled` everywhere** — used for all multi-Finnhub-call patterns so one failed endpoint never blocks the entire response.
- **Claude returns JSON only** — both prompts instruct Claude to return raw JSON (no markdown fences). Responses are fence-stripped and validated before use; malformed responses throw a `502`.
- **Finnhub free tier limits** — PE ratio is not available (always `null`). The `yahoo-finance2` package is still a dependency but unused (replaced by Finnhub after rate-limiting issues).
- **XBRL concept name variance** — `forecastService.js` tries multiple candidate XBRL concept names (e.g. `Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax`) when extracting reported financials, since filers use different tags.
- **CORS** — Express whitelists `localhost:5173` and `127.0.0.1:5173`. Vite proxies all `/api` calls so port drift (Vite falling back to 5174/5175 when 5173 is taken) doesn't break API calls, but the client URL in the browser must match.
- **Forecast data trimming** — `forecastService.js` aggressively trims Finnhub responses before sending to Claude (monthly closes array only, 3 annual periods, 5 news headlines) to stay under ~2000 input tokens.
- **Chart.js used directly** — `ForecastChart.jsx` imports from `chart.js` and manages a canvas ref manually. `react-chartjs-2` is installed as a dependency but not used. Chart.js controllers (`LineController`) must be explicitly registered alongside elements; omitting them throws "X is not a registered controller". Use `Chart.getChart(canvas)` to destroy an existing instance before creating a new one — required in React StrictMode which double-invokes effects.
- **Forecast prompt language rules** — the `FORECAST_SYSTEM_PROMPT` enforces plain-English output (max 20-word sentences, jargon defined inline) for a beginner audience. Keep this tone when modifying the prompt.

### Styling conventions

- Dark theme CSS variables defined in `client/src/styles/global.css` (`--bg-primary`, `--bg-card`, `--bg-input`, `--accent-blue`, `--accent-green`, `--accent-red`, `--accent-amber`, `--border`, `--border-focus`, `--text-primary`, `--text-muted`, `--radius`, `--radius-sm`).
- All component styles are inline — no CSS modules, no Tailwind.
- Active/selected chip pattern: `background: rgba(79,142,247,0.15)`, `color: var(--accent-blue)`, `border: 1px solid rgba(79,142,247,0.3)`.
