-- RLS: cada atleta acessa apenas os próprios dados.
alter table public.athlete_profiles enable row level security;
alter table public.training_plans   enable row level security;
alter table public.plan_workouts     enable row level security;
alter table public.weekly_checkins   enable row level security;
alter table public.running_shoes     enable row level security;
alter table public.subscriptions     enable row level security;

drop policy if exists "profiles_select_own" on public.athlete_profiles;
drop policy if exists "profiles_insert_own" on public.athlete_profiles;
drop policy if exists "profiles_update_own" on public.athlete_profiles;
create policy "profiles_select_own" on public.athlete_profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.athlete_profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.athlete_profiles for update using (auth.uid() = id);

drop policy if exists "plans_crud_own" on public.training_plans;
create policy "plans_crud_own" on public.training_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts_crud_own" on public.plan_workouts;
create policy "workouts_crud_own" on public.plan_workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "checkins_crud_own" on public.weekly_checkins;
create policy "checkins_crud_own" on public.weekly_checkins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shoes_crud_own" on public.running_shoes;
create policy "shoes_crud_own" on public.running_shoes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Assinatura: usuário só lê. Escrita vem de webhook/serviço (service_role),
-- garantindo que entitlement seja validado no backend, não no cliente.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);
