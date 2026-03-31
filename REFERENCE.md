# Meridian — Project Reference Doc
Last updated: March 31, 2026

## What Meridian Is
Financial education web app for beginner investors — college students and young professionals in their early-to-mid 20s who have money to invest but feel like every existing tool was built for professionals.
Tagline: Invest like you know what you're doing. Even if you're just starting.
Core idea: Robinhood gives you a trading platform. Bloomberg gives you a terminal. Nobody gives you a starting point that actually makes sense for you specifically. Meridian is that starting point.
Business model: Free at launch. Subscription eventually. Goal right now is real users and validation.

## Team

- **Brady**: Co-founder, works across frontend and backend
- **Partner**: Co-founder, works across frontend and backend
- **Coordination**: Roommates, daily in-person sync, shared GitHub repo
- **Conflict rule**: Communicate before pushing — pull latest before starting any session, coordinate on files you are both likely to touch at the same time to avoid merge conflicts

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: Migrating from SQLite to Supabase PostgreSQL
- **Auth**: Migrating from JWT/bcrypt to Supabase Auth
- **AI**: Anthropic Claude API (claude-sonnet-4-6)
- **Deployment**: Vercel (frontend) + Railway (backend) + Supabase (database)
- **Market data**: Finnhub (primary), FMP (analyst data, ETF), Alpha Vantage (fallback), FRED (Treasury yields, CAPE)

## Features Built

- Landing page with Create Account and Sign In
- 9-step onboarding (being reduced to 5-10 questions in Milestone 2)
- Stock Suggestions: personalized picks with allocation framework, return projections, AI advisor paragraph, refine panel, save plan
- Stock Forecast: bull/bear/verdict dashboard, confidence score, sector P/E comparison, historical analog scenarios, price range chart
- Portfolio tracker: add holdings, live prices, basic P&L
- User accounts: register, login, saved plans restore on login
- Navigation: My Dashboard, My Portfolio, Forecast

## Database Schema (SQLite migrating to Supabase)

**users**
- id, email, password_hash, created_at

**profiles** (one per user, upserted)
- id, user_id, profile_data (JSON), refine_data (JSON), last_cards (JSON), last_narrative, updated_at

**saved_plans** (many per user)
- id, user_id, plan_name, inputs (JSON), cards (JSON), advisor_narrative, created_at

**portfolio_holdings** (many per user)
- id, user_id, ticker, name, security_type, amount_invested, shares, purchase_price, purchase_month, purchase_year, account_type, added_from, added_at

Note: profiles and portfolio_holdings use ALTER TABLE migration loops at startup to add columns — fragile pattern, fix in Supabase schema design

## API Integrations

| Service | Used For | Rate Limit | Failure Handling |
|---------|----------|-----------|-----------------|
| Anthropic | Suggestions and Forecast generation | Metered | 502 on bad JSON |
| Finnhub | Primary market data — price, profile, metrics, earnings, news, search | 60/min free | Promise.allSettled, null on failure |
| FMP | Analyst estimates, ETF expense ratios, ETF holdings | 250 req/day | 24h in-memory cache, null on failure |
| Alpha Vantage | Fallback for dividend yield, beta, revenue growth | 25 req/day | Daily call counter in-memory, null when limit hit |
| FRED | Treasury yields (2yr, 5yr, 10yr), inflation expectations | None (public) | 24h in-memory cache, hardcoded fallbacks |

## Known Issues and Bugs

### Critical — fix before deploy

- **Unauthenticated Claude endpoints**: `/api/suggestions` and `/api/forecast` have no auth gate — anyone with the server URL can trigger Claude API spend. Fix in Task 1.8.
- **In-memory caches reset on restart**: FMP (250/day) and Alpha Vantage (25/day) quotas drain on every Railway restart. Consider Supabase-backed cache post-launch.
- **SQLite is local-only**: `server/data/meridian.db` cannot be shared between team members or deployed. Migration to Supabase is Milestone 1.
- **JWT no server-side revocation**: Logout is client-side only. Supabase Auth solves this.

