# RunEvo — Auditoria do Legado (PWA v1.0.160)

> Fase 0 — Documento de auditoria funcional, visual e de negócio.
> Fonte de verdade: `02_CODIGO_LEGADO_PWA/runevo-pwa-v160/`.
> Este documento descreve **o que existe hoje**, não o que será construído.
> Regras de comportamento aqui descritas são **de preservação obrigatória** na migração.

---

## 0. Escopo lido

| Arquivo | Linhas | Papel no legado |
|---|---|---|
| `assets/js/ai-coach.js` | 2996 | **Motor RunEvo** — módulo IIFE `AICoach`. Geração determinística, zonas, blueprint, validação, quality score, risco. |
| `assets/js/app.js` | 8162 | Camada de aplicação/UI. Adaptive Training, fingerprint, check-in, edição manual, exportação PDF/Excel, entitlement Free/Plus, renderização de todas as telas. |
| `assets/js/storage-service.js` | 393 | Persistência local (`localStorage`) namespaced por usuário + chaves legadas. |
| `assets/js/cloud-auth-service.js` | 317 | Wrapper de Supabase Auth (e-mail/senha, Google, Apple, reset, metadata). |
| `assets/js/user-profile-service.js` | 163 | Sincronização de perfil (nuvem ↔ cache). |
| `api/generate-plan.js` | 134 | Backend serverless (Vercel). Proxy seguro para Gemini (`gemini-2.5-flash`, fallback `-lite`). Guarda a `GEMINI_API_KEY`. |
| `docs/supabase-schema.sql` | 140 | Schema Postgres + RLS. |
| `docs/auth-architecture.md` | — | Decisão de conta real + fluxo de primeiro acesso. |
| `index.html` | 1360 | Shell de telas (páginas por `id="page-*"`, nav inferior). |
| `assets/css/styles.css` + `mobile-app.css` | 15578 + 901 | Design system dark/neon. |

---

## 1. Mapa de funcionalidades

1. **Autenticação em nuvem** — e-mail/senha, Google, Apple, reset de senha, confirmação de e-mail, sessão persistente, logout, metadata de perfil.
2. **Rascunho de perfil por usuário** — formulário da IA Evo salvo localmente por usuário (`saveProfile`/`loadProfile`/`clearProfileDraft`).
3. **Geração de planilha (IA Evo)** — blueprint estratégico (IA ou fallback local) → montagem determinística semana a semana → validação/autocorreção → quality score → risco.
4. **Prévia e adoção de planilha** — preview com análise, zonas, fases, alertas, plano, validação, score e risco; adotar/descartar.
5. **Home** — próximo treino, objetivo da prova, semana atual, Adaptive Training.
6. **Detalhe do treino** — zonas Z1–Z5, "como executar", blocos, concluir (form de conclusão) / pular (confirmação).
7. **Treinos (ciclo)** — fases, semanas, progresso, editor manual, exportação, histórico (Plus).
8. **Adaptive Training / check-in semanal** — liberado só quando todos os treinos da semana estão resolvidos; ajusta semanas futuras com guardrails; redistribui carga de treinos pulados; peso obrigatório a cada 4 semanas.
9. **Edição manual** — editar/adicionar/remover treino, data, título, tipo, km, pace, descrição; recalcular semana; invalidar check-in afetado.
10. **Estatísticas** — distância total, concluídos, restantes, semanas seguidas, IMC; evolução, planejado×realizado, aderência, esforço, ajustes, histórico (básico Free / avançado Plus).
11. **Perfil** — dados do atleta, editar, peso/IMC, tênis, RunEvo+, suporte, privacidade, termos, excluir conta, sair, versão.
12. **Tênis** — cadastro, km inicial/atual/limite, ativo/aposentado, seleção ao concluir treino, atualização automática de km.
13. **RunEvo+ (assinatura)** — entitlement Free/Plus; paywall; comparação de planos; histórico; PDF + Excel.
14. **Exportação** — PDF profissional (Free e Plus) e Excel/XLSX (Plus).
15. **Plano idêntico (fingerprint)** — detecta que uma nova geração é idêntica à ativa e bloqueia substituição.

---

## 2. Mapa de telas (legado → nova rota)

Páginas do shell (`index.html`) identificadas por `id="page-*"` + navegação inferior `data-page`:

