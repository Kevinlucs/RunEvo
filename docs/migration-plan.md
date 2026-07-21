# RunEvo — Plano de Migração (PWA → React Native / Expo)

> Fase 0 — Estratégia de reconstrução mobile nativa preservando 100% do comportamento aprovado.
> Complementa `legacy-audit.md` e `motor-evo-specification.md`.

---

## 1. Princípios inegociáveis

1. **O Motor RunEvo é portado, não reinventado.** Nada de "peça pra IA gerar a planilha". IA = blueprint pequeno; motor = executor determinístico + validação local sempre.
2. **Domínio puro.** `src/domain/**` **não importa React Native**, nem `expo-*`, nem `Date` dependente de timezone implícito. Só funções puras + `zod`.
3. **Separação de camadas.** UI → hooks/store → services → repositories → Supabase. Componentes **não** calculam regra de treino.
4. **Persistência em repositories.** Nada de `localStorage`/`window`/`document`. Nuvem (Supabase) = fonte de verdade; cache offline (SQLite/AsyncStorage) + fila de mutações.
5. **Contratos validados por Zod** em toda fronteira (IA, banco, formulário).
6. **Assinatura atrás de interface** (`SubscriptionService`) — sem acoplar UI a SDK de billing; entitlement validado no serviço.
7. **UUID válidos** no banco; nunca IDs textuais em colunas UUID; migrations são a fonte de verdade; tipos TS gerados do schema.
8. **Sem versão web pública.** Domínio = landing (marketing, suporte, privacidade, termos, links das lojas).

---

## 2. Stack alvo (versões estáveis mutuamente compatíveis)

- **Runtime/UI:** React Native + Expo (SDK estável mais recente do dev), TypeScript **strict**, **Expo Router**, componentes nativos.
- **Estado:** Zustand (local) + TanStack Query (remoto/cache/sync).
- **Formulários:** React Hook Form + Zod (resolver).
- **Backend/dados:** Supabase Auth + Supabase PostgreSQL; tipos gerados (`supabase gen types typescript`).
- **Armazenamento:** SecureStore (tokens), SQLite ou AsyncStorage (cache offline + fila de mutações).
- **UI/UX nativa:** Reanimated, Expo Linear Gradient, Expo Haptics, Expo Image, Expo File System, Expo Sharing.
- **Qualidade:** ESLint + Prettier; Jest + ts-jest (unit); Testing Library (integração).
- **IA/exportação:** provider trocável (`PlanBlueprintProvider`) via Supabase Edge Function ou backend seguro; PDF (`expo-print`/render nativo) e XLSX real (biblioteca que gere OOXML válido).

> **Chave de IA nunca no app.** Permanece em Edge Function/backend, como já ocorre no legado (`api/generate-plan.js` guarda `GEMINI_API_KEY`).

---

## 3. Arquitetura de pastas (resumo — detalhe no enunciado §5)

```
src/
  app/            (auth) (tabs) workout/ plan/ profile/ runevo-plus/
  components/     ui/ cards/ forms/ charts/ paywall/
  domain/motor-evo/  types profile dates pace objective terrain zones
                     blueprint phases weekly-targets workout-library
                     workout-prescription plan-generator validation
                     quality-score risk fingerprint adaptive-training index
  services/       auth/ ai/ subscription/ export/ analytics/
  repositories/   athlete-profile training-plan workout checkin shoe subscription
  store/  theme/  hooks/  utils/  types/
  tests/          motor-evo/ fixtures/
```

**Regras arquiteturais** (verificadas por lint/boundary rules): domínio não importa RN; motor = funções puras; componentes não calculam regra; persistência só em repositories; serviços de IA não alteram planos direto (retornam blueprint/recomendação, o motor aplica); UUID válidos; sem consulta a colunas inexistentes; migrations = verdade; tipos gerados do Supabase.

---

## 4. Persistência: de `localStorage` para Supabase + cache

