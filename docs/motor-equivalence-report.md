# Motor RunEvo — Relatório de Equivalência (Fase 2)

> Rastreia `src/tests/motor-evo/fixtures.ts` (f01..f10) contra os 10 cenários
> oficiais do enunciado §39 (não presente em `docs/*.md` deste repo — ver nota
> em `fixtures.ts`). Atualizado a cada parada de report combinada com o time.

## Mapa de cobertura

| # oficial (§39) | Cenário | Fixture | Como instancia |
|---|---|---|---|
| 1 | Iniciante 5K, plano, 3d | `f01` | `targetDistance:'5'`, `level:'iniciante'`, `terrain:'plano'`, `daysPerWeek:3`, sem objetivo |
| 2 | Intermediário 10K, sub 50 | `f02` | `targetDistance:'10'`, objetivo `"sub 50"` → padrão 4 de `parseTimeGoalFromObjective` |
| 3 | Intermediário 21K, 1h45 | `f03` | `targetDistance:'21'`, `time21k:'1:45:00'` como melhor tempo anterior + objetivo de recorde (heurística de PR × fator 0.98, não meta direta de 1h45 — ver nota abaixo) |
| 4 | Maratona sub 4h | `f04` | `targetDistance:'42'`, objetivo `"em 4 horas"` → heurística `a:b:0→horas` (≥21K) |
| 5 | Ultra 61K, conservadora, elevado, 3d | `f05` | `targetDistance:'ultra'`, `customDistance:61`, `terrain:'elevado'`, `daysPerWeek:3`, objetivo explícito de tempo conservador |
| 6 | IMC alto | `f06` | `weight:95`/`height:165` → IMC≈34.9; demais campos neutros (10K, plano, sem objetivo) para isolar o fator de risco |
| 7 | Prazo curto | `f07` | `targetDistance:'21'`, `calculateWeeks=10` (<12 semanas para ≥21K) |
| 8 | Terreno elevado | `f08` | `targetDistance:'10'`, `terrain:'elevado'`, `daysPerWeek:4` |
| 9 | IA indisponível → `blueprint.source === 'local'` | `f09` (todas as fixtures, na prática) | ✅ **Ativo.** `BlueprintSource = 'ai' \| 'local'` (`blueprint.ts`) — divergência intencional do legado, decidida conscientemente (ver "Divergências intencionais" abaixo) |
| 10 | Plano idêntico → `arePlansIdentical === true` | `f10` (todas as fixtures, na prática) | ✅ **Ativo.** `fingerprint.ts` portado de `legacy/app.js` (não `ai-coach.js` — ver "Grupo F" abaixo). `f10` é a referência designada por ser o caso mais simples (2 dias/semana, sem objetivo) |

**Nota sobre f03 vs. cenário oficial 3:** o enunciado diz "inter 21K 1h45"; interpretamos
como "1h45 é o melhor tempo **anterior** do atleta, objetivo é bater esse recorde"
(heurística `previous_pr` × fator 0.98), não "1h45 é a meta direta da prova" (que
usaria a heurística de tempo-final `parseTimeGoalFromObjective`, dando um pace-alvo
diferente). Ambas as leituras são válidas para o texto "21K 1h45" isolado; ficamos
com PR porque é o cenário que a §39 parece querer testar (heurística de recorde ×
fator de melhora), já coberto separadamente por f04 (tempo-final direto) e f09
(PR em distância mais longa, contraste de estratégia de zona). Se a intenção
original era meta direta, sinalizar para ajustarmos.

**f09 e f10 continuam também como fixtures de robustez adicionais** (contraste
PR 21K×42K pelo limiar de 60s; distância customizada + 2 dias/semana) — não
deixam de servir a esse propósito só por também serem a referência dos
cenários 9/10.

## Divergências intencionais do legado (aprovadas)

Diferenças de comportamento deliberadas — não descuidos de porte. A suíte de
equivalência não compara os campos abaixo contra o valor literal do golden
nesses pontos específicos (comparação normalizada/ignorada onde aplicável).

| Campo | Legado | Motor novo | Por quê |
|---|---|---|---|
| `blueprint.source` | `` `fallback: ${error.message}` `` (ai-coach.js:1047) — vaza a mensagem de erro do fetch, ex. `"fallback: rede desabilitada..."` | `type BlueprintSource = 'ai' \| 'local'`; sempre `'local'` em `buildFallbackBlueprint` | §13 do enunciado (spec de produto) pede enum limpo. Decisão consciente, aprovada. Nenhum outro lugar de `ai-coach.js` lê o conteúdo de `blueprint.source` (só `pattern.source`/`timeGoal.source`/`targetSource`, campos não-relacionados) — sem efeito colateral no motor. `normalizeWorkoutForValidation`/demais comparações não tocam esse campo, então nenhuma fixture 1–8 foi afetada pela mudança |

## Código morto do legado — identificado e omitido (não portado)