| Tela legado | ID / data-page | Rota React Native proposta |
|---|---|---|
| Splash | `.splash-screen` | `app/index` (splash + roteamento inicial) |
| Login/Cadastro | `.login-screen` | `app/(auth)/sign-in`, `sign-up`, `reset-password` |
| Home / Início | `page-home` / `home` | `app/(tabs)/index` |
| Treinos (ciclo) | `page-phases` / `phases` | `app/(tabs)/plan` |
| IA Evo (gerador) | `page-ai` / `ai` | `app/(tabs)/ai-evo` |
| Estatísticas | `page-stats` / `stats` | `app/(tabs)/stats` |
| Detalhe do treino | `page-workout` | `app/workout/[id]` |
| Detalhe da fase | `page-phase-detail` | `app/plan/phase/[phase]` |
| Prévia do plano | `page-plan-preview` | `app/plan/preview` |
| Perfil (hub) | `page-settings` | `app/profile/index` |
| Configurações gerais | `page-general-settings` | `app/profile/settings` |
| Tênis (lista) | `page-shoes` | `app/profile/shoes` |
| Tênis (form) | `page-shoe-form` | `app/profile/shoes/[id]` |
| RunEvo+ | `page-runevo-plus` | `app/runevo-plus/index` |
| Meus recursos | `page-my-resources` | `app/runevo-plus/resources` |
| Privacidade | `page-privacy` | `app/profile/privacy` (WebView externo/landing) |
| Suporte | `page-support` | `app/profile/support` |

**Bottom navigation (preservar ordem):** Início · Treinos · IA Evo · Estatísticas. Perfil abre pelo avatar do header (não é aba).

---

## 3. Entidades e formatos de dados

### 3.1 `userData` (entrada do atleta — objeto passado ao motor)
Campos preservados (usados por `AICoach`): `name`, `age`, `height`, `weight`, `imc`, `level`, `targetDistance` (`5k|10k|21k|42k|ultra|custom`), `customDistance`, `terrain`/`terrainType` (`plano|misto|elevado`), `startDate`, `raceDate`, `daysPerWeek`, `time5k`/`no5k`, `time10k`/`no10k`, `time21k`/`no21k`, `time42k`/`no42k`, `test3kmTime`, `test3kmPace`, `objective`. Rascunho sanitizado por `sanitizeProfileDraft` (lista branca de campos).

### 3.2 `plan` (planilha gerada)
```
{
  planName, totalWeeks, raceName, raceDistance, raceDate, daysPerWeek,
  weeks: [ { week: "S1", phase, off: bool, workouts: [ {
      dayOfWeek, dayType, title, desc, km, pace, zoneTarget,
      redistributedFromSkipped?, redistributedKm?
  } ] } ],
  blueprint,                // ver 3.3
  motorEvoContext,          // goalContext resolvido
  validation,               // relatório da validation engine (ver 3.4)
  generatedAt, userData
}
```
> Observação de migração: `week.week` é string `"S{n}"` no legado; `workout` usa `dayOfWeek`/`desc`/`km`, enquanto o schema Supabase usa `day_label`/`description`/`planned_km`. Ver tabela de mapeamento na seção 3.6.

### 3.3 `blueprint` (contrato estratégico)
`{ athleteAnalysis{detectedLevel, riskLevel, goalFeasibility, mainStrength, mainWeakness, focus, coachSummary}, strategy{initialWeeklyKm, peakWeeklyKm, initialLongRunKm, peakLongRunKm, recoveryEveryWeeks, taperWeeks}, paceZones{easy,moderate,threshold,interval,long,racePace, trainingZones, zoneMethod, goalContext}, phaseDistribution[{phase,startWeek,endWeek}], warnings[], engineCalibration{progressionStyle, recoveryPriority, intensityBias, goalContext, raceType, zoneStrategy, speedReserve, terrain, ...}, source, profile{riskLevel,fitnessLevel,...} }`

### 3.4 `validation` (relatório)
`{ status: 'ok'|'warning'|'error', issues[]/warnings[], summary{totalKm, initialWeeklyKm, peakWeekKm, peakTrainingLongRunKm, raceDistanceKm, recoveryWeeks[], taperWeeks[], raceWeek, qualityScore, qualityStatus, riskLevel, riskPoints, riskReasons}, quality{...}, }`. Cada issue: `{code, severity:'info'|'warning'|'error', week?, workoutId?/path, message, fixed}`.

### 3.5 `trainingZones` (Z1–Z5)
Cada zona: `{label, name, perception, from, to, speedFrom, speedTo}`; mais `anchor{label, pace, speed, method: 'goal_anchored'|'capacity_anchored', capacityPace?}`.

### 3.6 Estado local persistido (chaves por usuário — `storage-service.js`)
`ai_plan` (plano), `ai_adopted` (flag adoção), `completed_workouts`, `customizations`, `workout_feedback`, `weekly_checkins`, `adjustment_history`, `user_profile`, `onboarding_seen`. Namespacing: `${APP}_${user}_${suffix}` com espelho de chaves legadas (`legacy*`) para migração de contas antigas. **Na nova arquitetura, tudo isso deixa de ser `localStorage` e vira Supabase (fonte de verdade) + cache offline (SQLite/AsyncStorage) via repositories.**

