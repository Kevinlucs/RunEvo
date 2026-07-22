# RunEvo — App mobile (React Native + Expo)

Reconstrução nativa do RunEvo. Fase 1 entregue: scaffold, tema, navegação,
autenticação Supabase e camada offline-first (SQLite ↔ Supabase com outbox).

## Arquitetura (resumo)

```
UI (src/app, expo-router)
  → store (zustand) / hooks / TanStack Query
    → services (auth, ...)           services/ai NÃO altera planos direto
    → repositories (offline-first)   toda escrita: SQLite local + outbox
      → db (SQLite cache + sync engine) ── nuvem vence conflito
      → lib/supabase (fonte de verdade na nuvem, RLS)
domain/ (Motor RunEvo — Fase 2) é PURO: não importa react-native
```

## Rodar (local, requer internet para instalar deps)

```bash
cp .env.example .env      # preencha SUPABASE URL + anon key
npm install
npx expo start            # Expo Go / dev client

# Banco
supabase db push          # aplica supabase/migrations/*
npm run db:types          # gera src/types/database.types.ts
# ⚠️ src/types/database.types.ts está commitado mas foi derivado manualmente
# de supabase/migrations/*.sql (sem SUPABASE_ACCESS_TOKEN/login no ambiente
# em que foi gerado). Pode dessincronizar do banco real — rode `supabase login`
# e `npm run db:types` para regenerar pelo CLI assim que houver credencial.

# Qualidade
npm run typecheck && npm run lint && npm test
```

## O que já existe

- TS strict + ESLint (com regra de fronteira: `domain` não importa RN) + Prettier.
- Expo Router: `(auth)` [entrar/cadastrar/recuperar] e `(tabs)` [Início·Treinos·IA Evo·Estatísticas] + Perfil pelo avatar. Guard de sessão no `_layout`.
- Supabase Auth (e-mail/senha, Google/Apple via OAuth nativo, reset, excluir conta) com sessão cifrada no SecureStore (adapter com fragmentação p/ o limite de 2KB).
- Migrations versionadas + RLS + triggers `updated_at` + bootstrap de perfil + RPC de exclusão.
- Cache offline SQLite espelhando o schema + **outbox de sync** com resolução de conflito (nuvem vence), testado.
- Repositórios tipados (perfil, plano, treino, check-in, tênis, assinatura) — a UI nunca fala com Supabase direto.

## O que NÃO está aqui (próximas fases)

- Motor RunEvo (`domain/motor-evo`) → Fase 2.
- IA Evo / blueprint / geração / prévia → Fase 3.
- Home, Treinos, detalhe → Fase 4. Adaptive Training/edição/sync de conteúdo → Fase 5.
- Estatísticas, perfil completo, tênis, RunEvo+ → Fase 6. PDF/Excel/assinatura/lojas → Fase 7.
