import type { TrainingPlan, Workout } from '@/domain/entities';
import type { ValidationReport } from '@/domain/motor-evo/validation';
import type { QualityScore } from '@/domain/motor-evo/quality-score';
import type { PlanBlueprint } from '@/domain/motor-evo/blueprint';
import type { LocalPaceZones } from '@/domain/motor-evo/zones';
import { isRaceWorkout } from '@/services/workout/workout-detail.service';

/**
 * docs/fase-7-5-brief.md Grupo 1 — resumo de um ciclo (plano arquivado ou
 * ativo) para histórico/comparação/evolução. Função pura: só extrai valores
 * já salvos em `blueprint`/`validation.summary`/`quality`/`plan_workouts` —
 * nunca recalcula treino nem inventa métrica (motor `src/domain/motor-evo/`
 * fechado nesta fase).
 */
export interface CycleAdherence {
  completedWorkouts: number;
  totalWorkouts: number;
  /** 0..1, ou null se o plano não tem workouts. */
  completionRate: number | null;
  plannedKm: number;
  completedKm: number;
  /** 0..1, ou null se plannedKm for 0. */
  kmRate: number | null;
}

export interface CycleSummary {
  planId: string;
  raceName: string | null;
  raceDistanceKm: number | null;
  raceDate: string | null;
  totalWeeks: number | null;
  daysPerWeek: number | null;
  /** validation.summary.peakWeeklyKm/peakWeekKm — alias, mesmo valor. */
  peakWeeklyKm: number | null;
  /** validation.summary.biggestTrainingLongRunKm e aliases (fingerprint.ts:135-139). */
  longestRunKm: number | null;
  qualityScore: number | null;
  qualityStatus: string | null;
  riskLevel: string | null;
  riskPoints: number | null;
  riskReasons: string[];
  /** blueprint.paceZones.goalContext.goalPace, em segundos. */
  goalPaceSeconds: number | null;
  paceZones: LocalPaceZones | null;
  adherence: CycleAdherence;
  /** null se o plano não tiver o treino "Prova alvo" salvo. */
  raceCompleted: boolean | null;
}

export function buildCycleSummary(plan: TrainingPlan, workouts: Workout[]): CycleSummary {
  const validation = (plan.validation ?? {}) as unknown as ValidationReport;
  const summary = validation.summary ?? {};
  const quality = (plan.quality ?? {}) as unknown as Partial<QualityScore>;
  const risk = (plan.risk ?? {}) as { level?: string | null; points?: number | null; reasons?: string[] };
  const blueprint = (plan.blueprint ?? {}) as unknown as Partial<PlanBlueprint>;

  const peakWeeklyKm = summary.peakWeeklyKm ?? summary.peakWeekKm ?? null;
  const longestRunKm =
    summary.biggestTrainingLongRunKm ??
    summary.peakTrainingLongRunKm ??
    summary.peakLongRunKm ??
    summary.biggestLongRunKm ??
    null;

  const totalWorkouts = workouts.length;
  const completedWorkouts = workouts.filter((w) => w.status === 'completed').length;
  const plannedKm = workouts.reduce((sum, w) => sum + (w.planned_km ?? 0), 0);
  const completedKm = workouts.reduce((sum, w) => sum + (w.completed_km ?? 0), 0);
  const raceWorkout = workouts.find(isRaceWorkout);

  return {
    planId: plan.id,
    raceName: plan.race_name ?? null,
    raceDistanceKm: plan.race_distance_km ?? null,
    raceDate: plan.race_date ?? null,
    totalWeeks: plan.total_weeks ?? null,
    daysPerWeek: plan.days_per_week ?? null,
    peakWeeklyKm,
    longestRunKm,
    qualityScore: quality.overall ?? null,
    qualityStatus: quality.status ?? null,
    riskLevel: risk.level ?? null,
    riskPoints: risk.points ?? null,
    riskReasons: risk.reasons ?? [],
    goalPaceSeconds: blueprint.paceZones?.goalContext?.goalPace ?? null,
    paceZones: blueprint.paceZones ?? null,
    adherence: {
      completedWorkouts,
      totalWorkouts,
      completionRate: totalWorkouts > 0 ? completedWorkouts / totalWorkouts : null,
      plannedKm,
      completedKm,
      kmRate: plannedKm > 0 ? completedKm / plannedKm : null,
    },
    raceCompleted: raceWorkout ? raceWorkout.status === 'completed' : null,
  };
}
