# Motor RunEvo — Especificação Determinística

> Fase 0 — Especificação funcional do motor a ser portado para `src/domain/motor-evo/` (funções puras, TypeScript strict, sem React Native).
> Derivada da leitura integral de `assets/js/ai-coach.js` (motor) e das regras de `app.js` (adaptive/fingerprint).
> **Contrato:** a saída do motor novo deve ser equivalente à do legado nas fixtures §39 do enunciado.

---

## 1. Arquitetura híbrida (regra-mãe)

```
IA (estrategista)  →  PlanBlueprint (JSON pequeno, validado)
                       │
Motor (executor)   →  monta cada semana determinística
                   →  valida e autocorrige
                   →  calcula quality score e risco
                   →  fingerprint
                   →  adapta semanas futuras (check-in)
```

A IA **nunca** produz a planilha final. `generatePlan` sempre executa `generateWorkoutWeek` (local) + `validateAndFixPlan` (local), qualquer que seja a origem do blueprint. Origem registrada em `source: 'ai' | 'local'`.

---

## 2. Tipos-núcleo (`types.ts` — contrato)

```ts
type TargetDistance = '5k' | '10k' | '21k' | '42k' | 'ultra' | 'custom';
type Terrain = 'plano' | 'misto' | 'elevado';
type Phase = 'Base' | 'Resistência' | 'Pico' | 'Polimento';
type DayType = 'Base' | 'Qualidade' | 'Longão' | 'Recuperação' | 'Intervalado';
type RaceType = '5k' | '10k' | 'meia' | 'maratona' | 'ultra';
type ZoneStrategy = 'capacity_anchored' | 'goal_anchored' | 'mixed_goal_capacity' | 'fallback';
type RiskLevel = 'baixo' | 'médio' | 'alto' | 'muito alto';

interface AthleteInput {         // "userData"
  name?: string; age?: number; height?: number; weight?: number; imc?: number;
  level?: string;                // iniciante|intermediário|avançado (parsing tolerante)
  targetDistance: TargetDistance; customDistance?: number;
  terrain?: Terrain; terrainType?: Terrain;
  startDate: string; raceDate: string; daysPerWeek?: number;   // 2..6
  time5k?: string; no5k?: boolean; time10k?: string; no10k?: boolean;
  time21k?: string; no21k?: boolean; time42k?: string; no42k?: boolean;
  test3kmTime?: string; test3kmPace?: string;   // teste obrigatório
  objective?: string;
}

interface Zone { label: string; name: string; perception: string;
  from: string; to: string; speedFrom: string; speedTo: string; }
interface TrainingZones {
  anchor: { label: string; pace: string; speed: string; method: 'goal_anchored'|'capacity_anchored'; capacityPace?: string|null };
  Z1: Zone; Z2: Zone; Z3: Zone; Z4: Zone; Z5: Zone;
}

interface Workout { dayOfWeek: string; dayType: DayType; title: string;
  desc: string; km: number; pace: string; zoneTarget: string;
  redistributedFromSkipped?: boolean; redistributedKm?: number; }
interface Week { week: string; phase: Phase; off: boolean; workouts: Workout[]; }

interface ValidationIssue { code: string; severity: 'info'|'warning'|'error';
  week?: number; workoutId?: string; message: string; fixed: boolean; }
```

---

## 3. Datas, distância e duração (`dates.ts`, `pace.ts`, `objective.ts`)

- `calculateWeeks(start, race)`: alinha início à **segunda** e prova ao **domingo**; `diffWeeks` arredondado; **mín 4, máx 52**. Semana = segunda→domingo. Primeira semana pode ser parcial.
- `parseLocalDate`: parsing **local** (evita shift UTC). Datas reais em cada treino.
- `getDistanceKm`: `5k=5, 10k=10, 21k=21.0975, 42k=42.195`; `ultra|custom` usa `customDistance`.
- `pace.ts`: `paceToSeconds`, `timeToSeconds`, `secondsToDuration`, `secondsToPace` (piso 180s = 3:00/km), `speedFromPaceSeconds = 3600/s`, `paceSecondsFromSpeed`, `formatSpeed`.

---

## 4. Teste de 3 km (âncora de capacidade)

`inferBasePaceSeconds`: usa `test3kmPace`; senão `test3kmTime / 3`. É a **referência da Z3** (`capacity_anchored`). Obrigatório. **Não domina sozinho** a preparação: objetivo/distância podem trocar a estratégia para `goal_anchored`.

