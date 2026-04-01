# SQLite Schema Audit — Task 1.2
Last updated: 2026-04-01
Status: Complete

This document captures every table, column, constraint, index, relationship, JSON shape,
migration behavior, and data integrity issue in the current SQLite database.
It is the primary input for Task 1.4 (Supabase PostgreSQL schema design).

---

## Tables Overview

| Table | Rows (dev) | Primary key | Notes |
|---|---|---|---|
| users | 2 | INTEGER AUTOINCREMENT | Auth table — being replaced by Supabase Auth |
| profiles | 1 | INTEGER AUTOINCREMENT | One per user (UNIQUE on user_id) |
| saved_plans | 1 | INTEGER AUTOINCREMENT | Many per user, no index on user_id |
| portfolio_holdings | 3 | INTEGER AUTOINCREMENT | Many per user, no index on user_id |

---

## Table: users

**Purpose:** Stores login credentials. Will be fully replaced by Supabase Auth — this table does not migrate.

| # | Column | Type | NOT NULL | Default | PK |
|---|---|---|---|---|---|
| 0 | id | INTEGER | no | — | ✓ |
| 1 | email | TEXT | yes | — | — |
| 2 | password_hash | TEXT | yes | — | — |
| 3 | created_at | DATETIME | no | CURRENT_TIMESTAMP | — |

**Indexes:**
- `sqlite_autoindex_users_1` — UNIQUE on `email` (auto-created from UNIQUE constraint)

**Foreign keys:** none

**Issues for migration:**
- Entire table is replaced by Supabase Auth. No data migration needed.
- `password_hash` (bcrypt) cannot be migrated to Supabase Auth — users will need to reset passwords or re-register. Decide on strategy before Task 1.6.
- `created_at` maps to `created_at` in Supabase Auth's `auth.users` metadata.

---

## Table: profiles

**Purpose:** One profile per user. Stores the investment profile (core inputs), refine panel state, last AI-generated cards, and last advisor narrative.

| # | Column | Type | NOT NULL | Default | PK |
|---|---|---|---|---|---|
| 0 | id | INTEGER | no | — | ✓ |
| 1 | user_id | INTEGER | no | — | — |
| 2 | profile_data | TEXT | **yes** | — | — |
| 3 | updated_at | DATETIME | no | CURRENT_TIMESTAMP | — |
| 4 | refine_data | TEXT | no | null | — |
| 5 | last_cards | TEXT | no | null | — |
| 6 | last_narrative | TEXT | no | null | — |

**Indexes:**
- `sqlite_autoindex_profiles_1` — UNIQUE on `user_id`

**Foreign keys:**
- `user_id → users(id)` ON DELETE NO ACTION (no cascade — orphan risk if user deleted)

**Migration behavior:**
Columns 4–6 (`refine_data`, `last_cards`, `last_narrative`) were added via ALTER TABLE migration loop at startup, not in the original CREATE TABLE. This means:
- They are nullable even though `profile_data` is NOT NULL
- Older rows created before the migration loop ran may have been written without them
- The migration loop silently ignores already-existing columns via `catch {}`

**Column: profile_data (JSON)**

Keys present in live data:
```
dateOfBirth           { day: int, month: int, year: int }
goalMode              string — 'just-starting' | 'growing-wealth' | 'approaching-retirement' | 'already-retired'
amount                number
riskProfile           string — 'low' | 'medium' | 'high'
annualIncome          string — one of 6 income range labels
accountTypes          string[]
familySituation       string
upcomingExpenses      string[]
sectors               string[]
holdPeriod            string — 'short' | 'medium' | 'long'
employmentStatus      string (often empty)
emergencyFund         string (often empty)
existingInvestments   string[]
homeownership         string (often empty)
priorities            string[]
dropReaction          string (often empty)
themes                string[]
involvement           string (often empty)
investmentPurpose     string (often empty)
age                   number — COMPUTED from dateOfBirth at save time (stale risk)
firstName             string | null — new field, may be absent on older rows
targetRetirementAge   number | null
```

**Column: refine_data (JSON)**

Keys present in live data:
```
numChildren               string | number
childrenAges              string
monthlyDependentCosts     string | number
supportingAgingParents    string | null
totalSavings              string | number
liquidityFloor            string | number
monthlyTakeHome           string | number
monthlyExpenses           string | number
hasPension                string | null
pensionAmount             string | number
expectedSocialSecurity    string | number
targetRetirementAge       string | number
monthlyDebt               string | number
investmentExperience      string | null
```
Note: numeric fields are stored as strings (e.g. `"5000"`) when set by the refine panel,
empty string `""` when unset. The server stores whatever the client sends without coercion.