### 4.1 Mapeamento de estado local → destino
| Chave legado (`storage-service`) | Destino nuvem | Repository | Cache offline |
|---|---|---|---|
| `ai_plan` (blob do plano) | `training_plans` (+ `plan_workouts` normalizado) | `training-plan` / `workout` | SQLite `plans`, `workouts` |
| `ai_adopted` | `training_plans.status = 'active'` (índice único) | `training-plan` | flag local |
| `completed_workouts` | `plan_workouts.status` | `workout` | SQLite |
| `workout_feedback` | `plan_workouts` (`completed_km, perceived_effort, feedback, shoe_id, completed_at`) | `workout` | SQLite |
| `weekly_checkins` | `weekly_checkins` | `checkin` | SQLite |
| `adjustment_history` | `weekly_checkins.ai_analysis`/`adjustment` (jsonb) | `checkin` | SQLite |
| `user_profile` | `athlete_profiles` | `athlete-profile` | SQLite |
| `onboarding_seen` | `athlete_profiles.onboarding_seen` | `athlete-profile` | flag local |
| tênis (legado disperso) | `running_shoes` | `shoe` | SQLite |
| assinatura | `subscriptions` | `subscription` | flag local |

### 4.2 Divergências de formato a resolver com mapeadores testados
- Plano local usa `week: "S{n}"`, `workout.dayOfWeek/desc/km/pace`; banco usa `week_number`/`week_index`, `day_label/description/planned_km/planned_pace`. → `mappers/plan.mapper.ts` (round-trip com teste).
- Check-in: app coleta `feeling` (categórico) e `pain` (sim/não); schema tem `fatigue_level`/`pain_level` numéricos. → migration adiciona colunas `feeling text`, `pain boolean`, `perceived_effort` ou normaliza no mapper (decisão registrada na migration).
- IDs: gerar UUID no cliente (`crypto.randomUUID` via `expo-crypto`) ou deixar `default gen_random_uuid()` no banco; `plan_workouts.id` = UUID (não `"S1-0"`).

### 4.3 Offline-first
- Leituras via TanStack Query com cache SQLite.
- Escritas via **fila de mutações** (outbox): grava local → enfileira → sincroniza quando online → resolve conflito com **nuvem = verdade** (last-write-wins por `updated_at`, exceto campos append-only como histórico de ajustes).

---

## 5. Migração da autenticação

- `services/auth/AuthService` sobre Supabase Auth: e-mail/senha, Google, Apple, reset, confirmação, sessão persistente, logout, **excluir conta** (novo).
- Tokens em **SecureStore**; sessão restaurada no boot.
- Deep-link/redirect nativo p/ OAuth (Expo AuthSession / Supabase native flow).
- `handleAuthRedirectIfNeeded` do legado → handler nativo de callback.
- Migração de contas locais antigas: **não** portada (novo app parte de contas em nuvem). Documentar no changelog.

---

## 6. IA e blueprint

- Contrato `PlanBlueprint` validado por Zod (ver `motor-evo-specification.md` §Blueprint).
- `PlanBlueprintProvider.generate(input)` — implementações:
  - `RemoteBlueprintProvider` → Edge Function segura (porta de `api/generate-plan.js`: retries 429/5xx, fallback de modelo, `responseMimeType: application/json`, `temperature` baixa).
  - `LocalBlueprintProvider` → `buildFallbackBlueprint` determinístico.
- **Fallback obrigatório:** IA falha / JSON inválido / limite / indisponível / sem resposta → blueprint local. Atleta nunca fica impedido de gerar. Registrar `source = ai | local`.
- Provider trocável por config (futuro: outro modelo/backend) sem tocar no domínio.

---

## 7. Assinatura (SubscriptionService)

```ts
interface SubscriptionService {
  getEntitlement(): Promise<Entitlement>;      // { plan: 'free'|'plus', status, periodEnd }
  purchase(productId: string): Promise<void>;  // futuro: Google Play / App Store
  restore(): Promise<void>;
  refresh(): Promise<Entitlement>;
}
```
- Entitlement validado no **serviço** (lê `subscriptions`), não na UI. UI consome `useEntitlement()`.
- Implementação inicial pode ser stub (billing não conectado, como no legado), mas a **interface** e a checagem server-side já existem, prontas para Google Play Billing / StoreKit.
- Regra Free "1 plano ativo" garantida pelo índice `uniq_active_plan_per_user`.