### 3.7 Schema Supabase (nuvem — já definido)
Tabelas: `athlete_profiles`, `training_plans`, `plan_workouts`, `weekly_checkins`, `running_shoes`, `subscriptions`. RLS habilitado; índice único `uniq_active_plan_per_user` (garante 1 plano ativo por usuário — base do limite Free). Campos completos no schema; ver `migration-plan.md` §Persistência.

---

## 4. Funções existentes (inventário por módulo)

### 4.1 `AICoach` (ai-coach.js) — API pública exportada
`saveProfile, loadProfile, clearProfileDraft, generatePlan, savePlan, loadPlan, clearPlan, adoptPlan, unadoptPlan, isPlanAdopted, getAdoptedWorkouts, calculateWeeks, buildPrompt, parsePlanResponse, buildTrainingZones, buildLocalPaceZones`.

Funções internas relevantes (categorizadas — mapeadas na §13):
- **Datas/pace/distância:** `parseLocalDate, addDays, clamp, roundKm, parseNumber, calculateIMC, calculateWeeks, getDistanceKm, getDistanceLabel, getStartDayOfWeek, paceToSeconds, timeToSeconds, secondsToDuration, secondsToPace, paceRange, speedFromPaceSeconds, paceSecondsFromSpeed, formatSpeed`.
- **Objetivo:** `normalizeObjectiveText, raceDistanceKey, getPreviousRaceTimeSeconds, parseTimeGoalFromObjective, getGoalTargetInfo, inferGoalPaceSeconds, getRaceType, getGoalContext, inferBasePaceSeconds, getPreviousTimesText`.
- **Terreno:** `getTerrainLabel, getTerrainGuidance`.
- **Zonas:** `zoneRangeFromSpeedPercent, buildZoneRangeFromPaces, buildGoalAnchoredZones, buildTrainingZones, buildLocalPaceZones`.
- **Blueprint/IA:** `buildBlueprintPrompt, callGeminiAPI, parseJSONResponse, generateBlueprint, buildFallbackBlueprint, normalizeBlueprint, buildPhaseDistribution, normalizePhaseDistribution, getPeakTrainingLongRunLimit, getPeakWeeklyKmLimit, easeProgression`.
- **Geração semanal:** `getPhaseForWeek, interpolate, calculateWeekTargets, getTrainingDays, pickWorkoutVariant, getWorkoutLibrary, getWorkoutTemplate, paceForWorkout/…, allocateWorkoutDistances, buildProfessionalWorkoutDescription (+ helpers: buildSimpleZonePrescription, splitDistance, buildFartlekBlock, kmPart, formatKmValue, estimatePaceFromPrescription, zoneRepresentativeSeconds, parseDistanceTokenToKm), generateWorkoutWeek`.
- **Validação:** `createValidationReport, addValidationIssue, isValidDayName, normalizePhaseValue, normalizeDayTypeValue, normalizeWorkoutForValidation, sumWeekKm, scaleWeekDistances, alignWorkoutDays, ensureLongRunIsLast, enforceWeeklyProgression, enforceContextualPaceCoherence, enforceWorkoutVariety, validateAndFixPlan`.
- **Score/risco:** `clampScore, phaseIdentityScore, calculatePlanQualityScore, normalizeRiskLabel, calculatePlanRiskLevel`.
- **Orquestração:** `generatePlan, parsePlanResponse, convertToWeeksData`.

### 4.2 `app.js` — funções-chave (não-motor)
- **Entitlement:** `getRunEvoSubscriptionPlan, isRunEvoPlusUser, getRunEvoSubscriptionState, setRunEvoSubscriptionPlan, updateRunEvoPremiumUI, showRunEvoPlusModal, archiveCurrentPlanForPlus`.
- **Adaptive Training:** `getWeekSummary, getCheckinCandidateWeek, getLocalAdjustmentRecommendation, callAICheckinCoach, normalizeAICheckinRecommendation, applyAdjustmentToStoredPlan, applySkippedWorkoutRedistribution, runSmartPlanAdjustmentEngine`.
- **Fingerprint:** `normalizeRunEvoComparablePlan, getRunEvoPlanFingerprint, areRunEvoPlansIdentical, renderRunEvoIdenticalPlanComparison, renderPlanComparisonHTML`.
- **Exportação:** geradores de PDF (canvas/print) e Excel (XLSX/HTML tabular) — funções de render `*Excel*` / `*Pdf*`.
- **Estado:** `weeklyCheckins, adjustmentHistory, allWorkouts` + `getWorkoutStatus, setWorkoutStatus`.

### 4.3 `storage-service.js`
`getKeys, isLoggedIn, login, logout, resetAllRunEvoLocalData, getCurrentUser, load/save{UserProfile,CompletedWorkouts,Customizations,WorkoutFeedback,WeeklyCheckins,AdjustmentHistory,Plan}, exportAll/importAll (payload)`.

