-- RunEvo v2 — ajustes derivados da auditoria (legacy-audit.md §12).
-- 1) training_plans: guardar validation/quality/risk como colunas próprias.
-- 2) plan_workouts: normalizar feeling/pain coletados na conclusão do treino.
-- 3) weekly_checkins: normalizar feeling (categórico) + adjustment (jsonb) do Adaptive Training.

alter table public.training_plans
  add column if not exists validation jsonb not null default '{}'::jsonb,
  add column if not exists quality jsonb not null default '{}'::jsonb,
  add column if not exists risk jsonb not null default '{}'::jsonb;

alter table public.plan_workouts
  add column if not exists feeling text,
  add column if not exists pain boolean;

alter table public.weekly_checkins
  add column if not exists feeling text,
  add column if not exists adjustment jsonb not null default '{}'::jsonb;

-- trigger utilitário para updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_updated on public.athlete_profiles;
create trigger trg_profiles_updated before update on public.athlete_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_plans_updated on public.training_plans;
create trigger trg_plans_updated before update on public.training_plans
  for each row execute function public.set_updated_at();

drop trigger if exists trg_subs_updated on public.subscriptions;
create trigger trg_subs_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();
