-- Mantém updated_at coerente — base do relógio lógico do sync (nuvem vence).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'athlete_profiles','training_plans','plan_workouts',
    'weekly_checkins','running_shoes','subscriptions'
  ] loop
    execute format('drop trigger if exists trg_updated_at on public.%I;', t);
    execute format(
      'create trigger trg_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;