Funções que existem em `ai-coach.js` mas nunca são chamadas em lugar nenhum do
arquivo (confirmado por grep — não fazem parte do `return` público de
`AICoach` nem são referenciadas por nenhuma outra função). Critério §38
(sem código morto/TODO em fluxo crítico): omitidas, não portadas comentadas.
Os testes de equivalência (incl. `validateAndFixPlan`/`calculatePlanRiskLevel`
completos) passam sem exercitá-las, confirmando que nada depende delas.

| Função morta | Local (legado) | Seria de | Situação |
|---|---|---|---|
| `workoutSignature` | ai-coach.js:2232-2234 | `validation.ts` | Omitida — não portada |
| `normalizeRiskLabel` | ai-coach.js:2522-2528 | `risk.ts` | Omitida — não portada |

## Grupo F — fingerprint + adaptive-training (`legacy/app.js`)

`normalizeRunEvoComparablePlan`/`getRunEvoPlanFingerprint`/`areRunEvoPlansIdentical`
e as regras de Adaptive Training vivem em `legacy/app.js` (8162 linhas), não em
`ai-coach.js` — esse arquivo só foi adicionado ao repo nesta etapa (copiado
para `legacy/app.js`). Diferente de `ai-coach.js` (IIFE limpa), `app.js` tem
dependências de DOM/estado global no escopo do módulo — carregar o arquivo
inteiro num `vm` quebraria. Extraímos por **range de linha** só o fechamento
transitivo necessário, com verificação de forma no primeiro carregamento
(se `app.js` mudar de forma, o harness lança erro em vez de extrair a coisa
errada silenciosamente):

- `legacy-fingerprint-harness.ts`: `formatKm`, `getPlanReviewSummary`,
  `getRiskLabelText`, `formatPlanScore`, `getPlanRisk`, `getPlanDistanceLabel`,
  `getCompactPlanSummary`, `normalizeRunEvoComparablePlan`,
  `getRunEvoPlanFingerprint`, `areRunEvoPlansIdentical` (10 funções, nenhuma
  toca DOM/localStorage — confirmado por leitura manual).
- `legacy-adaptive-harness.ts`: `getLocalAdjustmentRecommendation`,
  `getAdjustmentTitle`, `normalizeAICheckinRecommendation`, `roundHalf`,
  `applySkippedWorkoutRedistribution`, `applyAdjustmentToStoredPlan`. Globais
  fora do fechamento autorizado (`getWorkoutStatus`, `AICoach.loadPlan`,
  `StorageService.savePlan`, `AICoach.isPlanAdopted`, `applyAdoptedPlan`,
  `clamp`) são stubados (mapa de status controlado pelo teste, plano de teste
  injetável, persistência capturada em memória).

### fingerprint.ts

Porte 1:1. **Achado de fidelidade importante:** `normalizeRunEvoComparablePlan`
lê `w.type||w.category`, `w.day||w.weekday`, `plan.objective||plan.goal`,
`plan.totalKm||plan.totalDistanceKm` — nomes de campo que **nunca existem** no
plano produzido pelo motor (que usa `dayType`/`dayOfWeek`, e não tem
`plan.objective`/`plan.totalKm` no nível raiz; só `userData.objective` e
`validation.summary.totalKm` aninhados). Confirmado por leitura de `app.js` E
pelo harness rodando sobre planos reais: `type`, `day`, `objective` ficam
sempre `''` e `totalKm` sempre `0` no fingerprint de qualquer plano real do
motor. **Não "corrigido"** — mudar isso alteraria quais planos contam como
idênticos, e não foi pedido. `week: Number(week.week || ...)` também vira
`NaN` → `null` no JSON (`week.week` é a string `"S1"`, não numérica) —
preservado.

Verificado: fingerprint string idêntica à do legado nas 10 fixtures;
`arePlansIdentical` idêntico ao legado nas 10 fixtures (duas gerações do
mesmo input) e nos 45 pares cruzados (10 fixtures, C(10,2) combinações —
nenhum falso positivo de "idêntico"); guardas `null`/`undefined` conferem.

### adaptive-training.ts

Porte 1:1 de `getLocalAdjustmentRecommendation` (→ `recommendAdjustment`,
nome trocado por instrução do enunciado/spec §18: "Recomendação: local
(`recommendAdjustment`)"), `normalizeAICheckinRecommendation` (mesmo nome —
guardrails puros aplicados sobre uma sugestão de IA já obtida, não chama IA),
`applySkippedWorkoutRedistribution` (→ `redistributeSkipped`, purificada:
recebe a semana seguinte por parâmetro e retorna a versão atualizada, em vez
de ler/gravar `AICoach.loadPlan()`/`StorageService`) e
`applyAdjustmentToStoredPlan` (→ `applyAdjustment`, mesma purificação).

**Não portado nesta fase** (fora do fechamento autorizado, ou inerentemente
stateful — débito explícito, não código morto): `getWeekSummary`/
`getCheckinCandidateWeek` dependem de `allWorkouts`, `getWorkoutStatus`,
`getWorkoutFeedback`, `isWorkoutResolved`, `getWorkoutCompletedKm`,
`weeklyCheckins` — estado vivo de conclusão de treino que só existe com os
repositories da Fase 3. A agregação pura de `getWeekSummary` está portada
como `summarizeWeek` (recebe treinos já resolvidos por parâmetro).

