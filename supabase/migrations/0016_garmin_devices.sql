create table if not exists public.garmin_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  device_type text,
  battery_level integer check (battery_level between 0 and 100),
  status text not null default 'active' check (status in ('active', 'removed')),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_garmin_devices_user on public.garmin_devices(user_id) where status = 'active';

alter table public.garmin_devices enable row level security;

drop policy if exists "garmin_devices_select_own" on public.garmin_devices;
create policy "garmin_devices_select_own" on public.garmin_devices
  for select using (auth.uid() = user_id);

drop trigger if exists trg_updated_at on public.garmin_devices;
create trigger trg_updated_at before update on public.garmin_devices
  for each row execute function public.set_updated_at();

-- Add system flag for garmin if we don't have a table
create table if not exists public.system_flags (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.system_flags (key, value, description)
values ('GARMIN_PRIVATE_API_ENABLED', 'true', 'Ativa a integração temporária do Garmin')
on conflict (key) do update set value = excluded.value;
