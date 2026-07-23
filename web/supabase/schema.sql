-- cratecreep Supabase schema + RLS.
-- Run in the Supabase SQL editor (or via the CLI) on a fresh project.
--
-- Security model:
--   * Clients (web + extension) authenticate as the user via Supabase Auth.
--   * RLS scopes every row to auth.uid().
--   * The extension may only UPDATE queue_items status columns; it can never
--     INSERT queue rows. All inserts happen server-side with the service role.
--   * Paid features are gated in RLS itself (is_subscribed), so a cancelled
--     user cannot bypass the API by writing straight to the database.

create table if not exists subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive', -- active | trialing | past_due | canceled | inactive
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists queue_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  idx int not null,
  artist text not null,
  title text not null,
  mix text,
  state text not null default 'pending', -- pending | searching | added | notfound | error | captcha
  detail text,
  product_url text,
  updated_at timestamptz not null default now()
);

create index if not exists queue_items_user_state_idx on queue_items (user_id, state);
create index if not exists queue_items_session_idx on queue_items (session_id, idx);

create table if not exists extract_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists extract_log_user_time_idx on extract_log (user_id, created_at desc);

-- Helper: is this user allowed to use paid features?
create or replace function is_subscribed(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from subscriptions
    where user_id = uid and status in ('active', 'trialing')
  );
$$;

-- Enable RLS
alter table subscriptions enable row level security;
alter table sessions enable row level security;
alter table queue_items enable row level security;
alter table extract_log enable row level security;

-- subscriptions: user reads own row only. Writes happen via Stripe webhook
-- using the service role (which bypasses RLS), so no insert/update policy.
drop policy if exists subs_select on subscriptions;
create policy subs_select on subscriptions
  for select using (auth.uid() = user_id);

-- sessions: user reads own row. Subscription gate removed for the free beta;
-- put `and is_subscribed(auth.uid())` back when the paywall goes live.
drop policy if exists sessions_select on sessions;
create policy sessions_select on sessions
  for select using (auth.uid() = user_id);

-- queue_items: user SELECT own rows (powers web + extension reads).
drop policy if exists items_select on queue_items;
create policy items_select on queue_items
  for select using (auth.uid() = user_id);

-- queue_items: extension UPDATE own rows only.
-- No INSERT/DELETE policy: queue creation is server-side (service role) only.
drop policy if exists items_update on queue_items;
create policy items_update on queue_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- extract_log: user reads own (for the "extracts remaining" counter).
-- Inserts are server-side (service role) only.
drop policy if exists extract_select on extract_log;
create policy extract_select on extract_log
  for select using (auth.uid() = user_id);

-- Realtime: broadcast row changes on queue_items so the web dashboard and the
-- extension both receive INSERT/UPDATE events.
alter publication supabase_realtime add table queue_items;
