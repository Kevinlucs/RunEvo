import { clamp } from './utils/math';
import type { Week, Workout } from './types';

/**
 * Porte 1:1 de `legacy/app.js` — Adaptive Training (regras puras).
 * Mapeamento: docs/legacy-audit.md §13.7 (getLocalAdjustmentRecommendation,
 * normalizeAICheckinRecommendation, applyAdjustmentToStoredPlan,
 * applySkippedWorkoutRedistribution → adaptive-training.ts).
 *
 * ESCOPO — só as regras puras (docs/motor-evo-specification.md §18):
 * - `recommendAdjustment` ← `getLocalAdjustmentRecommendation` (app.js:4721-4761,
 *   +`getAdjustmentTitle` app.js:4763-4772). Nome trocado por instrução do
 *   enunciado ("Recomendação: local (`recommendAdjustment`)").
 * - `normalizeAICheckinRecommendation` ← idem (app.js:4908-4968). Mantido com o
 *   mesmo nome (guardrails aplicados sobre uma sugestão de IA já obtida —
 *   continua puro, não chama IA nenhuma; a chamada em si é
 *   `services/ai/checkin-coach.provider.ts`, fora desta fase).
 * - `redistributeSkipped` ← `applySkippedWorkoutRedistribution` (app.js:4975-5043),
 *   purificada: recebe a semana seguinte e os treinos pulados por parâmetro e
 *   RETORNA a semana atualizada, em vez de ler `AICoach.loadPlan()` e gravar via
 *   `StorageService.savePlan` (persistência é repository, Fase 3).
 * - `applyAdjustment` ← `applyAdjustmentToStoredPlan` (app.js:5129-5173), mesma
 *   purificação (recebe `weeks`, retorna novo array; não persiste).
 *
 * NÃO portado nesta fase (fora do fechamento transitivo autorizado, ou
 * inerentemente stateful/de repositório — não código morto, débito explícito):
 * - `getWeekSummary`/`getCheckinCandidateWeek` (app.js:4417-4457): dependem de
 *   `allWorkouts`, `getWorkoutStatus`, `getWorkoutFeedback`, `isWorkoutResolved`,
 *   `getWorkoutCompletedKm`, `weeklyCheckins` — estado vivo de conclusão de
 *   treino que só existirá com os repositories da Fase 3. A agregação pura de
 *   `getWeekSummary` (somas/médias) está portada como `summarizeWeek` abaixo,
 *   recebendo os treinos já resolvidos como parâmetro (ver a nota na função
 *   sobre os 2 campos inferidos, não verificados linha a linha por falta de
 *   `isWorkoutResolved`/`getWorkoutCompletedKm` no fechamento autorizado).
 * - `runSmartPlanAdjustmentEngine`/`applyAdjustmentToStoredPlan`'s persistência,
 *   `callAICheckinCoach` (chamada de IA): orquestração/serviço, não regra pura.
 */

export type Feeling = 'leve' | 'normal' | 'pesado' | 'muito_pesado';
export type AdjustmentAction = 'maintain' | 'reduce' | 'recovery' | 'slight_increase';
export type AdjustmentSource = 'local' | 'ai';

export interface AdjustmentRecommendation {
  action: AdjustmentAction;
  factor: number;
  weeksToAdjust: number;
  reason: string;
  source: AdjustmentSource;
  confidence: string;
  title: string;
  message: string;
  coachTip?: string;
}

/** app.js:4763-4772 */
function getAdjustmentTitle(action: AdjustmentAction | string): string {
  const titles: Record<string, string> = {
    maintain: 'Plano mantido',
    recovery: 'Semana de recuperação aplicada',
    reduce: 'Plano ajustado',
    slight_increase: 'Carga levemente ampliada',
  };
  return titles[action] || 'Plano ajustado';
}

export interface CheckinFeedbackInput {
  pain?: boolean;
  effort?: number;
  feeling?: Feeling;
}

export interface CheckinSummaryInput {
  skipped: number;
  completionRate: number;
}

/**
 * app.js:4721-4761 (`getLocalAdjustmentRecommendation`). Renomeada para
 * `recommendAdjustment` por instrução do enunciado (spec §18: "Recomendação:
 * local (`recommendAdjustment`)").
 */
