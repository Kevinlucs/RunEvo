# Fase 3 — Brief de Execução: IA Evo, Blueprint, Geração, Prévia e Adoção

> **Para o Claude Code executar.** Branch: `feat/fase-3-ia-evo` (a partir de `main`, após o merge da Fase 2).
> Referências: `docs/motor-evo-specification.md` (§8, §9, §20), `docs/legacy-audit.md` (§8 fluxo de geração),
> enunciado §6, §12, §13, §25, §30, §36, §37. Legado: `legacy/ai-coach.js`, `legacy/app.js`.
>
> **Objetivo:** dar rosto ao motor. O atleta preenche o formulário, a IA devolve um blueprint
> estratégico (com fallback local), o motor gera a planilha, o atleta vê a prévia e adota —
> gravando no Supabase via repositories (funciona offline).

---

## 0. Guardrails (não negociáveis)

1. **O motor não muda.** `src/domain/motor-evo/` está fechado e provado (117 testes). Se precisar tocar nele, pare e me avise — provavelmente é sinal de que a lógica está indo para o lugar errado.
2. **Componentes não calculam regra de treino.** Toda decisão vem do motor. A UI só coleta entrada e exibe saída.
3. **Chave de IA nunca no app.** Vive só na Edge Function (variável de ambiente do Supabase).
4. **Fallback local é obrigatório.** Qualquer falha da IA (erro, JSON inválido, timeout, limite, indisponível) cai no blueprint local determinístico. **O atleta nunca fica impedido de gerar.**
5. **Persistência só em repositories.** Nada de chamar `supabase` direto da UI. Adoção offline deve funcionar (outbox).
6. **Shape do plano.** O motor produz o shape legado; a conversão para colunas do banco acontece **só** no mapper desta fase.
7. **Gates verdes antes de cada commit:** `npm run typecheck && npm run lint && npm test`.

---

## Grupo 1 — Mapper de plano + rascunho (fundação de persistência)

### 1.1 `src/mappers/plan.mapper.ts`

Converte entre o shape interno do motor e as linhas do banco.

```ts
planToRows(plan, userId): { plan: TrainingPlanRow; workouts: WorkoutRow[] }
rowsToPlan(planRow, workoutRows): Plan   // shape do motor
```

Mapeamento de campos (do audit §3.2 / §3.6):

| Motor (legado) | Banco |
|---|---|
| `week: "S{n}"` | `week_number` (int, parse do `S{n}`) |
| índice do treino na semana | `week_index` |
| `workout.dayOfWeek` | `day_label` |
| `workout.dayType` | `day_type` |
| `workout.title` | `title` |
| `workout.desc` | `description` |
| `workout.km` | `planned_km` |
| `workout.pace` | `planned_pace` |
| `week.phase` | `phase` |
| `plan.blueprint` / `validation` / `quality` / `risk` / `userData` | colunas jsonb homônimas (`user_data`) |

**Datas reais em cada treino (§7 do enunciado):** o motor entrega `dayOfWeek` (nome do dia), não data ISO. O mapper calcula `workout_date` a partir de `start_date` + `week_number` + `day_label`, usando **`dates.ts` do motor** (já portado — não reimplemente). Respeite semana segunda→domingo e a **primeira semana parcial** (o primeiro treino cai na data de início).

**IDs:** `plan.id` e cada `workout.id` são UUID gerados no cliente (`newUuid()`), nunca `"S1-0"`.

**Teste obrigatório:** round-trip sobre os 10 golden — `rowsToPlan(planToRows(golden))` deve reproduzir o plano (campos mapeados; `zoneTarget` é opcional e pode não sobreviver, como na validação). E um teste específico de datas: para `f01` (início 2026-02-02, segunda), confira que os `workout_date` da semana 1 caem nos dias corretos e crescem monotonicamente.

### 1.2 Rascunho do formulário por usuário (§6)

Tabela **local-only** (não sincronizada, não vai para o outbox):

```sql
CREATE TABLE IF NOT EXISTS ai_evo_drafts (
  user_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,      -- JSON dos 22 campos
  saved_at TEXT NOT NULL
);
```

Adicione ao `LOCAL_SCHEMA_SQL` e crie `repositories/draft.repository.ts` (`load(userId)`, `save(userId, draft)`, `clear(userId)`). Campos permitidos — **exatamente** os 22 do `sanitizeProfileDraft` legado:

`age, height, weight, imc, level, targetDistance, customDistance, terrain, startDate, raceDate, daysPerWeek, time5k, no5k, time10k, no10k, time21k, no21k, time42k, no42k, test3kmTime, test3kmPace, objective`

