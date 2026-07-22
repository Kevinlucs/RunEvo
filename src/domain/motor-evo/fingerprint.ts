import type { Plan } from './plan-generator';

/**
 * Porte 1:1 de `legacy/app.js` — fingerprint / detecção de plano idêntico.
 * Mapeamento: docs/legacy-audit.md §13.7
 * (`normalizeRunEvoComparablePlan, getRunEvoPlanFingerprint, areRunEvoPlansIdentical`
 * → `computePlanFingerprint`, `arePlansIdentical`).
 *
 * `app.js` (ao contrário de `ai-coach.js`) tem dependências de DOM/estado global
 * fora destas funções — só a cadeia de dependência transitiva de
 * `normalizeRunEvoComparablePlan` foi portada (verificada por leitura manual,
 * nenhuma toca DOM/localStorage): `formatKm`, `getPlanReviewSummary`,
 * `getRiskLabelText`, `formatPlanScore`, `getPlanRisk`, `getPlanDistanceLabel`,
 * `getCompactPlanSummary` — todas privadas aqui (não fazem parte da API pública
 * de `fingerprint.ts`, só da `AICoach`/`app.js` originais).
 *
 * Tipos de entrada deliberadamente frouxos (`unknown` nos campos, não `any`):
 * o legado é defensivo por natureza (`w.title || w.name`, `w.type || w.category`
 * etc.) — ver `PlanLike` abaixo. Isso preserva um achado de fidelidade: como o
 * plano do motor novo usa `dayType`/`dayOfWeek`/`desc` (não `type`/`day`/
 * `description`, e não tem `plan.objective`/`plan.totalKm` no nível raiz), os
 * campos `type`, `day`, `objective` e `totalKm` do fingerprint são SEMPRE
 * vazios/zero em qualquer plano real gerado pelo motor — confirmado por leitura
 * de `app.js` e pelo harness (`legacy-fingerprint-harness.ts`). Não "corrigido"
 * aqui: mudar isso alteraria quais planos contam como idênticos.
 */

interface PlanLikeWorkout {
  week?: unknown;
  title?: unknown;
  name?: unknown;
  type?: unknown;
  category?: unknown;
  phase?: unknown;
  day?: unknown;
  weekday?: unknown;
  km?: unknown;
  distance?: unknown;
  pace?: unknown;
  plannedPace?: unknown;
  description?: unknown;
  desc?: unknown;
}

interface PlanLikeWeek {
  week?: unknown;
  phase?: unknown;
  off?: unknown;
  totalKm?: unknown;
  workouts?: PlanLikeWorkout[];
}

interface PlanLikeValidationSummary {
  initialWeeklyKm?: unknown;
  peakWeekKm?: unknown;
  peakWeeklyKm?: unknown;
  biggestTrainingLongRunKm?: unknown;
  peakTrainingLongRunKm?: unknown;
  peakLongRunKm?: unknown;
  biggestLongRunKm?: unknown;
  raceDistanceKm?: unknown;
  raceWeekIncludesGoal?: unknown;
  recoveryWeeks?: unknown;
  taperWeeks?: unknown;
  raceWeek?: unknown;
  riskLevel?: unknown;
  totalWeeks?: unknown;
}

/** Forma frouxa aceita pelo legado (`plan = {}`, campos duck-typed com fallbacks encadeados). */
interface PlanLike {
  weeks?: PlanLikeWeek[];
  objective?: unknown;
  goal?: unknown;
  totalWeeks?: unknown;
  totalKm?: unknown;
  totalDistanceKm?: unknown;
  targetDistanceKm?: unknown;
  distanceKm?: unknown;
  distance?: unknown;
  peakWeekKm?: unknown;
  longestTrainingRun?: unknown;
  raceName?: unknown;
  planName?: unknown;
  score?: unknown;
  risk?: unknown;
  validation?: {
    quality?: { overall?: unknown };
    summary?: PlanLikeValidationSummary;
  };
  userData?: { customDistance?: unknown };
}