export function recommendAdjustment(feedback: CheckinFeedbackInput, summary: CheckinSummaryInput): AdjustmentRecommendation {
  let factor = 1;
  let action: AdjustmentAction = 'maintain';
  let weeksToAdjust = 1;
  let reason = 'Semana dentro do esperado. O plano foi mantido.';

  if (feedback.pain) {
    factor = 0.75;
    action = 'recovery';
    weeksToAdjust = 1;
    reason = 'Dor/incômodo reportado. Próxima semana reduzida e tratada como recuperação.';
  } else if (summary.skipped > 0 && summary.completionRate >= 0.6) {
    factor = 1;
    action = 'maintain';
    reason =
      'Houve treino pulado. O RunEvo irá redistribuir uma parte segura da carga para a próxima semana, sem compensação agressiva.';
  } else if (summary.completionRate < 0.6) {
    factor = 0.85;
    action = 'reduce';
    reason = 'Baixa aderência na semana. Próxima semana reduzida em 15%.';
  } else if ((feedback.effort ?? 0) >= 9 || feedback.feeling === 'muito_pesado') {
    factor = 0.9;
    action = 'reduce';
    reason = 'Esforço alto. Próxima semana reduzida em 10%.';
  } else if (summary.completionRate >= 1 && (feedback.effort ?? 0) <= 5 && feedback.feeling === 'leve') {
    factor = 1;
    action = 'maintain';
    reason = 'Semana leve e completa. O plano foi mantido porque a progressão já está prevista nas próximas semanas.';
  }

  return {
    action,
    factor,
    weeksToAdjust,
    reason,
    source: 'local',
    confidence: 'local-rule',
    title: getAdjustmentTitle(action),
    message: reason,
  };
}

export interface AISuggestion {
  action?: string;
  adjustmentPercent?: number;
  weeksToAdjust?: number;
  confidence?: string;
  reason?: string;
  messageToUser?: string;
  coachTip?: string;
}

export interface NormalizeAICheckinFeedbackInput {
  pain?: boolean;
  effort?: number;
  feeling?: Feeling;
  summary?: { averageEffort?: number; completionRate?: number };
}

/**
 * app.js:4908-4968. Guardrails de segurança aplicados sobre uma sugestão de IA
 * já obtida (spec §18) — continua pura: não chama IA, só reconcilia.
 */
export function normalizeAICheckinRecommendation(
  ai: AISuggestion | null | undefined,
  feedback: NormalizeAICheckinFeedbackInput,
  localRecommendation: AdjustmentRecommendation,
): AdjustmentRecommendation {
  const allowedActions: AdjustmentAction[] = ['maintain', 'reduce', 'recovery', 'slight_increase'];
  let action: AdjustmentAction = allowedActions.includes(ai?.action as AdjustmentAction)
    ? (ai?.action as AdjustmentAction)
    : localRecommendation.action;
  const effort = Number(feedback.effort || feedback.summary?.averageEffort || 0);
  const completionRate = Number(feedback.summary?.completionRate || 0);

  const isPerfectLightWeek = !feedback.pain && completionRate >= 1 && effort <= 5 && feedback.feeling === 'leve';

  // Guardrails: a IA pode sugerir, mas não passa por cima das regras de segurança.
  if (feedback.pain && action === 'slight_increase') action = 'recovery';
  if ((effort >= 9 || completionRate < 0.6) && action === 'slight_increase') {
    action = localRecommendation.action === 'maintain' ? 'reduce' : localRecommendation.action;
  }

  // Semana perfeita e leve não deve gerar redução automática só porque a semana seguinte já é maior.
  // Nesse caso, mantemos o plano e deixamos a progressão original trabalhar.
  if (isPerfectLightWeek && (action === 'reduce' || action === 'recovery')) {
    action = 'maintain';
  }

  let percent = Math.abs(Number(ai?.adjustmentPercent || 0));
  let factor = 1;

  if (action === 'recovery') {
    percent = percent || 20;
    factor = 1 - clamp(percent, 15, 30) / 100;
  } else if (action === 'reduce') {
    percent = percent || 10;
    factor = 1 - clamp(percent, 5, 20) / 100;
  } else if (action === 'slight_increase') {
    percent = percent || 3;
    factor = 1 + clamp(percent, 1, 3) / 100;
  } else {
    percent = 0;
    factor = 1;
  }

  const weeksToAdjust = clamp(Number(ai?.weeksToAdjust || localRecommendation.weeksToAdjust || 1), 1, 2);
  const reason =
    action === 'maintain'
      ? 'Semana concluída com segurança. O plano foi mantido sem redução de carga.'
      : ai?.reason || localRecommendation.reason;
  const coachTip = ai?.coachTip || '';
  const messageToUser =
    action === 'maintain'
      ? 'Boa semana. Vamos manter a progressão planejada sem cortes desnecessários.'
      : ai?.messageToUser || reason;
  const message = coachTip ? `${messageToUser} Dica: ${coachTip}` : messageToUser;

  return {
    action,
    factor,
    weeksToAdjust,
    reason,
    coachTip,
    confidence: ai?.confidence || 'média',
    source: 'ai',
    title: getAdjustmentTitle(action),
    message,
  };
}

