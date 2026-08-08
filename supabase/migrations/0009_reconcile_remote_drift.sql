-- Reconcilia o banco remoto com as migrations depois que `supabase db diff
-- --linked` (§fase-7.5, Parada 2) achou drift real além das 6 colunas
-- órfãs/faltantes já corrigidas manualmente (archived_at/plan_json/race/
-- score/title em training_plans; updated_at em plan_workouts/running_shoes/
-- weekly_checkins). A partir daqui as migrations voltam a ser a única fonte
-- de verdade — nenhuma correção deste tipo deve ser feita por SQL manual.
--
-- Achados e decisões (usuário, 2026-08-08):
-- 1) subscriptions_user_id_key nunca pegou de fato no remoto, mesmo com
--    0008 marcada como aplicada no histórico — reaplica com a mesma
--    proteção defensiva (dedup antes do ADD CONSTRAINT).
-- 2) training_plans.risk estava como TEXT no remoto (migrations definem
--    jsonb) — mesma classe de bug do achado de Fase 4 ("gap de JSON no
--    BaseRepository"). Decisão: remoto está errado, migrations mantêm a
--    intenção original (jsonb), converte de volta.
-- 3) training_plans_user_status_updated_idx existia no remoto sem
--    migration — bate com o padrão de query do histórico (user_id, status,
--    updated_at). Decisão: formalizar, é intencional.
-- 4) 4 políticas RLS granulares redundantes em training_plans coexistiam
--    com a política única "plans_crud_own" (0004_rls.sql). Decisão: manter
--    só a política única, remover as 4 extras.
-- 5) Grants explícitos de anon/authenticated/service_role existiam no
--    remoto sem migration (provável boilerplate padrão do Supabase) —
--    formalizados aqui por completude, para que um ambiente novo criado só
--    a partir das migrations tenha paridade com o remoto atual.

-- 1) subscriptions: garante a constraint única em user_id.
delete from public.subscriptions a
using public.subscriptions b
where a.user_id = b.user_id
  and a.updated_at < b.updated_at;

alter table public.subscriptions
  drop constraint if exists subscriptions_user_id_key;
alter table public.subscriptions
  add constraint subscriptions_user_id_key unique (user_id);

-- 2) training_plans.risk: volta a ser jsonb (intenção original de 0001).
-- Condicional ao tipo atual: no remoto real (hoje TEXT) converte de fato;
-- num ambiente novo criado só a partir das migrations (já jsonb desde
-- 0001/0002) isso é um no-op — `trim()` não existe para jsonb, por isso
-- não dá pra usar um `alter column type` estático aqui.
do $$
declare
  current_type text;
begin
  select data_type into current_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'training_plans' and column_name = 'risk';

  if current_type = 'text' then
    execute $sql$
      alter table public.training_plans
        alter column risk type jsonb
        using coalesce(nullif(trim(both from risk), ''), '{}')::jsonb
    $sql$;
  end if;
end $$;

alter table public.training_plans
  alter column risk set default '{}'::jsonb;
alter table public.training_plans
  alter column risk set not null;

-- 3) índice de leitura do histórico (user_id, status, updated_at).
create index if not exists training_plans_user_status_updated_idx
  on public.training_plans using btree (user_id, status, updated_at desc);

-- 4) remove as políticas granulares redundantes; plans_crud_own continua
--    sendo a única política de training_plans.
drop policy if exists "Users can delete own training plans" on public.training_plans;
drop policy if exists "Users can insert own training plans" on public.training_plans;
drop policy if exists "Users can select own training plans" on public.training_plans;
drop policy if exists "Users can update own training plans" on public.training_plans;

-- 5) grants explícitos, por completude/paridade com o remoto atual.
grant select, insert, update, delete on table public.athlete_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on table public.training_plans to anon, authenticated, service_role;
grant select, insert, update, delete on table public.plan_workouts to anon, authenticated, service_role;
grant select, insert, update, delete on table public.weekly_checkins to anon, authenticated, service_role;
grant select, insert, update, delete on table public.running_shoes to anon, authenticated, service_role;
grant select, insert, update, delete on table public.subscriptions to anon, authenticated, service_role;
