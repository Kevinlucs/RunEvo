-- Fase 2 da integração Strava:
-- recordes passam a ser sincronizados para que marcas importadas pelo backend
-- cheguem ao cache local do atleta junto com os dados manuais já existentes.

create table if not exists public.personal_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null,
  time_str text not null,
  date_iso date,
  source text not null default 'manual'
    check (source in ('manual', 'strava')),
  external_url text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_personal_records_user_key
  on public.personal_records(user_id, record_key, updated_at desc);

alter table public.personal_records enable row level security;

drop policy if exists "personal_records_crud_own" on public.personal_records;
create policy "personal_records_crud_own" on public.personal_records for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.personal_records
  to anon, authenticated, service_role;