/** app.js:3571-3576 */
function formatKm(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${Math.round(number * 10) / 10} km`;
}

interface PlanReviewSummary {
  initialWeeklyKm: unknown;
  peakWeeklyKm: unknown;
  biggestTrainingLongRunKm: unknown;
  biggestLongRunKm: unknown;
  raceDistanceKm: unknown;
  raceWeekIncludesGoal: boolean;
  recoveryWeeks: unknown;
  taperWeeks: unknown;
  raceWeek: unknown;
}

/** app.js:3578-3603 */
function getPlanReviewSummary(plan: PlanLike): PlanReviewSummary {
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const validationSummary = plan?.validation?.summary || {};
  const raceWeekIndex = weeks.findIndex((week) =>
    (week.workouts || []).some((workout) => String(workout.title || '').toLowerCase().includes('prova alvo')),
  );
  const weekTotals = weeks.map((week) =>
    Number(week.totalKm ?? week.workouts?.reduce((s, w) => s + Number(w.km || 0), 0) ?? 0),
  );
  const trainingWeekTotals = weekTotals.filter((_, index) => index !== raceWeekIndex);
  const longRuns = weeks.map((week) => Number(week.workouts?.[(week.workouts?.length ?? 1) - 1]?.km || 0));
  const trainingLongRuns = longRuns.filter((_, index) => index !== raceWeekIndex);
  const recoveryWeeks = weeks.filter((week) => week.off).map((week) => week.week);
  const taperWeeks = weeks.filter((week) => week.phase === 'Polimento').map((week) => week.week);
  const distanceKm = Number(
    validationSummary.raceDistanceKm || plan?.targetDistanceKm || plan?.distanceKm || plan?.userData?.customDistance || 0,
  );

  return {
    initialWeeklyKm: validationSummary.initialWeeklyKm ?? weekTotals[0] ?? 0,
    peakWeeklyKm: validationSummary.peakWeekKm ?? validationSummary.peakWeeklyKm ?? Math.max(...trainingWeekTotals, 0),
    biggestTrainingLongRunKm:
      validationSummary.biggestTrainingLongRunKm ??
      validationSummary.peakTrainingLongRunKm ??
      validationSummary.peakLongRunKm ??
      validationSummary.biggestLongRunKm ??
      Math.max(...trainingLongRuns, 0),
    biggestLongRunKm:
      validationSummary.biggestTrainingLongRunKm ??
      validationSummary.peakTrainingLongRunKm ??
      validationSummary.peakLongRunKm ??
      validationSummary.biggestLongRunKm ??
      Math.max(...trainingLongRuns, 0),
    raceDistanceKm: distanceKm || Math.max(...longRuns, 0),
    raceWeekIncludesGoal: Boolean(validationSummary.raceWeekIncludesGoal || raceWeekIndex >= 0),
    recoveryWeeks: validationSummary.recoveryWeeks || recoveryWeeks,
    taperWeeks: validationSummary.taperWeeks || taperWeeks,
    raceWeek: validationSummary.raceWeek || weeks[weeks.length - 1]?.week || '-',
  };
}

/** app.js:3612-3618 */
function getRiskLabelText(riskLevel: unknown): string {
  const value = String(riskLevel || '').toLowerCase();
  if (value.includes('muito')) return 'muito alto';
  if (value.includes('alto')) return 'alto';
  if (value.includes('moderado') || value.includes('médio') || value.includes('medio')) return 'médio';
  return 'baixo';
}

/** app.js:5993-5996 */
function formatPlanScore(plan: PlanLike): string {
  const score = Number(plan?.validation?.quality?.overall || plan?.score || 0);
  return score ? score.toFixed(1).replace('.', ',') : '-';
}

/** app.js:5998-6000 */
function getPlanRisk(plan: PlanLike): unknown {
  return plan?.validation?.summary?.riskLevel || plan?.risk || 'baixo';
}

/** app.js:6002-6005 */
function getPlanDistanceLabel(plan: PlanLike): string {
  const km = Number(
    plan?.validation?.summary?.raceDistanceKm || plan?.targetDistanceKm || plan?.distanceKm || plan?.distance || 0,
  );
  return km ? `${Math.round(km * 10) / 10} km` : String(plan?.raceName || '-');
}

interface CompactPlanSummary {
  name: unknown;
  race: unknown;
  weeks: unknown;
  score: string;
  risk: string;
  peak: string;
  long: string;
  distance: string;
}

/** app.js:6007-6019 */
function getCompactPlanSummary(plan: PlanLike): CompactPlanSummary {
  const summary = getPlanReviewSummary(plan || {});
  return {
    name: plan?.planName || plan?.raceName || 'Planilha RunEvo',
    race: plan?.raceName || getPlanDistanceLabel(plan),
    weeks: plan?.totalWeeks || (summary as unknown as { totalWeeks?: unknown }).totalWeeks || '-',
    score: formatPlanScore(plan),
    risk: getRiskLabelText(getPlanRisk(plan)),
    peak: formatKm(summary.peakWeeklyKm || plan?.peakWeekKm || 0),
    long: formatKm(summary.biggestTrainingLongRunKm || plan?.longestTrainingRun || 0),
    distance: getPlanDistanceLabel(plan),
  };
}

export interface ComparableWorkout {
  week: number;
  title: string;
  type: string;
  phase: string;
  day: string;
  km: number;
  pace: string;
  description: string;
}

export interface ComparablePlan {
  objective: string;
  race: string;
  weeks: number;
  workoutsCount: number;
  totalKm: number;
  peakKm: number;
  longKm: number;
  score: number;
  risk: string;
  workouts: ComparableWorkout[];
}

/** app.js:6192-6224 */
function normalizeComparablePlan(plan: PlanLike = {}): ComparablePlan {
  const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];
  const workouts: ComparableWorkout[] = weeks.flatMap((week) => {
    const ws = Array.isArray(week.workouts) ? week.workouts : [];
    return ws.map(
      (w): ComparableWorkout => ({
        week: Number(week.week || w.week || 0),
        title: String(w.title || w.name || '').trim().toLowerCase(),
        type: String(w.type || w.category || '').trim().toLowerCase(),
        phase: String(w.phase || week.phase || '').trim().toLowerCase(),
        day: String(w.day || w.weekday || '').trim().toLowerCase(),
        km: Number(w.km || w.distance || 0),
        pace: String(w.pace || w.plannedPace || '').trim().toLowerCase(),
        description: String(w.description || w.desc || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase(),
      }),
    );
  });

  const quality = plan.validation?.quality || {};
  const summary = getPlanReviewSummary(plan || {});
  const compact = getCompactPlanSummary(plan || {});

  return {
    objective: String(plan.objective || plan.goal || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase(),
    race: String(compact.race || '').toLowerCase(),
    weeks: Number(plan.totalWeeks || compact.weeks || weeks.length || 0),
    workoutsCount: workouts.length,
    totalKm: Number((summary as unknown as { totalKm?: unknown }).totalKm || plan.totalKm || plan.totalDistanceKm || 0),
    peakKm: Number(summary.peakWeeklyKm || plan.peakWeekKm || 0),
    longKm: Number(summary.biggestTrainingLongRunKm || plan.longestTrainingRun || 0),
    score: Number(quality.overall || compact.score || 0),
    risk: String(compact.risk || '').toLowerCase(),
    workouts,
  };
}

/** app.js:6226-6229 (`getRunEvoPlanFingerprint` → `computePlanFingerprint`) */
export function computePlanFingerprint(plan: Plan): string {
  const comparable = normalizeComparablePlan(plan);
  return JSON.stringify(comparable);
}

/** app.js:6231-6234 (`areRunEvoPlansIdentical` → `arePlansIdentical`) */
export function arePlansIdentical(currentPlan: Plan | null | undefined, newPlan: Plan | null | undefined): boolean {
  if (!currentPlan || !newPlan) return false;
  return computePlanFingerprint(currentPlan) === computePlanFingerprint(newPlan);
}
