-- A atividade externa confirma o treino; o feedback subjetivo continua
-- pendente até o atleta responder. A publicação Realtime faz a Home reagir
-- quando o webhook atualizar um treino enquanto o app está aberto.

create index if not exists idx_plan_workouts_pending_post_workout_checkin
  on public.plan_workouts(user_id, completed_at desc)
  where status = 'completed' and check_in_status = 'pending';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'plan_workouts'
    ) then
    alter publication supabase_realtime add table public.plan_workouts;
  end if;
end $$;
