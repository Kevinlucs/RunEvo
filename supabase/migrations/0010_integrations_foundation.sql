-- Fase Extra — Etapa 1: fundação das integrações.
-- Tokens jamais são expostos por RLS: somente Edge Functions com service_role
-- leem/escrevem token_ciphertext.

create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'coros', 'polar', 'amazfit')),
  provider_user_id text,
  status text not null default 'disconnected'
    check (status in ('connected', 'expired', 'reauth_required', 'disconnected', 'error')),
  scopes text[] not null default '{}'::text[],
  token_ciphertext text,
  token_expires_at timestamptz,
  settings jsonb not null default '{"activity_enrichment": false}'::jsonb,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava')),
  state_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_integration_oauth_states_expiry
  on public.integration_oauth_states(expires_at);

create table if not exists public.athlete_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_type text not null default 'run',
  start_at timestamptz not null,
  distance_m numeric(10,2) not null check (distance_m >= 0),
  duration_s integer not null check (duration_s >= 0),
  title text,
  external_url text,
  matched_workout_id uuid references public.plan_workouts(id) on delete set null,
  match_type text check (match_type in (
    'direct_provider_match', 'auto_match', 'needs_confirmation', 'unmatched'
  )),
  match_score integer check (match_score between 0 and 100),
  source_priority integer not null default 99,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_athlete_activities_user_started
  on public.athlete_activities(user_id, start_at desc);
create index if not exists idx_athlete_activities_unmatched
  on public.athlete_activities(user_id, match_type) where matched_workout_id is null;

create table if not exists public.activity_sources (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.athlete_activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'coros', 'polar', 'amazfit', 'manual', 'runevo')),
  external_activity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_activity_id)
);
create index if not exists idx_activity_sources_activity on public.activity_sources(activity_id);
create index if not exists idx_activity_sources_user_provider on public.activity_sources(user_id, provider);

create table if not exists public.external_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  planned_workout_id uuid not null references public.plan_workouts(id) on delete cascade,
  provider text not null check (provider in ('garmin', 'coros', 'polar', 'amazfit')),
  external_workout_id text,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'failed')),
  synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planned_workout_id, provider),
  unique (provider, external_workout_id)
);
create index if not exists idx_external_workouts_external
  on public.external_workouts(provider, external_workout_id)
  where external_workout_id is not null;

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null check (provider in ('strava', 'garmin', 'coros', 'polar', 'amazfit')),
  event_type text not null,
  external_object_id text not null,
  event_time timestamptz,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_type, external_object_id, event_time)
);
create index if not exists idx_integration_events_pending
  on public.integration_events(status, created_at)
  where status in ('pending', 'failed');

alter table public.plan_workouts
  add column if not exists check_in_status text not null default 'not_required'
    check (check_in_status in ('not_required', 'pending', 'completed'));
alter table public.plan_workouts
  add column if not exists completion_source text
    check (completion_source in ('manual', 'strava_auto_match'));
alter table public.plan_workouts
  add column if not exists completion_activity_id uuid
    references public.athlete_activities(id) on delete set null;
alter table public.plan_workouts
  add column if not exists completion_match_type text
    check (completion_match_type in (
      'direct_provider_match', 'auto_match', 'needs_confirmation', 'unmatched'
    ));
alter table public.plan_workouts
  add column if not exists completion_match_score integer
    check (completion_match_score between 0 and 100);

create index if not exists idx_plan_workouts_checkin_pending
  on public.plan_workouts(user_id, completed_at desc)
  where check_in_status = 'pending';

-- O usuário lê apenas as atividades próprias. As tabelas de credencial/fila
-- são acessadas exclusivamente pelo backend com service_role.
alter table public.connected_accounts enable row level security;
alter table public.integration_oauth_states enable row level security;
alter table public.athlete_activities enable row level security;
alter table public.activity_sources enable row level security;
alter table public.external_workouts enable row level security;
alter table public.integration_events enable row level security;

drop policy if exists "athlete_activities_select_own" on public.athlete_activities;
create policy "athlete_activities_select_own" on public.athlete_activities
  for select using (auth.uid() = user_id);

drop policy if exists "activity_sources_select_own" on public.activity_sources;
create policy "activity_sources_select_own" on public.activity_sources
  for select using (auth.uid() = user_id);

drop policy if exists "external_workouts_select_own" on public.external_workouts;
create policy "external_workouts_select_own" on public.external_workouts
  for select using (auth.uid() = user_id);

do $$
declare t text;
begin
  foreach t in array array[
    'connected_accounts', 'athlete_activities', 'activity_sources',
    'external_workouts', 'integration_events'
  ] loop
    execute format('drop trigger if exists trg_updated_at on public.%I;', t);
    execute format(
      'create trigger trg_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;