### 4.4 `cloud-auth-service.js`
`isConfigured, handleAuthRedirectIfNeeded, getSession, getCurrentUser, signUpWithEmail, signInWithEmail, signInWithProvider, signInWithGoogle, signInWithApple, updatePassword, updateUserMetadata, sendPasswordReset, signOut`.

### 4.5 `api/generate-plan.js`
`fetchWithRetry` (retry 429/5xx), `tryModels` (fallback entre modelos), `handler` (POST, valida prompt, injeta `GEMINI_API_KEY`, `temperature: 0.2`, `responseMimeType: application/json`).

---

## 5. Regras do Motor RunEvo (comportamento a preservar)

### 5.1 Arquitetura híbrida
IA = **estrategista** (retorna só o **blueprint** — JSON pequeno). Motor = **executor determinístico** (monta e valida a planilha inteira). A IA **nunca** devolve a planilha completa como fonte final (`generatePlan` sempre roda `generateWorkoutWeek` + `validateAndFixPlan` local, independentemente da origem do blueprint).

### 5.2 Teste de 3 km (obrigatório)
Âncora de capacidade: `inferBasePaceSeconds` = pace médio do teste (a partir de `test3kmPace`, ou `test3kmTime/3`). Vira a referência da **Z3** (`capacity_anchored`). **Mas não domina sozinho:** em prova longa com objetivo explícito, a estratégia troca para `goal_anchored`.

### 5.3 Interpretação do objetivo (`getGoalContext`)
- Detecta **pace explícito** (`5:00`, `5'00`, "pace 5:00").
- Detecta **tempo final** (`sub 50`, `1h45`, `48:35`, `abaixo de 4 horas`, `6h30`) via `parseTimeGoalFromObjective`, convertendo em pace pela distância. Heurística: para `distanceKm ≥ 21` e formato `a:b:0` com `a ≤ 12` → interpreta `a` como horas (ex. `6:30` → 6h30 na maratona); em 5/10K → mm:ss.
- Detecta **intenção de recorde** (`pr|rp|recorde|melhor tempo…`) → usa tempo anterior da mesma distância × fator de melhora (`0.975` ≤10K, `0.98` 21K, `0.985` ≥42K) — progressão **realista, não agressiva**.
- Registra `source`/`confidence` do parse (`objective_pace`, `objective_time`, `previous_pr`).
- **Conflito teste-forte × objetivo-conservador:** objetivo/duração da prova vence → `goal_anchored`, mais Z1/Z2, progressão conservadora, longões no ritmo alvo (não mais rápido).
- `speedReserve` derivado de `goalPace − testPace`: `baixa|moderada|alta|muito alta`.

### 5.4 Terreno (`getTerrainGuidance`)
| Terreno | volumeFactor | longRunFactor | recoveryEvery |
|---|---|---|---|
| plano | 1.00 | 1.00 | 4 |
| misto | 0.94 | 0.94 | 3 |
| elevado | 0.88 | 0.88 | 3 |
Elevado reduz agressividade de pace, aumenta recuperação, orienta por esforço/zona, insere subidas controladas (biblioteca ganha `uphillQuality`), evita combinar subida + intensidade.

### 5.5 Zonas (Z1–Z5)
Duas estratégias:
- `capacity_anchored` (`buildTrainingZones`): faixas por % de velocidade da base (ex. Z1 0.60–0.76, Z2 0.76–0.87, Z3 0.93–1.00, Z4 1.02–1.15, Z5 > 1.15).
- `goal_anchored` (`buildGoalAnchoredZones`): offsets em segundos sobre o **pace alvo**, com tabelas distintas para ultra / maratona / demais. `capFast` impede Z4/Z5 mais rápidas que `test + N` (evita transformar velocista em tiros em prova longa).
- Regra crítica: **longões de ultra nunca mais rápidos que o pace alvo**; pace alvo aparece em Z2 alta / Z3 baixa; intervalados frequentes evitados em ultra; rodagens fáceis continuam fáceis.

### 5.6 Volumes e limites de segurança
- `getPeakWeeklyKmLimit` e `getPeakTrainingLongRunLimit`: tetos por distância × nível × dias/semana × semanas × IMC (`riskFactor` 0.88/0.94/1). Em ultra, maior longão de **treino** ≈ 58–72% da distância (não a prova inteira).
- `buildFallbackBlueprint` calcula `initialWeeklyKm/peakWeeklyKm/initial/peakLongRunKm` a partir de shares por dias/semana, aplicando `imcRisk` e `goalContext.volumeFactor/longRunFactor`, com teto pelos limites acima.

