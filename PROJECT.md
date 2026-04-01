# Meridian

**Status**: In Progress
**Current Milestone**: 1 — Foundation and Database Migration
**Last Updated**: 2026-04-01

---

## Project Summary
Meridian is a financial education web app for college students and young professionals who want to invest but feel like every existing tool assumes knowledge they don't have. The app provides personalized stock suggestions, stock forecasts, and portfolio tracking — all explained in plain English. Goal: go from current state to a fully deployed, launch-ready product in a 3-week sprint.

## Key Decisions
- **Supabase Auth**: Chosen over keeping custom JWT/bcrypt. Provides token refresh, session management, and password reset out of the box. Custom JWT/bcrypt will be fully removed.
- **Deployment**: Vercel (frontend) + Railway (backend) + Supabase (database)
- **SQLite → Supabase PostgreSQL**: Full migration required before any frontend feature work begins
- **Snaptrade**: Highest-risk item — can slip to post-launch if it blocks timeline
- **Ownership split**: Partner owns `server/`, Braden owns `client/`. Coordinate before touching partner's code.
- **Milestone 2 gate**: Nothing in Milestone 2 gets built until the database layer (Milestone 1) is stable.
- **In-memory caches**: FMP (24h), Alpha Vantage (daily call counter), FRED (24h), Alpha news (6h) all cache in memory — will drain on Railway restarts. Consider Redis or DB-backed cache post-launch.
- **Unauthenticated Claude endpoints**: `/api/suggestions` and `/api/forecast` have no auth gate — anyone can hit them and trigger Claude spend. Flag for Task 1.8.

## Open Questions / Known Issues
- **Profile not restoring on login (post-migration)**: Migrated profile data exists in Supabase but onboarding shows instead of dashboard on login. Suspected legacy blob format in profile_data JSONB — the migration preserved the raw SQLite JSON which may be in the old `{ inputs, refineInputs, ... }` blob format. /me handler has legacy detection but may need investigation. Investigate in Task 1.10.
- Snaptrade API evaluation still pending (Task 4.7) — unknown complexity
- Need to confirm all third-party API keys are present and stable before Milestone 1 closes
- Partner needs to be looped in on all Milestone 1 backend tasks before execution
- `CAPE` series in FRED: `fredService.js` hardcodes CAPE=36 but `testApis.js` queries `series_id=CAPE` — verify if FRED actually serves this before Task 1.9
- `/api/test-apis` is an unauthenticated dev route — should be removed or auth-gated before deploy
- `yahoo-finance2` package installed but unused — remove in Task 1.8 cleanup
- `lastUpdatedAt` in `meData.savedProfile` is never returned by server — field is always undefined in client
- `dateOfBirth.day` missing in both live profile rows (legacy data, pre-dates day field) — App.jsx already handles with `?? 1` fallback
- FK enforcement in SQLite is per-connection, not persistent — `db.js` does not set `PRAGMA foreign_keys = ON` explicitly. PostgreSQL enforces properly.
- All `user_id` FKs must change from INTEGER → UUID when migrating to Supabase Auth

---

## Milestone Map

### MILESTONE 1: Foundation and Database Migration ✅ COMPLETE
Done condition: App runs against Supabase (SQLite retired), deployment platform selected and configured, schema fully audited and documented, all API integrations audited for stability, full auth flow works end-to-end locally against Supabase.
- [x] Task 1.1: Full codebase audit — map every route, component, feature, API call, and DB interaction
- [x] Task 1.2: SQLite schema audit — document every table, column, constraint, and relationship
- [x] Task 1.3: Select and configure deployment platform — Vercel (frontend), Railway (backend)
- [x] Task 1.4: Create Supabase project and design PostgreSQL schema
- [x] Task 1.5: Auth decision documented — Supabase Auth migration approach
- [x] Task 1.6: Implement Supabase Auth migration
- [x] Task 1.7: Migrate all non-auth tables and data to Supabase PostgreSQL
- [x] Task 1.8: Update all server routes to use Supabase client instead of SQLite
- [x] Task 1.9: Audit all API integrations (Finnhub, FMP, Alpha Vantage, FRED)
- [x] Task 1.10: Verify full auth flow end-to-end
- [x] Task 1.11: Update CLAUDE.md to reflect new architecture

