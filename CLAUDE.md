# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Guidelines

- Always follow best practices for every task — code quality, security, performance, readability, and maintainability. No shortcuts.

## Project Goal

Meridian is a financial education web app — **not** a trading or financial advice platform. It has four features:

1. **Stock Suggestions** — users input risk tolerance, investment amount, hold period, and optional sectors. Claude generates 5 stock picks with 2-sentence plain-English explanations tailored to their profile (what the company does + why it fits this investor).
2. **Stock Forecast** — users search any US-listed stock by ticker or company name (with autocomplete). The app fetches Finnhub data and Claude generates a Bull Case / Bear Case / Verdict dashboard with confidence score, sector P/E comparison chip, price range chart, and historical analog scenarios.
3. **Portfolio Tracker** — users manually add holdings (ticker, amount invested, purchase price, account type). Live prices from Finnhub show current value, gain/loss, and day change. Holdings persist in Supabase.
4. **Saved Plans** — users can save a suggestions run (name, inputs, cards, advisor narrative) and restore it on later login. Saved plans persist in Supabase.

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
FRED_API_KEY=...           # US Treasury yield data; falls back to hardcoded rates if missing
FMP_API_KEY=...            # Financial Modeling Prep — used by fmpService.js
ALPHA_VANTAGE_API_KEY=...  # Alpha Vantage — used by alphaService.js
SUPABASE_URL=...           # Supabase project URL
SUPABASE_SERVICE_KEY=...   # Supabase service role key (server-side admin access)
CORS_ORIGIN=...            # Production frontend URL (e.g. https://meridian.vercel.app); optional in dev
PORT=3001
```

Client env (`client/.env` or Vercel env vars):
```
VITE_SUPABASE_URL=...      # Same Supabase project URL
VITE_SUPABASE_ANON_KEY=... # Supabase anon/public key (safe to expose in browser)
```

## Architecture

**Monorepo structure:** root `package.json` runs both servers via `concurrently`. `server/` is an ES module Express app; `client/` is a React + Vite app. Vite proxies `/api/*` → `http://localhost:3001` in dev.

### Auth

Authentication is handled by **Supabase Auth** — no custom JWT/bcrypt. The client signs in via the Supabase JS client (`@supabase/supabase-js`) and passes the Supabase session JWT as a `Bearer` token on every authenticated request.

`server/middleware/auth.js` — `requireAuth` middleware validates the token by calling `supabaseAdmin.auth.getUser(token)`. On success it sets `req.userId` (UUID) and `req.userEmail` for downstream handlers.

All `/api/suggestions`, `/api/forecast`, and `/api/auth/*` routes require auth. `/api/search` and `/api/market-rates` are public.

### Database (Supabase PostgreSQL)

Three tables, all with `user_id UUID` FK to Supabase Auth `auth.users`:

| Table | Key columns |
|---|---|
| `profiles` | `user_id`, `profile_data` (JSONB), `refine_data` (JSONB), `last_cards` (JSONB), `last_narrative` (TEXT), `updated_at` |
| `saved_plans` | `id`, `user_id`, `plan_name`, `inputs` (JSONB), `cards` (JSONB), `advisor_narrative` (TEXT), `created_at` |
| `portfolio_holdings` | `id`, `user_id`, `ticker`, `name`, `security_type`, `amount_invested`, `shares`, `purchase_price`, `purchase_month`, `purchase_year`, `account_type`, `added_from`, `added_at` |

### Services

| File | Purpose |
|---|---|
| `services/supabase.js` | Lazy Supabase admin client (Proxy pattern — see Key Design Decisions) |
| `services/claudeService.js` | Anthropic Claude API — suggestions + forecast prompts |
| `services/finnhubService.js` | Finnhub — quote, profile, metric, financials, earnings, news, peers, search |
| `services/forecastService.js` | Orchestrates multi-wave Finnhub calls for forecast |
| `services/fmpService.js` | Financial Modeling Prep API |
| `services/alphaService.js` | Alpha Vantage API |
| `services/fredService.js` | FRED API — US Treasury yields (DGS2/5/10, T10YIE); 24 h in-memory cache |

### Request flows

**Suggestions (auth-gated):**
```
POST /api/suggestions
  → requireAuth
  → validateInputs()
  → claudeService.getSuggestions()             # returns [{ticker, reasoning}] × 5
  → Promise.allSettled(tickers.map(getQuote))  # per ticker: quote + profile + metric (P/E)
  → merge + return { cards: [...] }            # failed Finnhub calls return null fields, not errors
```

**Forecast (auth-gated):**
```
POST /api/forecast  { ticker }
  → requireAuth
  → forecastService.getStockData()
      Wave 1 — 7 parallel Finnhub calls via Promise.allSettled:
        profile, quote, metric, financials-reported, earnings, company-news, peers
      Wave 2 — metrics for up to 5 peers (to compute sector avg P/E as median)
  → claudeService.getForecast()                # returns {
                                               #   keyMetrics, verdict, bull, bear,
                                               #   educationalNote, historicalScenarios, confidenceScore
                                               # }
  → { forecast, ticker, companyName, quote, stockPE, sectorAvgPE }
```

**Search (public):**
```
GET /api/search?q=QUERY
  → Finnhub /search?q=  (filtered to Common Stock, excludes symbols with dots, max 8)
  → { results: [{ticker, name}] }
```

**Market rates (public):**
```
GET /api/market-rates
  → fredService.getTreasuryRates()  # DGS2/5/10 + T10YIE + CAPE estimate + SPY forward return
  → { marketRates: { ... } }
```

**Auth / Profile:**
```
GET  /api/auth/me                    → { user, savedProfile }  (profile_data + last_cards etc.)
POST /api/auth/profile               → upsert profiles row
POST /api/auth/save-plan             → insert saved_plans row  → { planId }
GET  /api/auth/saved-plans           → { plans: [...] }
DEL  /api/auth/saved-plans/:id       → delete (user-scoped)
```

**Portfolio:**
```
POST  /api/auth/portfolio/add           → insert portfolio_holdings row  → { id }
GET   /api/auth/portfolio/holdings      → holdings + live Finnhub prices + P&L computed server-side
DEL   /api/auth/portfolio/holdings/:id  → delete (user-scoped)
PATCH /api/auth/portfolio/holdings/:id  → update amount/price/dates/accountType
GET   /api/auth/portfolio/quotes        → bulk Finnhub quote refresh  ?tickers=AAPL,MSFT,...
```

### Key design decisions

- **Lazy Supabase admin client** — `services/supabase.js` wraps the admin client in a `Proxy`. The real `createClient()` call is deferred to first use (`getAdminClient()`). Same pattern as `claudeService.js`. Required because ES module imports are hoisted before `dotenv.config()` runs in `index.js`.
- **Lazy Anthropic client** — `getClient()` in `claudeService.js` initializes on first call, not at import time. Same hoisting reason as above.
- **`requireAuth` middleware** — validates Supabase JWT via `supabaseAdmin.auth.getUser(token)`. Sets `req.userId` (UUID) and `req.userEmail`. Applied at route registration in `index.js` for `/api/suggestions` and `/api/forecast`; applied per-handler inside `auth.js` router.
- **`Promise.allSettled` everywhere** — all multi-Finnhub-call patterns use `allSettled` so one failed endpoint never blocks the entire response.
- **Claude returns JSON only** — both prompts instruct Claude to return raw JSON (no markdown fences). Responses are fence-stripped and validated before use; malformed responses throw a `502`.
- **XBRL concept name variance** — `forecastService.js` tries multiple candidate XBRL concept names (e.g. `Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax`) when extracting reported financials, since filers use different tags.
- **CORS** — Express whitelists `localhost:5173` and `127.0.0.1:5173` plus `process.env.CORS_ORIGIN` (production frontend URL). Vite proxies all `/api` calls, so port drift (Vite falling back to 5174/5175) doesn't break API calls, but the browser URL must match.
- **Legacy profile blob detection** — `/api/auth/me` checks if `profile_data.inputs` exists; if so, it treats the whole JSONB as a legacy blob (`{ inputs, refineInputs, ... }`) from the SQLite-era migration. New rows store only the flat `inputs` object in `profile_data`.
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
- **In-memory caches** — `fredService.js` caches treasury rates for 24 h; `fmpService.js` and `alphaService.js` have their own caches. All drain on Railway restarts. Consider Redis or DB-backed cache post-launch.

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

- Save/share forecast as image or link
- Paid Finnhub tier for historical price candles and deeper financials
- Snaptrade integration — optional brokerage connect, OAuth, import holdings
- Mobile app
