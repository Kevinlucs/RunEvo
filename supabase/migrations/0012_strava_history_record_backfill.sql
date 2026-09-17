-- Histórico de recordes Strava.
-- O cursor por conta permite examinar todo o perfil em lotes, de forma
-- retomável e respeitando os limites da API do Strava.

create table if not exists public.strava_history_sync_states (
  account_id uuid primary key references public.connected_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  next_page integer not null default 1 check (next_page >= 1),
  scanned_activities integer not null default 0 check (scanned_activities >= 0),
  imported_activities integer not null default 0 check (imported_activities >= 0),
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strava_history_sync_states_user
  on public.strava_history_sync_states(user_id);

alter table public.strava_history_sync_states enable row level security;

-- O estado é administrado exclusivamente pelas Edge Functions, através da
-- service_role. Não há dados ou controles expostos diretamente ao aplicativo.
grant select, insert, update, delete on table public.strava_history_sync_states to service_role;

drop trigger if exists trg_updated_at on public.strava_history_sync_states;
create trigger trg_updated_at before update on public.strava_history_sync_states
  for each row execute function public.set_updated_at();