Salve com debounce a cada alteração; limpe após adoção.

---

## Grupo 2 — Caminho da IA (Edge Function + Provider + normalizeBlueprint)

### 2.1 Edge Function `supabase/functions/generate-plan/index.ts`

Porte de `legacy/api/generate-plan.js` (se não estiver no repo, copie de `02_CODIGO_LEGADO_PWA/runevo-pwa-v160/api/generate-plan.js`). Contrato preservado: **`POST { prompt: string }`**.

Preserve do legado: retry com backoff em 429/5xx; fallback entre modelos (`gemini-2.5-flash` → `-lite`); `temperature: 0.2`; `responseMimeType: 'application/json'`; validação de `prompt` presente e string.

Acrescente (o legado não tinha):
- **Exigir JWT** — só usuário autenticado invoca (`Authorization: Bearer`); rejeite 401 sem sessão válida.
- **Timeout** de ~25s (`AbortController`) — o app não pode ficar pendurado.
- **Chave** em `Deno.env.get('GEMINI_API_KEY')`, configurada via `supabase secrets set`. Nunca no repo.
- Logs sem dados sensíveis (§38).

### 2.2 `normalizeBlueprint` (débito da Fase 2 — é puro, vai no domínio)

Porte de `legacy/ai-coach.js` para `src/domain/motor-evo/blueprint.ts`. Reconcilia a resposta da IA com o fallback, aplica os limites de segurança (`getPeakWeeklyKmLimit`, `getPeakTrainingLongRunLimit`), clampa `taperWeeks` e ajusta por `goalContext`/risco. **Mesma fidelidade 1:1** dos Grupos A–F: gere golden a partir do legado com respostas de IA sintéticas (uma boa, uma com números absurdos, uma incompleta) e verifique campo a campo.

### 2.3 Contrato Zod + Provider

`src/services/ai/blueprint.schema.ts` — Zod do `PlanBlueprint` (spec §8): `athleteAnalysis`, `strategy`, `paceZones`, `phaseDistribution`, `warnings`, `engineCalibration`. Tolerante a campos extras, estrito nos tipos.

`src/services/ai/plan-blueprint.provider.ts`:

```ts
export interface PlanBlueprintProvider {
  generate(input: BlueprintPromptInput): Promise<PlanBlueprint>;
}
```

- `RemoteBlueprintProvider` → `supabase.functions.invoke('generate-plan', { body: { prompt } })`, com o prompt vindo de `buildBlueprintPrompt` (já portado). Parseia, valida com Zod, passa por `normalizeBlueprint`.
- `LocalBlueprintProvider` → `buildFallbackBlueprint` (já portado e testado).

`resolveBlueprint(input)`: tenta remoto → **qualquer** falha cai no local. Marca `source: 'ai' | 'local'` (enum já decidido na Fase 2).

**Testes (headless, sem UI):** IA válida → `source='ai'` e valores clampados pelos limites; IA com JSON inválido → `source='local'`; IA com timeout → `source='local'`; IA fora do ar (invoke rejeita) → `source='local'`. **Nenhum caso pode lançar para o chamador.**

### ⏸ PARADA 1 — reporte aqui

Rode a suíte completa. Traga **apenas**: linha de resumo (`X/Y verdes`), tabela de divergências (`campo · legado · novo`) se houver, e uma frase sobre o round-trip do mapper. Se estiver tudo verde, **siga direto para o Grupo 3** sem esperar resposta.

---

## Grupo 3 — Formulário IA Evo (§30, §6)

Tela `src/app/(tabs)/ai-evo.tsx` + componentes em `src/components/forms/`.

**Stack:** React Hook Form + Zod resolver. Um schema por seção, validação no submit e on-blur.

**Campos (na ordem):** idade · altura · peso · nível · distância · distância personalizada (só se `ultra`/`custom`) · terreno · data de início · data da prova · dias por semana · tempos anteriores · **teste de 3 km (obrigatório)** · objetivo (texto livre).

**Layout mobile crítico (§30) — tempos anteriores empilhados, um abaixo do outro:**

```
5K   [ input 00:00:00 ]
     [x] Ainda não corri 5K
10K  [ input ]
     [x] Ainda não corri 10K
21K  [ input ]
     [x] Ainda não corri 21K
42K  [ input ]
     [x] Ainda não corri 42K
```

**Nunca duas colunas apertadas.** Marcar o checkbox desabilita e limpa o input correspondente (`noXk = true`).

