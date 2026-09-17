-- Catálogo e progresso real da importação histórica do Strava.
-- As atividades são descobertas primeiro e processadas em lotes controlados;
-- assim o app pode apresentar uma porcentagem exata sem exceder a API.

alter table public.strava_history_sync_states
  add column if not exists discovery_page integer,
  add column if not exists discovery_completed_at timestamptz,
  add column if not exists total_activities integer not null default 0,
  add column if not exists processed_activities integer not null default 0,
  add column if not exists next_sync_at timestamptz;

create table if not exists public.strava_history_sync_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.connected_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_activity_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, external_activity_id)
);

create index if not exists idx_strava_history_sync_items_pending
  on public.strava_history_sync_items(account_id, status, created_at);

alter table public.strava_history_sync_items enable row level security;
grant select, insert, update, delete on table public.strava_history_sync_items to service_role;

drop trigger if exists trg_updated_at on public.strava_history_sync_items;
create trigger trg_updated_at before update on public.strava_history_sync_items
  for each row execute function public.set_updated_at();