### Pre-existing bugs — fix in Milestone 2 and 3

- **Pre-selected onboarding values**: `goalMode` defaults to `growing-wealth` and `riskProfile` defaults to `medium` in OnboardingFlow.jsx lines 74 and 76. Shows as active before user touches anything.
- **Nav shown during onboarding**: App.jsx renders Nav for all logged-in users. No hide-during-onboarding logic exists.
- **lastUpdatedAt bug**: App.jsx line 208 reads `meData.savedProfile.lastUpdatedAt` but `/api/auth/me` never returns it. Always undefined.

### Minor — fix when you get to it

- **yahoo-finance2 installed but unused**: Listed in server/package.json, not used anywhere. Remove.
- **/api/test-apis exposed**: Dev diagnostic route with no auth gate. Remove or auth-gate before deploy.
- **Shiller CAPE hardcoded**: fredService.js has `CAPE_ESTIMATE = 36` hardcoded. testApis.js queries FRED for it — verify if FRED actually serves this and remove hardcode if so.

## Design System (Reference: ForecastResult.jsx)

### Colors (all defined in global.css at :root)
```
--bg: #0a0a08
--bg-card: #111110
--bg-input: #1a1a18
--bg-hover: #222220
--border: #2a2a28
--border-2: #333330
--text-primary: #f0ede8
--text-secondary: #a09d98
--text-muted: #605d58
--accent-green: #4a9e6a
--accent-green-bright: #5cb87a
--accent-green-dim: #1a3a28
--accent-red: #c45c5c
--accent-red-dim: #3a1a1a
--accent-amber: #c4943a
--accent-blue: #6eb5ff
--radius: 10px
--radius-lg: 14px
--space-1 through --space-10 (4px base scale)
```

### Typography

- **Instrument Serif** — all headlines, company names, card headlines
- **DM Mono** — all numbers, tickers, prices, percentages, labels
- **DM Sans** — all body copy, buttons, supporting text

### Component standards

- Cards: `var(--bg-card)`, `0.5px solid var(--border)`, `var(--radius-lg)`
- Buttons: `var(--accent-green)`, white text, `var(--radius)`, DM Sans
- Metric chips: `var(--bg-input)`, `0.5px solid var(--border)`, border-radius 8px
- No inline styles for static properties — everything in CSS classes
- No hardcoded hex values in JSX — always reference CSS variables
- Dynamic values only (confidence bar width, outcome colors) use inline styles

### Pages that match design system

- ForecastResult.jsx
- ForecastLoadingState.jsx
- ForecastForm.jsx
- Nav.jsx (partially)

### Pages that need design system pass

- DashboardPanel.jsx
- StockGrid.jsx
- StockCard.jsx
- OnboardingFlow.jsx
- PortfolioPage.jsx
- AllocationBuilder.jsx

## Milestone Plan and Status

### Milestone 1: Foundation and Database Migration — In Progress
Done when: App runs against Supabase, SQLite retired, auth migrated, all APIs audited

- [x] Task 1.1: Full codebase audit
- [ ] Task 1.2: SQLite schema deep audit — CURRENT
- [ ] Task 1.3: Vercel and Railway accounts and projects created
- [ ] Task 1.4: Supabase project created, PostgreSQL schema designed
- [ ] Task 1.5: Supabase Auth migration approach documented
- [ ] Task 1.6: Supabase Auth implemented
- [ ] Task 1.7: All non-auth tables migrated to Supabase
- [ ] Task 1.8: All server routes updated to Supabase client plus cleanup
- [ ] Task 1.9: All API integrations audited for stability
- [ ] Task 1.10: Full auth flow verified end-to-end
- [ ] Task 1.11: CLAUDE.md updated to reflect new architecture

### Milestone 2: Onboarding Redesign — Not Started
Done when: 5-10 questions, zero pre-selections, nav hidden, saves to Supabase

