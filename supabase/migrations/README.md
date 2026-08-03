# Migrations RunEvo

Ordem versionada (fonte de verdade do schema):

1. `0001_init.sql` — tabelas base (+ correções da auditoria: `validation/quality/risk`, `feeling/pain`, `adjustment`).
2. `0002_updated_at_triggers.sql` — `updated_at` automático (relógio lógico do sync).
3. `0003_rls.sql` — Row Level Security por usuário; `subscriptions` só leitura no cliente.
4. `0004_profile_bootstrap.sql` — cria `athlete_profiles` no cadastro.
5. `0005_delete_account.sql` — RPC `delete_own_account` (SECURITY DEFINER).
6. `0008_subscriptions_unique_user.sql` — índice único em `subscriptions.user_id`, necessário pro upsert idempotente do webhook do RevenueCat (docs/fase-7-brief.md Grupo 1).

## Aplicar

```bash
supabase db push                 # aplica as migrations no projeto linkado
npm run db:types                 # gera src/types/database.types.ts a partir do schema
```

> Contas locais do PWA legado NÃO são migradas (eram testes).