**Column: last_cards (JSON)**

Array of 5 card objects. Each card has keys:
```
ticker              string
name                string
price               number | null
fiftyTwoWeekLow     number | null
fiftyTwoWeekHigh    number | null
peRatio             number | null
marketCap           number | null
sector              string | null
currency            string | null
revenueGrowth3Y     number | null
revenueGrowth5Y     number | null
dividendYield       number | null
beta                number | null
grossMarginTTM      number | null
epsGrowth3Y         number | null
operatingCashFlow   number | null
freeCashFlow        number | null
ffo                 number | null
sharesOutstanding   number | null
reasoning           string
type                string — 'stock' | 'etf' | 'bond_etf' | 'reit'
portfolioRole       string
retirementLens      string | null
watchOut            string | null
```

**Column: last_narrative (TEXT)**

Plain text string (~1500 chars). The AI-generated advisor paragraph. Not JSON.

**Issues for migration:**
- `profile_data` is NOT NULL in SQLite but the column was originally just `TEXT` — the constraint was set when the table was first created, before columns 4–6 existed. Supabase should enforce NOT NULL on the equivalent column.
- `age` is stored in the JSON but is computed from `dateOfBirth` — it goes stale if a birthday passes without a re-save. Do NOT store computed `age` in PostgreSQL. Compute it at query time or in the application layer.
- `refine_data` numeric fields are stored as strings (`""` when unset, `"5000"` when set) — the server parses them via `Number(val) || 0`. In PostgreSQL, consider proper column types or stricter JSON validation.
- `lastUpdatedAt` is sent by the client in the POST body but the server only reads `inputs, refineInputs, lastCards, lastAdvisorNarrative` — it is silently dropped and never persisted. This causes `meData.savedProfile.lastUpdatedAt` to always be `undefined`. Fix: add `last_updated_at` as a proper column.
- No index on `user_id` beyond the UNIQUE constraint — fine for one-per-user pattern.

---

## Table: saved_plans

**Purpose:** Stores named investment plans saved by users. Many per user.

| # | Column | Type | NOT NULL | Default | PK |
|---|---|---|---|---|---|
| 0 | id | INTEGER | no | — | ✓ |
| 1 | user_id | INTEGER | no | — | — |
| 2 | plan_name | TEXT | yes | — | — |
| 3 | inputs | TEXT | yes | — | — |
| 4 | cards | TEXT | yes | — | — |
| 5 | advisor_narrative | TEXT | no | null | — |
| 6 | created_at | DATETIME | no | CURRENT_TIMESTAMP | — |

**Indexes:** none

**Foreign keys:**
- `user_id → users(id)` ON DELETE NO ACTION

**Column: inputs (JSON)**

Fully merged inputs object (base profile merged with refine panel values). Keys:
```
age, goalMode, amount, riskProfile, annualIncome, accountTypes, familySituation,
upcomingExpenses, sectors, holdPeriod, employmentStatus, emergencyFund,
existingInvestments, homeownership, priorities, dropReaction, themes, involvement,
investmentPurpose, numChildren, childrenAges, monthlyDependentCosts,
supportingAgingParents, totalSavings, liquidityFloor, monthlyTakeHome,
monthlyExpenses, monthlySurplus, hasPension, expectedSocialSecurity,
targetRetirementAge
```
Note: this is the merged inputs snapshot at save time — it includes both profile and
refine values baked together. `dateOfBirth` is absent here (age is stored instead).

**Column: cards (JSON)**

Array of 5 card objects. Same shape as `profiles.last_cards`.

**Issues for migration:**
- **No index on `user_id`** — a user with many saved plans will have a full table scan on every load. Add index in PostgreSQL.
- `user_id` is nullable (NOT NULL constraint missing in CREATE TABLE) — a plan could be saved without a user reference. Enforce NOT NULL in PostgreSQL.
- `inputs` snapshot includes `age` (computed) rather than `dateOfBirth` — same staleness risk as profiles.
- No limit enforced on number of plans per user — consider adding one in the application layer.

---

## Table: portfolio_holdings

**Purpose:** Individual investment holdings per user. Many per user.

