-- Fase futura: descontinua a implementação temporária de integrações de
-- relógios. O Strava continua como a única integração ativa do RunEvo.

-- Remove dados de provedores de relógio antes de restringir as tabelas
-- compartilhadas às fontes que permanecem suportadas.
delete from public.integration_events
where provider in ('garmin', 'coros', 'polar', 'amazfit');

delete from public.connected_accounts
where provider in ('garmin', 'coros', 'polar', 'amazfit');

-- Se uma atividade tiver somente uma fonte de relógio, ela deixa de ter origem
-- válida no produto e é removida. Atividades também recebidas por Strava ou
-- registradas manualmente são preservadas.
delete from public.athlete_activities activity
where exists (
  select 1
  from public.activity_sources source
  where source.activity_id = activity.id
    and source.provider in ('garmin', 'coros', 'polar', 'amazfit')
)
and not exists (
  select 1
  from public.activity_sources source
  where source.activity_id = activity.id
    and source.provider not in ('garmin', 'coros', 'polar', 'amazfit')
);

delete from public.activity_sources
where provider in ('garmin', 'coros', 'polar', 'amazfit');

-- Tabelas e rotina criadas exclusivamente para o gateway Garmin.
drop function if exists public.claim_garmin_workout_sync(uuid, uuid, date, text);
drop table if exists public.garmin_gateway_nonces;
drop table if exists public.garmin_connection_attempts;
drop table if exists public.garmin_devices;
drop table if exists public.external_workouts;

-- Os catálogos compartilhados ficam restritos às integrações realmente ativas.
alter table public.connected_accounts
  drop constraint if exists connected_accounts_provider_check;
alter table public.connected_accounts
  add constraint connected_accounts_provider_check
  check (provider = 'strava');

alter table public.activity_sources
  drop constraint if exists activity_sources_provider_check;
alter table public.activity_sources
  add constraint activity_sources_provider_check
  check (provider in ('strava', 'manual', 'runevo'));

alter table public.integration_events
  drop constraint if exists integration_events_provider_check;
alter table public.integration_events
  add constraint integration_events_provider_check
  check (provider = 'strava');

-- Flag temporária da implementação privada removida; flags Strava permanecem.
delete from public.system_flags
where key = 'GARMIN_PRIVATE_API_ENABLED';