### 5.7 Fases (`buildPhaseDistribution`)
`Base → Resistência → Pico → Polimento`. Divisão: `taper` clamp(1..min(3, totalWeeks−3)); `baseEnd ≈ 38%`, `resistanceEnd ≈ 78%` do bloco pré-taper; Polimento = últimas `taper` semanas.

### 5.8 Alvos semanais (`calculateWeekTargets`)
Interpola volume/longão do inicial ao pico com `easeProgression` (`r^0.88`). Ajuste por `progressionStyle` (conservadora ×0.94, agressiva ×1.03). Semana de recuperação a cada `recoveryEveryWeeks` (volume ×0.75/0.78 ultra, longão ×0.76/0.80). Taper por ratios (`[0.62,0.38,0.25]` ou `[0.72,0.52,0.34,0.25]`). **Semana da prova:** `weeklyKm = distância + rodagens curtas`, `longRunKm = distância`. Fora da semana da prova, longão de treino nunca vira a distância-alvo completa; share máximo controlado.

### 5.9 Dias de treino (`getTrainingDays`)
Padrões preferenciais por nº de dias (2→Ter/Sáb … 6→Seg..Dom). Primeira semana parcial: primeiro treino cai na **data de início** e os demais seguem offsets mínimos.

### 5.10 Biblioteca e template (`getWorkoutLibrary`/`getWorkoutTemplate`)
Listas por fase e por tipo de prova (10k / longo / ultra) + polimento. `pickWorkoutVariant` alterna por semana/índice/fase para dar variedade. Slots por dias/semana (3 dias → base/qualidade/longão). **Longão sempre no último treino da semana.** Semana da prova: último treino = "Prova alvo" (evento final preservado).

### 5.11 Prescrição (`buildProfessionalWorkoutDescription`)
Árvore de decisão por `dayType`+`title`+`phase` gerando blocos zona a zona (aquecimento Z1 → bloco principal Zx → recuperação/desaquecimento Z1). Cobre: regenerativo, base/técnica/strides/econômica, subida, fartlek (leve/técnico e clássico), tempo/limiar, progressivo, ritmo alvo/segmentado, intervalado (reps/tiro/recuperação calculados), longão (contínuo/progressivo/específico/polimento) e prova. `estimatePaceFromPrescription` deriva o pace exibido a partir das zonas.

### 5.12 Validação e autocorreção (`validateAndFixPlan`)
Regenera cada semana com o motor e reconcilia com a origem, registrando issues e corrigindo quando seguro: fase inválida, contagem de treinos, dia inválido, longão fora do final (`ensureLongRunIsLast`), alinhamento de dias (`alignWorkoutDays`), progressão excessiva (`enforceWeeklyProgression`), coerência de pace por contexto (`enforceContextualPaceCoherence`), variedade (`enforceWorkoutVariety`), share de longão alto. `status: error` lança exceção (plano não passa). Summary consolida totais, picos, recuperação, taper, score, risco.

### 5.13 Quality Score (`calculatePlanQualityScore`) — 0 a 10
Critérios ponderados (pesos distintos p/ ultra): variedade, progressão, equilíbrio do longão, intensidade, recuperação, identidade de fases; menos penalidade de validação. `status`: excelente ≥8.2 · boa ≥7 · atenção ≥5.8 · revisar. Inclui `insights`, `adoptionAdvice`, métricas e detalhes (maior longão, % intenso, semanas de recuperação, achados de progressão/longão). Semana da prova é **ignorada** nos cálculos.

### 5.14 Risco (`calculatePlanRiskLevel`)
Soma pontos por: score técnico baixo, IMC, poucos dias × prova longa, ultra, prazo curto para a distância, alertas pendentes, reserva de velocidade muito alta. Níveis: baixo · médio (≥2) · alto (≥4) · muito alto (≥6). **Não é diagnóstico médico.**

### 5.15 Plano idêntico (fingerprint — em `app.js`)
`normalizeRunEvoComparablePlan` reduz o plano a estrutura comparável (objetivo, prova, semanas, contagem/soma de treinos, pico, maior longão, score, risco, e por treino: semana/título/tipo/fase/dia/km/pace/descrição normalizados). `getRunEvoPlanFingerprint` = JSON dessa estrutura. Idênticos → não cria cópia, não abre revisão genérica, mostra "A planilha nova é idêntica à atual."

---

## 6. Regras Free e RunEvo+

`getRunEvoSubscriptionPlan()` → `free|plus` (detecta flags `plus|pro|premium|paid|runevo+`). `isRunEvoPlusUser()` gate central. UI marca `[data-premium-feature]` com `is-premium-locked/unlocked`.

