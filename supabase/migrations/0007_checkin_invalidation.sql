-- Fase 5 Grupo 4 (§22) — editor manual de treinos: editar um treino de uma
-- semana que já teve check-in invalida aquele check-in (o atleta precisa
-- refazer). Mantido como linha histórica, não apagado.

alter table public.weekly_checkins
  add column if not exists invalidated boolean not null default false,
  add column if not exists invalidated_reason text;