---

## 8. Exportação

- **PDF** (Free e Plus): capa, atleta, objetivo, datas, zonas, resumo, semanas, treinos, progresso, rodapé RunEvo. Render nativo (`expo-print` a partir de template) → `expo-sharing`.
- **Excel/XLSX** (Plus): arquivo OOXML **real** (abre em Excel/Google Sheets/OnlyOffice). Nunca HTML disfarçado. Mesma organização do PDF.
- Paywall de exportação: cards Free bloqueados/escurecidos com um CTA; Plus ativos sem badge repetitivo.

---

## 9. Design system e telas

- Tokens do enunciado §36 em `theme/` (cores neon/dark, tipografia Outfit, raios, espaçamentos, glow).
- Componentes base em `components/ui`; cards, forms, charts, paywall separados.
- Safe areas, touch target ≥44, sem vãos pretos, header sem colisão, bottom nav legível (ver `frontend-design` skill na implementação).
- Telas mapeadas 1:1 com o legado (ver `legacy-audit.md` §2).

---

## 10. Estratégia de testes (equivalência legado ↔ novo)

- **Fixtures §39** (10 cenários) em `tests/fixtures/`. Para cada: rodar o motor novo e comparar semanas, fases, volume, pico, longão, zonas, treinos, datas, validação, score, risco, fingerprint.
- **Golden files:** capturar saída do legado (executando `ai-coach.js` em Node com stubs de `StorageService`/`localStorage`) como baseline; documentar diferenças intencionais.
- **Unit** por módulo do domínio (pace, objetivo, zonas, targets, prescrição, validação, score, risco, adaptive, fingerprint).
- **Integração:** geração ponta-a-ponta + adoção; check-in + guardrails; redistribuição de pulados; plano idêntico.
- Meta: paridade numérica (tolerância explícita quando houver arredondamento) e paridade estrutural exata.

---

## 11. Etapas de entrega (roadmap)

| Fase | Entregável |
|---|---|
| **0** | Auditoria + arquitetura + specs + tabela de migração. **(este pacote)** |
| **1** | Scaffold Expo/TS strict + Expo Router; tema; navegação (tabs + auth); Supabase Auth + SecureStore; repositories base + migrations + tipos gerados. |
| **2** | Motor RunEvo portado módulo a módulo + fixtures + testes de equivalência. |
| **3** | IA Evo: form, blueprint (remote+local), geração, loading, prévia, adoção. |
| **4** | Home, Treinos (ciclo), detalhe do treino (concluir/pular). |
| **5** | Adaptive Training, edição manual, sincronização/offline. |
| **6** | Estatísticas, perfil, tênis, RunEvo+ (entitlement/paywall). |
| **7** | PDF, Excel, assinatura (interface + preparo lojas), build stores. |
| **8** | QA, acessibilidade, performance, release Google Play / App Store. |

---

## 12. Riscos e mitigação (síntese)

| Risco | Mitigação |
|---|---|
| Motor divergir do legado | Fixtures + golden files + testes de equivalência (Fase 2 antes de UI de geração). |
| Timezone / semana parcial | `dates.ts` com parsing local explícito; testes de borda (início sábado, etc.). |
| Regex de objetivo pt-BR | Portar 1:1 + fixtures de frases (§9 do enunciado). |
| XLSX falso | Biblioteca OOXML real + teste de abertura em 3 apps. |
| Entitlement burlável | Checagem no serviço + RLS + índice único. |
| Offline/conflitos | Outbox + nuvem-verdade + `updated_at`. |
| Acoplar billing | `SubscriptionService` como fronteira única. |
| any/regra na UI | ESLint strict + boundary rules + revisão. |

---

_Fim do plano de migração._