**Achado verificado (não é divergência):** `resolved = completed + skipped`
foi inicialmente uma inferência (sem `isWorkoutResolved` no fechamento
autorizado desta extração), depois **confirmada contra o legado**:
`isWorkoutResolved` é exatamente `['completed','skipped'].includes(...)` —
`summarizeWeek` bate 1:1.

**Contexto adicional confirmado:** o fluxo de status "parcial" foi
**descontinuado no legado** — `handleMarkPartial` hoje só exibe um toast
("Fluxo parcial removido: agora o atleta registra apenas concluído ou
pulado"); `partial` só persiste em caminhos de render/export para dados
antigos (por isso `getWeekSummary` hardcoda `partial = 0`, app.js:4422 —
campo morto mantido só por forma de compatibilidade). O §21 do enunciado
("concluído | parcial | pulado") está **desatualizado** em relação ao
produto real (só concluído/pulado). A entidade `Workout` da Fase 1
(`status: 'pending' | 'completed' | 'skipped'`, sem `'partial'`) já reflete
o comportamento real do legado — decisão correta, confirmada retroativamente,
não precisa de ajuste.

Verificado contra `legacy-adaptive-harness.ts`: 30 testes cobrindo todos os
branches de guardrail da spec §18 — dor nunca aumenta; esforço ≥9/
"muito_pesado" nunca aumenta; aderência <60% reduz; aumento adicional
clamped 1-3%; redução clamped 5-20% (reduce) / 15-30% (recovery); semana
perfeita+leve mantém apesar de sugestão de redução; ação inválida da IA cai
para a recomendação local; `weeksToAdjust` clamped 1-2; redistribuição de
pulados por faixa de esforço (ratio 0.5/0.4/0.3, dor→0), limitada a ~12% da
semana seguinte, nunca mexe no treino da prova; `applyAdjustment` só semanas
futuras, `off=true`+`phase→Base` em recovery, nunca altera a prova, no-op
quando `factor=1 && action==='maintain'`. **0 divergências.**

## Bugs de Fase 1 corrigidos (fora do histórico do motor)

Isolados como commits próprios, sem misturar com o port do Motor RunEvo:

- `94d9c45` — `eslint-config-prettier` ausente de `package.json` (quebrava `npm run lint`).
- `8ee671e` — reexport duplicado/quebrado em `src/services/auth/index.ts` (`supabaseAuthService` nunca existiu; só `authService`).

Ambos já eram commits separados dos commits de domínio (`feat(motor-evo): ...`)
antes desta nota — não foi necessário reescrever histórico.

## Status por grupo

| Grupo | Módulos | Status |
|---|---|---|
| A | types, utils/math, dates, pace | ✅ portado, 100% equivalente (função a função) |
| B | objective, terrain, zones | ✅ portado, 100% equivalente (função a função) |
| C | profile (calculateIMC), phases, weekly-targets, blueprint (fallback local) | ✅ portado |
| D | workout-library, workout-prescription, plan-generator, validation, quality-score, risk, index.ts (fachada `generatePlan`) | ✅ portado |
| F | fingerprint (`legacy/app.js`), adaptive-training (`legacy/app.js`) | ✅ portado |

**Parada 1 (pós-Grupo D):** suíte de equivalência completa nos 10 golden —
82/82 testes reais batendo. **0 divergências.**

**Pós-aprovação da Parada 1:** cenário 9 ativado — `blueprint.source ===
'local'` em todas as fixtures, via `BlueprintSource` (divergência
intencional, ver tabela acima). Código morto removido (`workoutSignature`,
`normalizeRiskLabel`).

**Parada 2 (pós-Grupo F):** `legacy/app.js` adicionado ao repo (só
`ai-coach.js` existia antes). `fingerprint.ts` e `adaptive-training.ts`
portados e verificados contra harnesses dedicados (extração por range de
linha, `app.js` não pode ser `vm`-carregado inteiro — tem DOM/estado global).
Cenário 10 ativado. **117/117 testes, 0 todo, 0 divergências.**

Débito explícito, fora do escopo desta fase (documentado nos respectivos
arquivos): `normalizeBlueprint`/`PlanBlueprintProvider` (blueprint.ts —
caminho de IA, não exercitado pelos golden); `getWeekSummary`/
`getCheckinCandidateWeek` completos (adaptive-training.ts — dependem de
estado vivo de conclusão de treino, repositories da Fase 3); persistência de
`redistributeSkipped`/`applyAdjustment` (StorageService — repository, Fase 3).

## Fase 2 — encerrada

Motor RunEvo portado integralmente para `src/domain/motor-evo/` (funções
puras, TypeScript strict), com equivalência verificada empiricamente contra
`legacy/ai-coach.js` e `legacy/app.js`. 117/117 testes, 0 `todo`, 0
divergências. Débitos explícitos documentados acima ficam para quando os
respectivos serviços/repositories forem implementados (Fase 3+); não são
lacunas silenciosas.