/** app.js:4971-4973 */
function roundHalf(value: number): number {
  return Math.round(Number(value || 0) * 2) / 2;
}

export interface RedistributionResult {
  applied: boolean;
  addedKm: number;
  targetWeek: string | null;
  skippedKm?: number;
  /** Semana seguinte com os treinos redistribuídos (só presente se `applied`). */
  week?: Week;
  totalKm?: number;
  note?: string;
}

/**
 * app.js:4975-5043 (`applySkippedWorkoutRedistribution` → `redistributeSkipped`),
 * purificada: recebe a semana seguinte por parâmetro e retorna a versão
 * atualizada, em vez de ler/gravar em `AICoach.loadPlan()`/`StorageService`.
 */
export function redistributeSkipped(
  nextWeek: Week | null | undefined,
  isNextWeekTheRaceWeek: boolean,
  checkinWeekLabel: string,
  skippedWorkoutsKm: number[],
  effortInput: number | undefined,
  averageEffort: number,
  pain: boolean | undefined,
): RedistributionResult {
  const skippedKm = skippedWorkoutsKm.reduce((sum, km) => sum + Number(km || 0), 0);

  if (!skippedWorkoutsKm.length || skippedKm <= 0) {
    return { applied: false, addedKm: 0, targetWeek: null };
  }

  if (!nextWeek || !Array.isArray(nextWeek.workouts) || !nextWeek.workouts.length) {
    return { applied: false, addedKm: 0, targetWeek: null };
  }

  const effort = Number(effortInput || averageEffort || 6);
  const ratio = pain ? 0 : effort <= 5 ? 0.5 : effort <= 7 ? 0.4 : 0.3;
  const nextTotal = nextWeek.workouts.reduce((sum, w) => sum + Number(w.km || 0), 0);

  const targetAdd = roundHalf(Math.min(skippedKm * ratio, Math.max(1, nextTotal * 0.12)));
  if (targetAdd <= 0) return { applied: false, addedKm: 0, targetWeek: null };

  const editable = nextWeek.workouts
    .map((workout, index) => ({ workout, index }))
    .filter((item) => {
      const isRace = isNextWeekTheRaceWeek && item.index === (nextWeek.workouts?.length ?? 0) - 1;
      return !isRace && Number(item.workout.km || 0) > 0;
    });

  if (!editable.length) return { applied: false, addedKm: 0, targetWeek: null };

  const priority = editable.filter((item) => ['Base', 'Longão', 'Qualidade'].includes(item.workout.dayType));
  const targets = priority.length ? priority : editable;
  const perWorkout = roundHalf(targetAdd / targets.length);
  let distributed = 0;

  const updatedWorkouts: Workout[] = nextWeek.workouts.map((w) => ({ ...w }));

  targets.forEach((item, idx) => {
    const remaining = roundHalf(targetAdd - distributed);
    if (remaining <= 0) return;

    const add = idx === targets.length - 1 ? remaining : Math.min(perWorkout, remaining);
    const currentKm = Number(item.workout.km || 0);
    const updated = updatedWorkouts[item.index] as Workout;
    updated.km = roundHalf(currentKm + add);
    updated.redistributedFromSkipped = true;
    updated.redistributedKm = roundHalf(Number(updated.redistributedKm || 0) + add);
    distributed = roundHalf(distributed + add);
  });

  if (distributed <= 0) return { applied: false, addedKm: 0, targetWeek: null };

  const totalKm = roundHalf(updatedWorkouts.reduce((sum, w) => sum + Number(w.km || 0), 0));

  return {
    applied: true,
    addedKm: distributed,
    targetWeek: nextWeek.week,
    skippedKm: roundHalf(skippedKm),
    week: { ...nextWeek, workouts: updatedWorkouts },
    totalKm,
    note: `${distributed} km redistribuídos após treino(s) pulado(s) na semana ${checkinWeekLabel}.`,
  };
}

export interface ApplyAdjustmentResult {
  applied: boolean;
  weeks: Week[];
}

/**
 * app.js:5129-5173 (`applyAdjustmentToStoredPlan` → `applyAdjustment`),
 * purificada: recebe `weeks` por parâmetro e retorna um novo array, em vez de
 * ler/gravar em `AICoach.loadPlan()`/`StorageService`. Só ajusta semanas
 * futuras (`weekIndex+1` .. `weekIndex+weeksToAdjust`); nunca altera a semana
 * da prova (último treino da última semana).
 */