### MILESTONE 2: Onboarding Redesign ⏳
Done condition: Onboarding is 5–10 questions, conversational, zero pre-selections, nav hidden during flow, completes to suggestions page, profile saves to Supabase.
- [ ] Task 2.1: Audit current 9-step onboarding
- [ ] Task 2.2: Design new flow — finalize questions, order, input types
- [ ] Task 2.3: Remove all pre-selected states from every onboarding input
- [ ] Task 2.4: Hide nav during onboarding — logo only, full nav on completion
- [ ] Task 2.5: Rebuild onboarding component to new flow
- [ ] Task 2.6: Add optional Connect Your Brokerage step placeholder (skip option)
- [ ] Task 2.7: Wire onboarding completion to save profile to Supabase and route to suggestions
- [ ] Task 2.8: Test full flow end-to-end

### MILESTONE 3: UI Consistency and Visual Polish ⏳
Done condition: Every page matches the Forecast page design system. No dark-on-dark issues. Suggestions results page has clear hierarchy and CTA. All pages feel like one product.
- [ ] Task 3.1: Extract and document Forecast page design system as reference standard
- [ ] Task 3.2: Find and fix all dark-text-on-dark-background instances
- [ ] Task 3.3: Suggestions results page — rebuild with clear hierarchy, shorten, add CTA
- [ ] Task 3.4: Dashboard page — full design system pass
- [ ] Task 3.5: Onboarding pages — design system pass
- [ ] Task 3.6: Portfolio tracker page — design system pass
- [ ] Task 3.7: Navigation — finalize items, active states, hide/show logic
- [ ] Task 3.8: Typography audit — Instrument Serif / DM Mono / DM Sans verified across all pages
- [ ] Task 3.9: Allocation framework cards — lighter styling, subtle green left border
- [ ] Task 3.10: Stock cards — 2-sentence max, retirement lens as amber text not red box

### MILESTONE 4: Feature Completion ⏳
Done condition: All core features work end-to-end. Suggestions fully connected. Refine panel live with debounced re-runs. Portfolio saves to Supabase with live prices. Saved plans restore on login. Snaptrade optional connect implemented.
- [ ] Task 4.1: End-to-end suggestions flow audit
- [ ] Task 4.2: Claude suggestions personalization — verify profile-specific descriptions
- [ ] Task 4.3: Build Refine Your Results expandable panel (3–4 fields, debounced, collapsible)
- [ ] Task 4.4: Allocation framework — verify return projections, fix broken states
- [ ] Task 4.5: Portfolio tracker — Supabase persistence, live prices, basic P&L
- [ ] Task 4.6: Saved plans — full Supabase persistence, restore on login, clean empty state
- [ ] Task 4.7: Snaptrade evaluation — developer account, API docs, OAuth flow, data shape
- [ ] Task 4.8: Snaptrade implementation — optional brokerage connect, OAuth, import holdings
- [ ] Task 4.9: Forecast tool — final feature review, fix remaining broken states

### MILESTONE 5: Launch Preparation ⏳
Done condition: App is live on production, mobile-responsive, handles errors gracefully, passes full end-to-end QA as a new user.
- [ ] Task 5.1: Mobile responsiveness — tested and fixed at 375px, 390px, 430px, 768px
- [ ] Task 5.2: Error handling audit — every API call has graceful error state
- [ ] Task 5.3: Loading states audit — every async operation has appropriate loading UI
- [ ] Task 5.4: Deploy frontend to Vercel — build config, env vars, preview deployments
- [ ] Task 5.5: Deploy backend to Railway — Node.js config, env vars, health check
- [ ] Task 5.6: Supabase production setup — RLS policies, connection pooling, backups
- [ ] Task 5.7: Production smoke test — full user journey on live URLs
- [ ] Task 5.8: First-impression pass — landing page communicates value within 5 seconds
- [ ] Task 5.9: Final QA — complete user journey as first-time user, fix before launch

---

## Resume Point
**Next action**: Task 2.1 — Audit current 9-step onboarding
**Context**: Milestone 1 complete. CLAUDE.md updated to reflect Supabase auth, new routes (auth/portfolio/market-rates), updated env vars, and corrected feature list. Begin Milestone 2: Onboarding Redesign.
