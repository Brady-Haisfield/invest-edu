-- Meridian — Supabase PostgreSQL schema
-- Run this once in the new project's SQL Editor (Supabase dashboard → SQL Editor → New query).
-- Matches the shape server/routes/auth.js actually reads/writes (verified against code, not just docs).
-- Incorporates the fixes SCHEMA_AUDIT.md called for: UUID user_id, CASCADE deletes, indexes, RLS.

create extension if not exists pgcrypto;

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per user. user_id is both the PK and the FK — no separate surrogate id.
create table public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  profile_data   jsonb not null,
  refine_data    jsonb,
  last_cards     jsonb,
  last_narrative text,
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- ── saved_plans ─────────────────────────────────────────────────────────────
create table public.saved_plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  plan_name          text not null,
  inputs             jsonb not null,
  cards              jsonb not null,
  advisor_narrative  text,
  created_at         timestamptz not null default now()
);

create index saved_plans_user_id_idx on public.saved_plans(user_id);

alter table public.saved_plans enable row level security;

create policy "saved_plans_select_own" on public.saved_plans
  for select using (auth.uid() = user_id);
create policy "saved_plans_insert_own" on public.saved_plans
  for insert with check (auth.uid() = user_id);
create policy "saved_plans_delete_own" on public.saved_plans
  for delete using (auth.uid() = user_id);

-- ── portfolio_holdings ──────────────────────────────────────────────────────
create table public.portfolio_holdings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  ticker           text not null,
  name             text,
  security_type    text,
  amount_invested  numeric not null,
  shares           numeric,
  purchase_price   numeric,
  purchase_month   integer,
  purchase_year    integer,
  account_type     text,
  added_from       text not null default 'manual',
  added_at         timestamptz not null default now()
);

create index portfolio_holdings_user_id_idx on public.portfolio_holdings(user_id);

alter table public.portfolio_holdings enable row level security;

create policy "portfolio_holdings_select_own" on public.portfolio_holdings
  for select using (auth.uid() = user_id);
create policy "portfolio_holdings_insert_own" on public.portfolio_holdings
  for insert with check (auth.uid() = user_id);
create policy "portfolio_holdings_update_own" on public.portfolio_holdings
  for update using (auth.uid() = user_id);
create policy "portfolio_holdings_delete_own" on public.portfolio_holdings
  for delete using (auth.uid() = user_id);

-- Note: the server always queries via the service-role key (services/supabase.js),
-- which bypasses RLS. These policies are the defense-in-depth layer SCHEMA_AUDIT.md
-- recommended, in case any client-side query is ever added later.

-- ── market_universe ─────────────────────────────────────────────────────────
-- Broad, pre-computed candidate universe for the suggestions feature, populated by a
-- background job (server/jobs/universeRefreshJob.js) that seeds every US-listed
-- common stock/ETF/REIT from Finnhub's bulk symbol list, then rolls through refreshing
-- fundamentals a batch at a time (respecting Finnhub's free-tier rate limit) so live
-- suggestion requests can query a large, real universe instead of doing live API calls.
-- No RLS — server-only table, accessed exclusively via the service-role key.
create table public.market_universe (
  ticker          text primary key,
  name            text not null,
  type            text not null,  -- 'stock' | 'etf' | 'reit'
  sector          text,           -- null until fundamentals are fetched
  price           numeric,
  pe_ratio        numeric,
  market_cap      numeric,
  dividend_yield  numeric,
  beta            numeric,
  updated_at      timestamptz     -- null = seed row, fundamentals never fetched yet
);

create index market_universe_updated_at_idx on public.market_universe(updated_at nulls first);
create index market_universe_type_sector_idx on public.market_universe(type, sector);