- **Free:** 1 planilha ativa (reforçada pelo índice único no banco), Home, treinos, concluir/pular, check-in, estatísticas básicas, 1 tênis, geração base, **PDF profissional**.
- **RunEvo+:** histórico, comparação técnica, auditoria avançada, **Excel profissional**, múltiplos tênis, relatórios, backup, múltiplas planilhas com arquivamento (`archiveCurrentPlanForPlus`).
- **Paywall:** conteúdo premium visível porém escurecido; um CTA principal ("Assinar RunEvo+"); mensal/anual; restaurar compra; termos. Pagamento real ainda **não conectado** no legado (nota explícita "Pagamento real ainda será conectado").

> **Débito técnico crítico:** entitlement é resolvido na **UI** (`isRunEvoPlusUser` lê estado local). Na nova arquitetura, deve ser validado no **serviço** (tabela `subscriptions`), não só na UI.

---

## 7. Fluxo de autenticação

`cloud-auth-service` sobre Supabase Auth: e-mail/senha (`signUp`/`signIn`), Google/Apple (`signInWithProvider`), reset (`sendPasswordReset`), confirmação de e-mail, `updateUserMetadata` (sincroniza nome/avatar). Sessão persistente via Supabase. `user-profile-service` reconcilia perfil nuvem↔cache. Decisão documentada (`auth-architecture.md`): nuvem é fonte de verdade; local só cache/offline. Legado ainda mantém `login/logout` locais em `storage-service` (ponte de transição).

**Migração:** tokens → `SecureStore`; sessão persistente nativa; adicionar **excluir conta**; fila de mutações offline.

---

## 8. Fluxo de geração

```
userData (form IA Evo)
 → generateBlueprint            (IA via /api/generate-plan → normalizeBlueprint; ou buildFallbackBlueprint)
 → for weekNumber in 1..totalWeeks: generateWorkoutWeek
      → calculateWeekTargets → getTrainingDays → allocateWorkoutDistances
      → getWorkoutTemplate → buildProfessionalWorkoutDescription → estimatePace
 → validateAndFixPlan           (autocorreção + progressão/pace/variedade + score + risco)
 → preview → adoptPlan
```
`source = ai | local` registrado no blueprint (`source`/`engineCalibration.source`).

---

## 9. Fluxo de conclusão de treino

Detalhe do treino mostra fase/semana/título/data/distância/pace/Z1–Z5/como executar/blocos. **Concluir** → form (km realizado, tênis, esforço 1–10, observação) → grava `workout_feedback` + status `completed` + atualiza km do tênis. **Pular** → confirmação + motivo opcional → status `skipped`, **sem** form de conclusão. Status por treino em `completed_workouts`/`getWorkoutStatus`.

---

## 10. Fluxo de Adaptive Training

1. **Liberação:** `getCheckinCandidateWeek` + `canCheckin = resolved === total` (todos concluídos/parciais/pulados). Pill: Feito / Liberado / Aguardando treinos.
2. **Coleta:** sensação (leve/normal/pesado/muito_pesado), esforço 1–10, dor sim/não, observações; **peso obrigatório** quando `(weekIndex+1) % 4 === 0`.
3. **Recomendação local** (`getLocalAdjustmentRecommendation`) e, se disponível, **IA** (`callAICheckinCoach` → `normalizeAICheckinRecommendation` com guardrails).
4. **Guardrails (nunca violados):** dor → nunca aumenta (recovery ×0.75); esforço ≥9 ou sensação "muito_pesado" → nunca aumenta (≤ redução); aderência <60% → reduz (×0.85); aumento adicional **máx +3%** (`slight_increase` clamp 1–3%); redução 10–20% (`reduce`) / 15–30% (`recovery`); semana perfeita+leve → mantém (deixa a progressão prevista agir).
5. **Treino pulado** (`applySkippedWorkoutRedistribution`): não é punição; redistribui **30–50%** da carga perdida (ratio por esforço: ≤5→0.5, ≤7→0.4, senão 0.3; dor→0), limitado a **~12%** da semana seguinte; nunca mexe na prova.
6. **Aplicação** (`applyAdjustmentToStoredPlan`): ajusta apenas **semanas futuras** (`weeksToAdjust` 1–2); nunca altera a prova; salva plano e reaplica se adotado.
7. Edição manual invalida o check-in afetado (`invalidate…`).

---

## 11. Riscos da migração