- [ ] Task 2.1: Audit current 9-step onboarding
- [ ] Task 2.2: Design new 5-10 question flow
- [ ] Task 2.3: Remove all pre-selected states
- [ ] Task 2.4: Hide nav during onboarding
- [ ] Task 2.5: Rebuild onboarding component
- [ ] Task 2.6: Add optional brokerage connect placeholder
- [ ] Task 2.7: Wire completion to Supabase and route to suggestions
- [ ] Task 2.8: Test full flow end-to-end

### Milestone 3: UI Consistency and Visual Polish — Not Started
Done when: Every page matches Forecast page design system, no dark-on-dark issues

- [ ] Task 3.1: Extract and document Forecast page design system as reference
- [ ] Task 3.2: Fix all dark-text-on-dark-background instances
- [ ] Task 3.3: Suggestions results page — rebuild hierarchy, shorten, add CTA
- [ ] Task 3.4: Dashboard page — design system pass
- [ ] Task 3.5: Onboarding pages — design system pass
- [ ] Task 3.6: Portfolio tracker — design system pass
- [ ] Task 3.7: Navigation — finalize items, active states, hide/show logic
- [ ] Task 3.8: Typography audit across every page
- [ ] Task 3.9: Allocation framework cards — lighter styling
- [ ] Task 3.10: Stock cards — 2-sentence descriptions, fix retirement lens styling

### Milestone 4: Feature Completion — Not Started
Done when: All features work end-to-end, Snaptrade implemented

- [ ] Task 4.1: End-to-end suggestions flow audit
- [ ] Task 4.2: Claude suggestions personalization — verify profile-specific explanations
- [ ] Task 4.3: Refine Your Results panel — 3-4 fields, debounced auto-rerun
- [ ] Task 4.4: Allocation framework — verify projections
- [ ] Task 4.5: Portfolio tracker — Supabase persistence, live prices, P&L
- [ ] Task 4.6: Saved plans — full persistence, restore on login
- [ ] Task 4.7: Snaptrade evaluation — developer account, OAuth flow research
- [ ] Task 4.8: Snaptrade implementation
- [ ] Task 4.9: Forecast tool — final review and cleanup

### Milestone 5: Launch Preparation — Not Started
Done when: Live on production, mobile-responsive, error-handled, QA passed

- [ ] Task 5.1: Mobile responsiveness — 375px, 390px, 430px, 768px
- [ ] Task 5.2: Error handling audit — every API call has graceful error state
- [ ] Task 5.3: Loading states audit — every async operation has loading UI
- [ ] Task 5.4: Deploy frontend to Vercel
- [ ] Task 5.5: Deploy backend to Railway
- [ ] Task 5.6: Supabase production setup — RLS policies, connection pooling, backups
- [ ] Task 5.7: Production smoke test on live URLs
- [ ] Task 5.8: First-impression pass — landing page communicates value in 5 seconds
- [ ] Task 5.9: Final QA as a first-time user

## Key Decisions Made

- **Auth**: Supabase Auth replacing custom JWT/bcrypt — handles token refresh, session management, password reset
- **Database**: Supabase PostgreSQL replacing SQLite
- **Deployment**: Vercel + Railway + Supabase
- **Snaptrade**: Greenfield, goes in Milestone 4, can slip to post-launch if needed
- **Onboarding**: Reduce to 5-10 questions — income range and account type move to Refine panel
- **Refine panel**: Maximum 3-4 fields, not a second full onboarding form
- **Claude endpoints**: Will be auth-gated in Task 1.8 before any public deployment

## Environment Variables Required

**Server:**
```
ANTHROPIC_API_KEY=
FINNHUB_API_KEY=
FMP_API_KEY=
ALPHA_VANTAGE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
PORT=3001
```

**Client:**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Useful Commands

**Install all dependencies:**
```
npm install && npm install --prefix server && npm install --prefix client
```

**Run both servers:**
```
npm run dev
```

**Run individually:**
```
npm run dev --prefix server   # Express on :3001
npm run dev --prefix client   # Vite on :5173
```

---

Update this doc after every completed milestone task. Keep the milestone checkboxes current.
