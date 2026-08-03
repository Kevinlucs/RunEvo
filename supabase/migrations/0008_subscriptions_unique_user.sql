-- docs/fase-7-brief.md Grupo 1. O webhook do RevenueCat faz upsert em
-- `subscriptions` com `onConflict: 'user_id'` — precisa de um índice único
-- em `user_id` pra isso funcionar (hoje só há PK em `id`, então cada evento
-- viraria uma linha nova em vez de atualizar a existente).
--
-- Defensivo: se já existir mais de uma linha por usuário (não deveria, mas
-- as migrations nem sempre foram aplicadas em ordem no ambiente remoto —
-- ver docs de achados da Fase 4), mantém só a mais recente por
-- `updated_at` antes de criar a constraint, senão o ADD CONSTRAINT falha.
delete from public.subscriptions a
using public.subscriptions b
where a.user_id = b.user_id
  and a.updated_at < b.updated_at;

alter table public.subscriptions
  add constraint subscriptions_user_id_key unique (user_id);