1. **Perda de comportamento determinístico** ao "terceirizar" a planilha para IA — proibido. O motor deve ser portado função a função com testes de equivalência (Fase 2).
2. **`localStorage`/DOM em regra de negócio** — o motor é puro (JS sem DOM), mas `app.js` mistura regra (adaptive/fingerprint/entitlement) com renderização. Extrair para `domain/` puro e `services/`.
3. **Entitlement na UI** — mover para serviço + `subscriptions`. Risco de bypass.
4. **Formatos divergentes** plano-local × schema Supabase (`week:"S{n}"`, `dayOfWeek/desc/km` vs `day_label/description/planned_km`) — exige mapeadores testados.
5. **Timezone e primeira semana parcial** — `parseLocalDate` evita UTC-shift; replicar com cuidado (não usar `new Date('YYYY-MM-DD')` puro).
6. **Regex de objetivo em pt-BR** — heurísticas sensíveis (6:30→6h30 só p/ ≥21K). Portar com testes de fixtures §39.
7. **XLSX real** — Excel deve abrir em Excel/Sheets/OnlyOffice; não gerar HTML disfarçado.
8. **Offline/sync** — fila de mutações e resolução de conflito (nuvem = verdade) não existem hoje.
9. **IDs UUID** — legado usa IDs textuais (`"S{n}-{i}"`); no banco são UUID. Não fabricar IDs textuais em colunas UUID.
10. **Chaves legadas** — migração one-shot de contas antigas (opcional; provavelmente descartável no novo app).

---

## 12. Funcionalidades incompletas / débitos no legado

- **Billing real não conectado** (mensal/anual só estrutural; nota explícita no modal).
- **Entitlement só na UI** (sem verificação server-side de assinatura).
- **`weekly_checkins` no schema** tem `fatigue_level/pain_level` (numéricos) enquanto o app coleta `feeling`/`pain` (categórico) — divergência a normalizar.
- **`plan_workouts` no schema** existe, mas o legado persiste o plano inteiro como blob em `ai_plan` (localStorage) — a normalização treino-a-treino no banco ainda não é usada de fato.
- **`convertToWeeksData`** gera `dateBR`/`day` a partir de `new Date(w.date)` — mas os workouts do motor usam `dayOfWeek` (nome), não `date` ISO; há dependência de outro ponto que injeta datas reais (a consolidar na Fase 3/5).
- **Sem testes automatizados** do motor no legado (`scripts/qa-first-access-flow.js` é QA de fluxo, não unitário).
- **Ponte Capacitor/PWA/SW** — descartada por completo na nova arquitetura.

---

## 13. Tabela: funções JavaScript antigas → novos módulos TypeScript

> Todos os destinos vivem em `src/domain/motor-evo/` (funções **puras**, sem React Native), exceto onde indicado (`services/`, `store/`). Contrato de tipos em `types.ts`.

### 13.1 Perfil / datas / pace / distância
| Legado (`ai-coach.js`) | Novo módulo | Export |
|---|---|---|
| `sanitizeProfileDraft`, `saveProfile`, `loadProfile`, `clearProfileDraft` | `profile.ts` (+ `repositories/athlete-profile.repository.ts` p/ persistência) | `sanitizeProfileDraft`, `AthleteDraft` |
| `parseLocalDate`, `addDays`, `calculateWeeks`, `getStartDayOfWeek` | `dates.ts` | `parseLocalDate`, `addDays`, `calculateWeeks`, `getStartDayOfWeek` |
| `clamp`, `roundKm`, `parseNumber`, `interpolate`, `easeProgression` | `utils/math.ts` | idem |
| `calculateIMC` | `profile.ts` | `calculateIMC` |
| `getDistanceKm`, `getDistanceLabel`, `raceDistanceKey`, `getRaceType` | `objective.ts` (distância/tipo) | idem |
| `paceToSeconds`, `timeToSeconds`, `secondsToDuration`, `secondsToPace`, `paceRange`, `speedFromPaceSeconds`, `paceSecondsFromSpeed`, `formatSpeed` | `pace.ts` | idem |

### 13.2 Objetivo
| Legado | Novo módulo | Export |
|---|---|---|
| `normalizeObjectiveText`, `parseTimeGoalFromObjective`, `getGoalTargetInfo`, `inferGoalPaceSeconds`, `getPreviousRaceTimeSeconds`, `getPreviousTimesText`, `inferBasePaceSeconds`, `getGoalContext` | `objective.ts` | `parseObjective`, `getGoalContext`, `GoalContext` |

### 13.3 Terreno / zonas
| Legado | Novo módulo | Export |
|---|---|---|
| `getTerrainLabel`, `getTerrainGuidance` | `terrain.ts` | `getTerrainGuidance`, `TerrainGuidance` |
| `zoneRangeFromSpeedPercent`, `buildZoneRangeFromPaces`, `buildGoalAnchoredZones`, `buildTrainingZones`, `buildLocalPaceZones`, `zoneRepresentativeSeconds` | `zones.ts` | `buildTrainingZones`, `buildLocalPaceZones`, `TrainingZones` |

