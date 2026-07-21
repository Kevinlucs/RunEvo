-- RunEvo — 0001 init. Fonte de verdade do schema (nuvem).
-- Baseado no schema legado, com correções da auditoria (Fase 0).
create extension if not exists "pgcrypto";

-- PERFIL DO ATLETA (id = auth.users.id)
create table if not exists public.athlete_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  birth_date date,
  height_cm numeric(5,2),
  current_weight_kg numeric(5,2),
  imc numeric(5,2),
  preferred_unit text not null default 'km' check (preferred_unit in ('km','mi')),
  language text not null default 'pt-BR',
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  onboarding_seen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PLANILHAS
create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text not null,
  race_name text,
  race_distance_km numeric(7,2),
  start_date date,
  race_date date,
  total_weeks integer,
  days_per_week integer,
  objective text,
  terrain text check (terrain in ('plano','misto','elevado')),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  user_data jsonb not null default '{}'::jsonb,
  blueprint jsonb not null default '{}'::jsonb,
  -- correção da auditoria: relatórios do motor persistidos como colunas próprias
  validation jsonb not null default '{}'::jsonb,
  quality jsonb not null default '{}'::jsonb,
  risk jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Regra Free: no máximo 1 plano ativo por usuário
create unique index if not exists uniq_active_plan_per_user
  on public.training_plans(user_id) where status = 'active';

-- TREINOS
create table if not exists public.plan_workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number integer not null,
  week_index integer not null default 0,
  phase text,
  workout_date date,
  day_label text,
  day_type text,
  title text,
  description text,
  planned_km numeric(7,2),
  planned_pace text,
  status text not null default 'pending' check (status in ('pending','completed','skipped')),
  completed_km numeric(7,2),
  perceived_effort integer check (perceived_effort between 1 and 10),
  -- correção da auditoria: o app coleta feeling/pain categóricos
  feeling text,
  pain boolean,
  feedback text,
  shoe_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CHECK-INS
create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number integer not null,
  current_weight_kg numeric(5,2),
  fatigue_level integer check (fatigue_level between 1 and 10),
  pain_level integer check (pain_level between 0 and 10),
  feeling text,
  notes text,
  ai_analysis jsonb not null default '{}'::jsonb,
  -- correção da auditoria: ajuste aplicado (Adaptive Training) persistido
  adjustment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, week_number)
);

-- TÊNIS
create table if not exists public.running_shoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text,
  model text not null,
  nickname text,
  initial_km numeric(7,2) not null default 0,
  current_km numeric(7,2) not null default 0,
  max_km numeric(7,2) not null default 600,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.plan_workouts drop constraint if exists plan_workouts_shoe_id_fkey;
alter table public.plan_workouts
  add constraint plan_workouts_shoe_id_fkey
  foreign key (shoe_id) references public.running_shoes(id) on delete set null;

-- ASSINATURA
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('google_play','apple','web','manual')),
  product_id text,
  status text not null default 'free' check (status in ('free','trialing','active','past_due','canceled','expired')),
  current_period_end timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