---

## 5. Interpretação do objetivo (`getGoalContext`)

Entradas de intenção suportadas (pt-BR): `sub 50`, `abaixo de 4 horas`, `1h45`, `6h30`, `48:35`, `pace 5:00`, `5'00`, "bater meu recorde/RP", "completar sem parar", "terminar com segurança", "evitar lesões".

Passos:
1. **Pace explícito** (`getGoalTargetInfo` — padrões `mm:ss pace`, `pace mm:ss`, `m'ss`).
2. **Tempo final** (`parseTimeGoalFromObjective`) → converte em pace pela distância. Heurística chave: `distanceKm ≥ 21` + formato `a:b:0` com `a ≤ 12` ⇒ `a` = horas (`6:30`→6h30); em 5/10K ⇒ mm:ss. Ignora tempos < 4min.
3. **Recorde/PR** → usa tempo anterior da mesma distância × fator (`0.975` ≤10K, `0.98` 21K, `0.985` ≥42K). Progressão realista.
4. Deriva `speedReserve` (`goalPace − testPace`): baixa/moderada/alta/muito alta.
5. Decide `goalAnchored`: `goalPace` presente **e** (`veryLongDistance` **ou** (`longDistance` **e** (palavras de resistência **ou** `muchSlowerGoal`))). `muchSlowerGoal` = objetivo ≥45s (ultra) / ≥60s mais lento que o teste.
6. Registra `source`/`confidence`. **Prioriza segurança**: conflito teste-forte × objetivo-conservador ⇒ objetivo vence.

Saída `GoalContext`: `{ type: 'endurance_goal'|'performance_goal', raceType, goalPace, goalTarget, testPace, distanceKm, terrain, speedReserve, zoneStrategy, intensityBias, progressionStyle, recoveryPriority, volumeFactor, longRunFactor, qualityFrequency, targetSummary, targetSource, summary }`.

---

## 6. Terreno (`terrain.ts`)

| Terreno | volumeFactor | longRunFactor | recoveryEvery | foco |
|---|---|---|---|---|
| plano | 1.00 | 1.00 | 4 | ritmo contínuo, economia, progressão |
| misto | 0.94 | 0.94 | 3 | subidas leves/moderadas, controle por zona |
| elevado | 0.88 | 0.88 | 3 | subidas, técnica, esforço por zona, menor agressividade |

Elevado adiciona `uphillQuality` à biblioteca (exceto Polimento) e evita combinar subida + intensidade.

---

## 7. Zonas Z1–Z5 (`zones.ts`)

**`capacity_anchored`** — faixas por % da velocidade base:
Z1 0.60–0.76 · Z2 0.76–0.87 · Z3 0.93–1.00 (âncora do teste) · Z4 1.02–1.15 · Z5 > 1.15.

**`goal_anchored`** — offsets em segundos sobre `goalPace`, por tipo:
- ultra: Z1 [+75,+135] · Z2 [+25,+70] · Z3 [−10,+20] · Z4 [−45,−15] · Z5 [−75,−45]
- maratona: Z1 [+60,+120] · Z2 [+20,+60] · Z3 [−10,+20] · Z4 [−40,−10] · Z5 [−70,−40]
- demais longas: Z1 [+45,+95] · Z2 [+15,+45] · Z3 [−10,+15] · Z4 [−35,−10] · Z5 [−60,−35]
- `capFast`: Z4/Z5 nunca mais rápidas que `test + (90/60 ultra | 60/30)` — reserva de velocidade não vira obrigação de treinar rápido.

Cada zona: `label, name, perception, from, to, speedFrom, speedTo`. `anchor.method` indica a estratégia. `buildLocalPaceZones` mapeia easy=Z1, moderate=Z2, threshold=Z3, interval=Z4, long=Z2, racePace=Z3 (+ `trainingZones`, `zoneMethod`, `goalContext`).

**Regras críticas:** longão de ultra ≤ pace alvo; pace alvo em Z2 alta/Z3 baixa/blocos específicos; intervalados frequentes evitados em ultra; rodagens fáceis permanecem fáceis.

---

## 8. Blueprint da IA (`blueprint.ts` + `services/ai`)

Contrato (Zod) — a IA retorna **somente** este JSON:

