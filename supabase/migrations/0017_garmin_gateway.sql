-- Integração Garmin temporária por gateway Go.
-- Esta migration não cria políticas de leitura para credenciais, tentativas ou
-- sincronização. Essas tabelas só são acessadas via service_role no backend.

-- Estados descartáveis de conexão. O estado original não é persistido: apenas
-- SHA-256(state), tornando a URL pública inútil se o banco for exposto.
create table if not exists public.garmin_connection_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  mfa_challenge_ciphertext text,
  mfa_attempts integer not null default 0 check (mfa_attempts >= 0 and mfa_attempts <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_garmin_connection_attempts_active
  on public.garmin_connection_attempts (expires_at)
  where consumed_at is null;
alter table public.garmin_connection_attempts enable row level security;
drop trigger if exists trg_updated_at on public.garmin_connection_attempts;
create trigger trg_updated_at before update on public.garmin_connection_attempts
  for each row execute function public.set_updated_at();

-- Nonces de gateway persistentes impedem replay quando houver mais de uma
-- instância do gateway. São descartados pelo processo de manutenção do host.
create table if not exists public.garmin_gateway_nonces (
  nonce_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_garmin_gateway_nonces_expiry
  on public.garmin_gateway_nonces (expires_at);
alter table public.garmin_gateway_nonces enable row level security;

-- ID externo real: nunca identificar um dispositivo somente pelo nome.
alter table public.garmin_devices
  add column if not exists external_device_id text;
create unique index if not exists idx_garmin_devices_user_external_id
  on public.garmin_devices (user_id, external_device_id)
  where external_device_id is not null;

-- A chave de idempotência diferencia envios do mesmo treino agendados em
-- datas distintas e permite controle explícito de cada operação.
alter table public.external_workouts
  add column if not exists scheduled_date date,
  add column if not exists idempotency_key text,
  add column if not exists attempts integer not null default 0 check (attempts >= 0 and attempts <= 3),
  add column if not exists processing_started_at timestamptz;

update public.external_workouts
  set sync_status = 'success'
  where sync_status = 'synced';

alter table public.external_workouts
  drop constraint if exists external_workouts_sync_status_check;
alter table public.external_workouts
  add constraint external_workouts_sync_status_check
  check (sync_status in ('pending', 'processing', 'success', 'failed'));

alter table public.external_workouts
  drop constraint if exists external_workouts_planned_workout_id_provider_key;
create unique index if not exists idx_external_workouts_garmin_idempotency
  on public.external_workouts (user_id, planned_workout_id, provider, scheduled_date)
  where scheduled_date is not null;
create unique index if not exists idx_external_workouts_idempotency_key
  on public.external_workouts (idempotency_key)
  where idempotency_key is not null;

-- Claim atômico: cinco chamadas simultâneas para user + workout + data +
-- provider retornam apenas um claimed=true. O restante só observa o estado.
create or replace function public.claim_garmin_workout_sync(
  p_user_id uuid,
  p_planned_workout_id uuid,
  p_scheduled_date date,
  p_idempotency_key text
)
returns table (
  workout_sync_id uuid,
  claimed boolean,
  sync_status text,
  external_workout_id text,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.external_workouts%rowtype;
begin
  -- Serializa apenas esta combinação, sem bloquear outros usuários/treinos.
  perform pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || ':' || p_planned_workout_id::text || ':' || p_scheduled_date::text || ':garmin', 0
  ));

  select * into current_row
  from public.external_workouts
  where user_id = p_user_id
    and planned_workout_id = p_planned_workout_id
    and provider = 'garmin'
    and scheduled_date = p_scheduled_date
  limit 1
  for update;

  if found then
    if current_row.sync_status in ('success', 'processing') or current_row.attempts >= 3 then
      return query select current_row.id, false, current_row.sync_status, current_row.external_workout_id, current_row.attempts;
      return;
    end if;

    update public.external_workouts
    set sync_status = 'processing',
        attempts = current_row.attempts + 1,
        idempotency_key = p_idempotency_key,
        processing_started_at = now(),
        last_error = null,
        updated_at = now()
    where id = current_row.id
    returning * into current_row;

    return query select current_row.id, true, current_row.sync_status, current_row.external_workout_id, current_row.attempts;
    return;
  end if;

  insert into public.external_workouts (
    user_id, planned_workout_id, provider, scheduled_date, idempotency_key,
    sync_status, attempts, processing_started_at
  ) values (
    p_user_id, p_planned_workout_id, 'garmin', p_scheduled_date, p_idempotency_key,
    'processing', 1, now()
  ) returning * into current_row;

  return query select current_row.id, true, current_row.sync_status, current_row.external_workout_id, current_row.attempts;
end;
$$;

revoke all on function public.claim_garmin_workout_sync(uuid, uuid, date, text) from public;
grant execute on function public.claim_garmin_workout_sync(uuid, uuid, date, text) to service_role;