**Regras de UX:** teclado não cobre campos (`KeyboardAvoidingView` + scroll); touch target ≥44; datas via picker nativo; máscara de tempo `hh:mm:ss` / `mm:ss`; erros inline com o texto do Zod; rascunho salvo automaticamente (Grupo 1.2) e restaurado ao abrir.

**Boundary de tipos (decisão da Fase 2):** a UI pode usar rótulos amigáveis, mas o valor entregue ao motor é o do legado (`targetDistance` como string numérica crua). Normalize **no submit**, nunca dentro do motor.

Use os tokens de `src/theme` — nada de cor/tamanho hard-coded (§36).

---

## Grupo 4 — Geração, Loading, Prévia, Plano Idêntico e Adoção

### 4.1 Loading com etapas (§30)

Sequência exibida enquanto gera: *analisando atleta · interpretando objetivo · calculando zonas · criando estratégia · construindo semanas · validando · calculando score*. As etapas refletem o progresso real do pipeline (não um timer falso): emita eventos entre as chamadas de `resolveBlueprint` → `generateWorkoutWeek` → `validateAndFixPlan`.

### 4.2 Prévia (§30) — `src/app/plan/preview.tsx`

Exibir, em cards: análise do atleta (nível detectado, viabilidade, força, fraqueza, foco, resumo do coach) · estratégia (volumes inicial/pico, longão, recuperação, taper) · zonas Z1–Z5 (com método/âncora) · distribuição de fases · alertas (`warnings`) · o plano semana a semana · relatório de validação · **Quality Score** (0–10 + status) · **risco** (nível + razões, **sem** linguagem de diagnóstico médico).

CTAs: **Adotar planilha** e **Gerar outra**.

### 4.3 Plano idêntico (§20)

Antes de adotar/gerar outra: `computePlanFingerprint(novo)` vs plano ativo. Se idênticos → **não** criar cópia, **não** abrir revisão genérica; exibir exatamente:

> "A nova planilha é idêntica à atual."

Com orientação para alterar objetivo, prazo, frequência, terreno ou métricas.

### 4.4 Adoção → Supabase

`services/plan/adopt-plan.service.ts`:

1. `planToRows(plan, userId)`.
2. Se existir plano ativo: **Free** → o plano anterior vira `archived` e o novo entra como `active` (o índice único `uniq_active_plan_per_user` garante 1 ativo; faça o arquivamento **antes** do insert para não violar a constraint). **Plus** → mesmo comportamento, com histórico preservado.
3. Grava `training_plans` + todos os `plan_workouts` via repositories (offline-first → outbox).
4. Limpa o rascunho.
5. Invalida as queries do TanStack Query e navega para a Home.

**Entitlement:** consulte o `SubscriptionService`/repository — nunca decida Free/Plus só na UI.

**Teste:** adoção offline enfileira corretamente (outbox com `insert` do plano + N workouts) e, ao sincronizar, não viola o índice único.

---

## Grupo 5 — Primeiro acesso (§25)

Fluxo: **Splash → login/cadastro → tutorial centralizado → IA Evo → formulário → geração → prévia → auditoria → adotar → Home completa.**

Guard: usuário **sem plano ativo** não navega para telas vazias. Se não há plano, as abas Início/Treinos/Estatísticas mostram um estado vazio **compacto** (sem grandes áreas pretas, §27) com CTA único levando à IA Evo. Marque `onboarding_seen` no perfil após o tutorial.

---

## ⏸ PARADA 2 — fechamento

Rode tudo e traga **apenas**:
1. resumo `X/Y verdes` + divergências (se houver);
2. o bloco §41 do PR (Objetivo · Decisões · Arquivos criados/modificados/removidos · Comandos · Testes · Resultado esperado · **Pendências reais**);
3. quaisquer decisões que você tomou sozinho e queira validar.

Depois abra o PR de `feat/fase-3-ia-evo` para `main`.

---

## Disciplina de tokens

- Nunca reimprima saída de teste que passa — só falhas e a linha de resumo.
- Não explique módulo por módulo; só o que divergiu ou exigiu decisão.
- Um commit por grupo (`feat(ia-evo): grupo N — ...`).
- Só me interrompa fora das paradas se: (a) houver divergência de campo vs golden, (b) algo exigir tocar em `src/domain/motor-evo/`, ou (c) faltar arquivo do legado.

**Não simplifique o Motor RunEvo. Não afirme que algo foi implementado sem o código correspondente.**