```ts
type AthleteAnalysis = { detectedLevel: string;
  riskLevel: 'baixo'|'médio'|'alto'|'muito alto';
  goalFeasibility: string; mainStrength: string; mainWeakness: string;
  focus: string; coachSummary: string; };
type BlueprintStrategy = { initialWeeklyKm: number; peakWeeklyKm: number;
  initialLongRunKm: number; peakLongRunKm: number;
  recoveryEveryWeeks: number; taperWeeks: number; };
type PlanBlueprint = { athleteAnalysis: AthleteAnalysis; strategy: BlueprintStrategy;
  paceZones: Record<string,string>;
  phaseDistribution: Array<{ phase: Phase; startWeek: number; endWeek: number }>;
  warnings: string[];
  engineCalibration: {
    progressionStyle: 'conservadora'|'equilibrada'|'agressiva';
    recoveryPriority: 'baixa'|'média'|'alta';
    intensityBias: 'baixo'|'moderado'|'alto'; }; };

interface PlanBlueprintProvider { generate(input: BlueprintPromptInput): Promise<PlanBlueprint>; }
```

`buildBlueprintPrompt` injeta dados do atleta, contexto do objetivo interpretado, paces base e regras de treinador; instrui a IA a **não** detalhar semanas/workouts. `normalizeBlueprint` reconcilia a resposta com o fallback, aplica limites de segurança (`getPeakWeeklyKmLimit`, `getPeakTrainingLongRunLimit`), clampa taper e ajusta por `goalContext`/risco.

**Backend seguro:** porta de `api/generate-plan.js` — retries 429/5xx, fallback de modelo, `responseMimeType: application/json`, `temperature` baixa; **chave nunca no app**.

---

## 9. Fallback local (`buildFallbackBlueprint`)

Determinístico. Gatilhos: IA falha / JSON inválido / limite / indisponível / sem resposta. Calcula `initial/peakLongRunKm` por distância×nível, aplica `imcRisk` (0.85/0.93/1) e `goalContext.longRunFactor`; deriva `initialWeeklyKm/peakWeeklyKm` por shares de longão por dias/semana × `volumeFactor`, com teto pelos limites de pico; `taperWeeks` (3 se ≥18 semanas, senão 2); `recoveryEveryWeeks` (3 p/ iniciante ou IMC≥27, senão 4). Preenche `athleteAnalysis`, `warnings`, `engineCalibration` (com `goalContext`). `source = 'local'`. **Atleta nunca fica bloqueado.**

---

## 10. Fases (`phases.ts`)

`buildPhaseDistribution(totalWeeks, taperWeeks)`: taper = clamp(1..min(3, totalWeeks−3)); `peakEnd = total − taper`; `baseEnd ≈ 38%`, `resistanceEnd ≈ 78%` de `peakEnd`; Polimento = últimas `taper` semanas. `normalizePhaseDistribution` garante cobertura 1..totalWeeks. Identidades: Base (adaptação/aeróbico/técnica/progressão conservadora), Resistência (volume controlado, longões maiores, especificidade crescente), Pico (especificidade máxima, longões-chave, ritmo de prova, intensidade seletiva), Polimento (redução de carga, ativação, prova).

---

## 11. Alvos semanais (`weekly-targets.ts`)

`calculateWeekTargets(weekNumber, totalWeeks, blueprint, distanceKm)`:
- Interpola volume/longão inicial→pico com `easeProgression(r) = r^0.88`.
- `progressionStyle`: conservadora ×0.94, agressiva ×1.03 (só pré-taper).
- Recuperação: `weekNumber % recoveryEveryWeeks === 0` (clamp 3–5) → volume ×0.75 (0.78 ultra), longão ×0.76 (0.80 ultra), `off=true`.
- Taper: ratios `[0.62,0.38,0.25]` (2 sem) ou `[0.72,0.52,0.34,0.25]` (3+).
- **Semana da prova** (`weekNumber === totalWeeks`): `weeklyKm = distância + rodagens curtas (6..16, ~12% do pico)`, `longRunKm = distância`.
- Fora da prova: `longRunKm ≤ peakLongRunKm`; share máximo do longão controlado (ultra ≤0.70/0.64; ≥42K 0.60; ≤3 dias 0.55; senão 0.50) — sobe o volume se necessário.

`getTrainingDays`: padrões por dias (2→Ter/Sáb; 3→Ter/Qui/Sáb; …; 6→Seg..Dom). 1ª semana parcial: 1º treino na data de início + offsets mínimos.
`allocateWorkoutDistances`: pesos por dias/semana; **último treino = longão**; semana da prova = rodagens pré-prova + prova.