export function applyAdjustment(
  weeks: Week[],
  weekIndex: number,
  factor: number,
  action: AdjustmentAction,
  weeksToAdjust: number,
): ApplyAdjustmentResult {
  if (factor === 1 && action === 'maintain') return { applied: false, weeks };

  const start = weekIndex + 1;
  const end = Math.min(weeks.length - 1, start + weeksToAdjust - 1);
  if (start > end) return { applied: false, weeks };

  const updatedWeeks = weeks.map((week, i) => {
    if (i < start || i > end || !week || !Array.isArray(week.workouts)) return week;

    const updatedWorkouts = week.workouts.map((workout, workoutIndex) => {
      const isRace = i === weeks.length - 1 && workoutIndex === week.workouts.length - 1;
      if (isRace) return workout;

      const originalKm = Number(workout.km || 0);
      const nextKm = Math.max(1, Math.round(originalKm * factor));
      const suffix = action === 'recovery' ? 'Carga reduzida após check-in.' : 'Ajustado após check-in semanal.';

      return {
        ...workout,
        km: nextKm,
        desc: `${workout.desc || 'Treino do plano.'} ${suffix}`.slice(0, 140),
      };
    });

    return {
      ...week,
      workouts: updatedWorkouts,
      off: action === 'recovery' ? true : week.off,
      phase: action === 'recovery' ? (week.phase === 'Polimento' ? week.phase : 'Base') : week.phase,
    } as Week;
  });

  return { applied: true, weeks: updatedWeeks };
}

export interface WorkoutResolution {
  km: number;
  status: 'completed' | 'skipped' | 'pending';
  /**
   * Km efetivamente concluído — equivalente a `getWorkoutCompletedKm(w)` no
   * legado (app.js, fora do fechamento autorizado; assumido = `km` quando
   * completo, ajustável pelo chamador quando o dado real existir).
   */
  completedKm?: number;
  /** `getWorkoutFeedback(w.id)?.effort` no legado. */
  effort?: number;
}

export interface WeekSummary {
  plannedKm: number;
  completedKm: number;
  completed: number;
  /** Sempre 0 no legado (app.js:4422) — campo mantido só por compatibilidade de forma. */
  partial: number;
  skipped: number;
  resolved: number;
  total: number;
  averageEffort: number;
  completionRate: number;
  resolvedRate: number;
}

/**
 * app.js:4417-4443 (`getWeekSummary`), só a agregação pura — não filtra por
 * `weekIndex` num array global (`allWorkouts`), recebe os treinos já
 * resolvidos por parâmetro (fonte real vem de repositories na Fase 3).
 *
 * ACHADO/INFERÊNCIA (não verificada linha a linha — `isWorkoutResolved` e
 * `getWorkoutCompletedKm` não estão no fechamento transitivo autorizado desta
 * extração): `resolved` é inferido como `completed + skipped` (treinos
 * `pending` não contam), consistente com `partial` ser sempre 0 no legado e
 * com a definição de "resolvido" da spec §18 ("concluído | parcial | pulado",
 * mas parcial nunca é de fato usado no código). Sinalizar se
 * `isWorkoutResolved` tiver uma regra diferente.
 */
export function summarizeWeek(resolutions: WorkoutResolution[]): WeekSummary {
  const plannedKm = resolutions.reduce((sum, w) => sum + Number(w.km || 0), 0);
  const completedKm = resolutions.reduce(
    (sum, w) => sum + (w.status === 'completed' ? Number(w.completedKm ?? w.km ?? 0) : 0),
    0,
  );
  const completed = resolutions.filter((w) => w.status === 'completed').length;
  const partial = 0;
  const skipped = resolutions.filter((w) => w.status === 'skipped').length;
  const resolved = resolutions.filter((w) => w.status === 'completed' || w.status === 'skipped').length;
  const efforts = resolutions
    .filter((w) => w.status === 'completed')
    .map((w) => Number(w.effort || 0))
    .filter(Boolean);
  const averageEffort = efforts.length ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10 : 0;

  return {
    plannedKm,
    completedKm: Math.round(completedKm * 10) / 10,
    completed,
    partial,
    skipped,
    resolved,
    total: resolutions.length,
    averageEffort,
    completionRate: resolutions.length ? completed / resolutions.length : 0,
    resolvedRate: resolutions.length ? resolved / resolutions.length : 0,
  };
}