### 13.4 Blueprint / IA
| Legado | Novo módulo | Export |
|---|---|---|
| `buildBlueprintPrompt` | `blueprint.ts` | `buildBlueprintPrompt` |
| `callGeminiAPI`, `parseJSONResponse`, `generateBlueprint` | `services/ai/plan-blueprint.provider.ts` (implementa `PlanBlueprintProvider`) | `RemoteBlueprintProvider` |
| `buildFallbackBlueprint` | `services/ai/local-blueprint.provider.ts` + `blueprint.ts` | `LocalBlueprintProvider`, `buildFallbackBlueprint` |
| `normalizeBlueprint`, `buildPhaseDistribution`, `normalizePhaseDistribution` | `blueprint.ts` / `phases.ts` | `normalizeBlueprint`, `buildPhaseDistribution` |
| `getPeakTrainingLongRunLimit`, `getPeakWeeklyKmLimit` | `weekly-targets.ts` | `getPeakWeeklyKmLimit`, `getPeakLongRunLimit` |

### 13.5 Geração semanal
| Legado | Novo módulo | Export |
|---|---|---|
| `getPhaseForWeek`, `calculateWeekTargets` | `weekly-targets.ts` / `phases.ts` | `calculateWeekTargets`, `getPhaseForWeek` |
| `getTrainingDays`, `allocateWorkoutDistances` | `weekly-targets.ts` | idem |
| `pickWorkoutVariant`, `getWorkoutLibrary`, `getWorkoutTemplate` | `workout-library.ts` | `getWorkoutLibrary`, `selectWorkoutTemplate` |
| `paceForWorkout`, `easy/moderate/racePaceForWorkout`, `stripPaceSuffix`, `parsePaceToSeconds`, `parseDistanceTokenToKm`, `estimatePaceFromPrescription`, `kmPart`, `formatKmValue`, `splitDistance`, `buildFartlekBlock`, `buildSimpleZonePrescription`, `buildProfessionalWorkoutDescription` | `workout-prescription.ts` | `prescribeWorkout` (+ helpers internos) |
| `generateWorkoutWeek` | `plan-generator.ts` | `generateWorkoutWeek` |

### 13.6 Validação / score / risco
| Legado | Novo módulo | Export |
|---|---|---|
| `createValidationReport`, `addValidationIssue`, `isValidDayName`, `normalizePhaseValue`, `normalizeDayTypeValue`, `normalizeWorkoutForValidation`, `sumWeekKm`, `scaleWeekDistances`, `alignWorkoutDays`, `ensureLongRunIsLast`, `enforceWeeklyProgression`, `enforceContextualPaceCoherence`, `enforceWorkoutVariety`, `validateAndFixPlan` | `validation.ts` | `validateAndFixPlan`, `ValidationIssue`, `ValidationReport` |
| `clampScore`, `phaseIdentityScore`, `calculatePlanQualityScore` | `quality-score.ts` | `calculatePlanQualityScore`, `QualityScore` |
| `normalizeRiskLabel`, `calculatePlanRiskLevel` | `risk.ts` | `calculatePlanRiskLevel`, `RiskLevel` |

### 13.7 Orquestração / adaptação / fingerprint (hoje espalhados em ai-coach.js + app.js)
| Legado | Novo módulo | Export |
|---|---|---|
| `generatePlan`, `parsePlanResponse`, `convertToWeeksData` | `plan-generator.ts` (+ `index.ts` fachada) | `generatePlan`, `parsePlanResponse` |
| `normalizeRunEvoComparablePlan`, `getRunEvoPlanFingerprint`, `areRunEvoPlansIdentical` (app.js) | `fingerprint.ts` | `computePlanFingerprint`, `arePlansIdentical` |
| `getLocalAdjustmentRecommendation`, `normalizeAICheckinRecommendation`, `applyAdjustmentToStoredPlan`, `applySkippedWorkoutRedistribution`, `runSmartPlanAdjustmentEngine`, `getWeekSummary`, `getCheckinCandidateWeek` (app.js) | `adaptive-training.ts` (regras puras) + `services/ai/checkin-coach.provider.ts` (IA) + `repositories/checkin.repository.ts` | `recommendAdjustment`, `applyAdjustment`, `redistributeSkipped`, `AdaptiveRules` |
| `getRunEvoSubscriptionPlan`, `isRunEvoPlusUser`, `setRunEvoSubscriptionPlan`, `archiveCurrentPlanForPlus` (app.js) | `services/subscription/*` (`SubscriptionService`) + `repositories/subscription.repository.ts` | `SubscriptionService`, `useEntitlement` |
| Persistência `storage-service.js` (todas) | `repositories/*` (Supabase + cache SQLite) | repositórios tipados |
| `cloud-auth-service.js` (todas) | `services/auth/*` (Supabase Auth + SecureStore) | `AuthService` |
| Export PDF/Excel (app.js) | `services/export/*` | `PdfExporter`, `ExcelExporter` |

---

_Fim da auditoria. Próximos artefatos: `migration-plan.md`, `motor-evo-specification.md`._