---

## 12. Biblioteca e template (`workout-library.ts`)

Listas por fase × tipo de prova (10k / longo / ultra) + Polimento; tipos: regenerativo, rodagem leve/base/econômica/contínua/strides, técnica, subida controlada, fartlek (leve/técnico/clássico), intervalado/tiros, tempo/limiar, ritmo de prova/segmentado, progressivo, longão (contínuo/progressivo/específico/consolidação/reduzido), ativação, prova. `pickWorkoutVariant` rotaciona por semana/índice/fase (variedade; evita repetir título/estrutura em excesso). `getWorkoutTemplate` distribui slots (3 dias: base/qualidade/longão; ≥4: mapa `base,quality,recovery,base,quality`). **Longão sempre no último treino; prova = evento final.**

---

## 13. Prescrição (`workout-prescription.ts`)

`buildProfessionalWorkoutDescription({template, km, pace, phase, blueprint, isRaceWeek, distanceKm})`: árvore por `dayType`+`title`+`phase` produzindo blocos zona a zona — **aquecimento (Z1) → bloco principal (Zx) → recuperação/desaquecimento (Z1)**. Casos cobertos: regenerativo, base/técnica/strides/econômica/ativação, subida, fartlek (leve/técnico e clássico via `buildFartlekBlock`), tempo/limiar (Z3 sustentado, sem virar tiro), progressivo, ritmo alvo/segmentado (curto e longo), intervalado (reps/tiro/recuperação calculados por km e "curto"), longão (contínuo/progressivo/específico/polimento; ultra: 20% Z1 / 65% Z2 / 15% Z3), prova. Cada prescrição contém aquecimento, bloco principal, recuperação, desaquecimento, zona, pace, distância e observações. `estimatePaceFromPrescription` deriva o pace exibido a partir das zonas. **Evitar descrições vagas e repetição excessiva.**

---

## 14. Validação e autocorreção (`validation.ts`)

`validateAndFixPlan(plan, userData)`: para cada semana regenera com o motor e reconcilia com a origem, registrando `ValidationIssue` e corrigindo quando seguro. Detecta/corrige: array de semanas ausente, semana ausente, fase inválida, tipo inválido, dia inválido (`alignWorkoutDays`), nº de treinos incorreto, longão fora do final (`ensureLongRunIsLast`), soma semanal, salto de volume (`enforceWeeklyProgression`), pace incoerente por contexto (`enforceContextualPaceCoherence`), repetição/variedade (`enforceWorkoutVariety`), share de longão alto, descrição vaga/ausente, prova preservada. `status: 'ok'|'warning'|'error'`; **`error` lança exceção** (plano reprovado). Summary consolida totais, `peakWeekKm`, `peakTrainingLongRunKm`, `recoveryWeeks`, `taperWeeks`, `qualityScore`, `riskLevel`. Sempre que seguro, autocorrige e marca `fixed: true`.

---

## 15. Quality Score (`quality-score.ts`) — 0 a 10

Critérios (pesos distintos para ultra): **variedade** (densidade de títulos/tipos − penalidade de repetição, com piso), **progressão** (penaliza saltos > ~16–24% e quedas bruscas), **equilíbrio do longão** (share máximo por tipo/dias; penaliza salto de longão), **intensidade** (faixa de % de treinos intensos por distância), **recuperação** (semanas off esperadas + presença de taper), **identidade de fases**. Menos `validationPenalty` (issues não corrigidas). Semana da prova **ignorada**.
`status`: excelente ≥8.2 · boa ≥7 · atenção ≥5.8 · revisar. Retorna `overall, status, adoptionAdvice, metrics{variety,progression,longRunBalance,intensityDistribution,recovery,phaseIdentity}, details{...}, insights[]`.

---

## 16. Risco (`risk.ts`)

`calculatePlanRiskLevel`: soma pontos por score baixo (<5.8:+3 / <7:+2 / <8:+1), IMC (≥30:+2 / ≥26:+1), ≤3 dias × prova ≥42.2 (+1), ultra (+1), prazo curto (`<12 sem` e ≥21K: +2; `<20 sem` e ultra: +1), ≥3 alertas pendentes (+1), reserva muito alta em ≥21K (+0.5). Níveis: baixo · médio (≥2) · alto (≥4) · muito alto (≥6). Retorna `{level, points, reasons[]}`. **Não é diagnóstico médico.**