| # | Column | Type | NOT NULL | Default | PK |
|---|---|---|---|---|---|
| 0 | id | INTEGER | no | — | ✓ |
| 1 | user_id | INTEGER | no | — | — |
| 2 | ticker | TEXT | yes | — | — |
| 3 | name | TEXT | no | null | — |
| 4 | security_type | TEXT | no | null | — |
| 5 | amount_invested | REAL | yes | — | — |
| 6 | shares | REAL | no | null | — |
| 7 | purchase_price | REAL | no | null | — |
| 8 | purchase_month | INTEGER | no | null | — |
| 9 | purchase_year | INTEGER | no | null | — |
| 10 | account_type | TEXT | no | null | — |
| 11 | added_from | TEXT | no | `'manual'` | — |
| 12 | added_at | DATETIME | no | CURRENT_TIMESTAMP | — |

**Indexes:** none

**Foreign keys:**
- `user_id → users(id)` ON DELETE NO ACTION

**Migration behavior:**
Columns 6–11 (`shares` through `added_from`) were added via ALTER TABLE migration loop.
`added_from` was added without its DEFAULT `'manual'` — ALTER TABLE in SQLite cannot add
defaults to new columns on existing rows. Older rows have `added_from = null`.

**Sample row:**
```json
{
  "id": 1,
  "user_id": 1,
  "ticker": "VGT",
  "name": "VGT",
  "security_type": "etf",
  "amount_invested": 1700,
  "shares": 4.25,
  "purchase_price": 400,
  "purchase_month": 3,
  "purchase_year": 2026,
  "account_type": "Taxable brokerage",
  "added_from": "suggestion",
  "added_at": "2026-03-30 21:08:39"
}
```

**Issues for migration:**
- **No index on `user_id`** — add index in PostgreSQL.
- **No UNIQUE constraint on `(user_id, ticker)`** — a user can hold the same ticker multiple times. This is intentional (multiple purchases at different prices) but worth confirming.
- **`shares` is a derived column** (`amount_invested / purchase_price`). The application layer recomputes it on the fly for gain/loss calculations anyway. Consider dropping it from the schema and computing it as a generated column or always computing in the query.
- **`user_id` nullable** — NOT NULL constraint missing. Enforce in PostgreSQL.
- **`added_from` default missing on migrated rows** — older rows have null. Backfill to `'manual'` on migration.
- **No `purchase_day`** — only month and year are stored. If exact purchase date is ever needed, add `purchase_day INTEGER`.

---

## Cross-Table Issues

### Cascade deletes missing everywhere
All foreign keys use `ON DELETE NO ACTION`. Deleting a user leaves orphaned rows in
`profiles`, `saved_plans`, and `portfolio_holdings`. PostgreSQL migration should use
`ON DELETE CASCADE` on all `user_id` foreign keys.

### No row-level security
SQLite has no RLS. All queries in server routes manually filter by `req.userId`.
PostgreSQL + Supabase RLS should enforce `user_id = auth.uid()` at the DB level as
a second layer of defense. This is especially important since the app will run on Railway
where the Supabase service key has full DB access.

### Unauthenticated Claude endpoints
`/api/suggestions` and `/api/forecast` have no auth check — anyone can hit them.
This is a server concern, not a schema concern, but blocking for Task 1.8.

---

## Migration Notes for Task 1.4

### What moves to PostgreSQL
- `profiles` → keep as single table, proper JSONB for `profile_data` and `refine_data`,
  proper columns for `last_cards` (JSONB array), `last_narrative` (TEXT), add `last_updated_at TIMESTAMPTZ`
- `saved_plans` → keep structure, add NOT NULL on `user_id`, add index on `user_id`
- `portfolio_holdings` → keep structure, add NOT NULL on `user_id`, add index on `user_id`, backfill `added_from`

### What does NOT move
- `users` table → replaced entirely by Supabase Auth (`auth.users`)
- `password_hash` → not migrated, users will need to re-authenticate

### Recommended schema improvements for PostgreSQL
1. Add `last_updated_at TIMESTAMPTZ` to profiles (fixes the `lastUpdatedAt` bug)
2. Add `ON DELETE CASCADE` to all `user_id` FKs
3. Add `INDEX ON saved_plans(user_id)`
4. Add `INDEX ON portfolio_holdings(user_id)`
5. Enforce `NOT NULL` on `user_id` in `saved_plans` and `portfolio_holdings`
6. Remove `age` from `profile_data` JSON — compute in application layer from `dateOfBirth`
7. Backfill `added_from = 'manual'` where null in `portfolio_holdings`
8. Consider a generated/computed column for `shares` in `portfolio_holdings`
9. Add Supabase RLS policy: `user_id = auth.uid()` on all user-scoped tables