---

## 17. Fingerprint / plano idêntico (`fingerprint.ts`)

`computePlanFingerprint(plan)`: normaliza para estrutura comparável (objetivo, prova, semanas, contagem/soma de treinos, pico, maior longão de treino, score, risco; por treino: semana/título/tipo/fase/dia/km/pace/descrição normalizados minúsculos) e serializa (JSON estável). `arePlansIdentical(a,b)` compara fingerprints. Se idêntico ao ativo: **não** cria cópia, **não** abre revisão genérica, exibe "A nova planilha é idêntica à atual." (recomenda alterar objetivo/prazo/frequência/terreno/métricas).

---

## 18. Adaptive Training (`adaptive-training.ts`)

**Liberação do check-in:** todos os treinos da semana resolvidos (`concluído | parcial | pulado`) → `canCheckin = resolved === total`. Exibe treinos resolvidos/total, km realizado/planejado, esforço médio, status.

**Coleta:** esforço percebido, sensação (leve/normal/pesado/muito_pesado), dor (sim/não), observação, **peso obrigatório** quando `(weekIndex+1) % 4 === 0` (e ciclos definidos), contexto da semana.

**Recomendação:** local (`recommendAdjustment`) + IA opcional (`CheckinCoachProvider`) com **guardrails** aplicados por cima da IA:
- dor → nunca aumenta; vira `recovery` (redução 15–30%, `factor 1−clamp/100`, ×0.75 local).
- esforço ≥9 ou "muito_pesado" → nunca aumenta.
- aderência <60% → reduz (×0.85).
- aumento adicional **máx +3%** (`slight_increase` clamp 1–3%).
- redução 10–20% (`reduce`).
- semana perfeita + leve (completou tudo, esforço ≤5, sensação leve) → **mantém** (deixa a progressão prevista agir).
- ações válidas: `maintain | reduce | recovery | slight_increase`.

**Treino pulado (`redistributeSkipped`):** não é punição. Redistribui **30–50%** da carga perdida (ratio por esforço: ≤5→0.5, ≤7→0.4, senão 0.3; dor→0), **limitado a ~12%** da semana seguinte; prioriza treinos Base/Longão/Qualidade; **nunca** mexe na prova. Marca `redistributedFromSkipped`/`redistributedKm`.

**Aplicação (`applyAdjustment`):** ajusta apenas **semanas futuras** (`weeksToAdjust` 1–2); `recovery` marca `off=true` e rebaixa fase para Base (exceto Polimento); reescala km com `factor`; **nunca** altera a semana da prova. Preferir manutenção quando o esforço foi controlado. Fallback local se a IA falhar. Edição manual invalida o check-in afetado.

---

## 19. Edição manual (`plan-generator` + repositories)

Preservar: editar treino, adicionar, remover, alterar data/título/tipo/km/pace/descrição, recalcular semana, reordenar, invalidar check-in afetado, sincronizar Home/Treinos/PDF/Excel. Recalcular totais da semana após edição; se plano adotado, reaplicar.

---

## 20. Orquestração (`index.ts` / `plan-generator.ts`)

```ts
async function generatePlan(input: AthleteInput): Promise<Plan> {
  const totalWeeks = calculateWeeks(input.startDate, input.raceDate);
  const blueprint = await resolveBlueprint(input);   // provider IA → fallback local
  const weeks = range(1, totalWeeks).map(w => generateWorkoutWeek({ weekNumber: w, totalWeeks, input, blueprint }));
  return validateAndFixPlan({ ...meta, weeks, blueprint, userData: withImc(input) }, input);
}
```
`parsePlanResponse(text, input)` (colar/importar blueprint manual): `normalizeBlueprint(parse(text))` → mesma pipeline de geração + validação.

---

## 21. Critérios de equivalência (para os testes da Fase 2)

Para cada fixture §39, comparar entre legado e novo: **nº de semanas, fases por semana, volume semanal, pico, maior longão de treino, zonas (método e faixas), tipos/títulos de treino, datas, relatório de validação (códigos e `fixed`), quality score (± tolerância de arredondamento documentada), nível de risco (+ razões), fingerprint (estrutura idêntica)**. Diferenças intencionais devem ser listadas e justificadas.

---

_Fim da especificação do Motor RunEvo._
