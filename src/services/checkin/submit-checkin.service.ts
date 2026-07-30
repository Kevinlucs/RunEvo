import { workoutRepository, checkinRepository, trainingPlanRepository } from '@/repositories';
import { queryClient } from '@/store/query-client';
import { err, ok, toAppError, type Result } from '@/utils/result';
import type { Workout as WorkoutRow, Checkin, TrainingPlan } from '@/domain/entities';
import type { Week, Workout as MotorWorkout } from '@/domain/motor-evo/types';
import {
  recommendAdjustment,
  normalizeAICheckinRecommendation,
  redistributeSkipped,
  applyAdjustment,
  type AdjustmentRecommendation,
  type Feeling,
  type RedistributionResult,
} from '@/domain/motor-evo/adaptive-training';
import { summarizeWorkoutsForWeek } from '@/services/plan/week-summary.service';
import { remoteCheckinCoachProvider, type CheckinCoachProvider } from '@/services/ai/checkin-coach.provider';

/**
 * docs/fase-5-brief.md Grupo 2.2/§21. Semanas de ciclo de peso (§21): a cada
 * 4 semanas o peso é obrigatório no formulário de check-in. `weekNumber` é
 * 1-based (S1, S2, ...) — corresponde a `(weekIndex+1) % 4 === 0` do brief
 * com `weekIndex` 0-based, i.e. `weekNumber % 4 === 0`.
 */
export function isWeightRequiredForWeek(weekNumber: number): boolean {
  return weekNumber % 4 === 0;
}

export interface SubmitCheckinFeedback {
  effort: number;
  feeling: Feeling;
  pain: boolean;
  notes?: string | null;
  currentWeightKg?: number | null;
}

export interface SubmitCheckinInput {
  planId: string;
  userId: string;
  weekNumber: number;
  feedback: SubmitCheckinFeedback;
}

export interface SubmitCheckinResult {
  checkin: Checkin;
  recommendation: AdjustmentRecommendation;
  redistribution: RedistributionResult;
}

/** Agrupa as linhas do banco em `Week[]` (shape do domínio) — inverso pontual de `planToRows`, só o necessário para `redistributeSkipped`/`applyAdjustment` (Grupo 4 já tem `rowsToPlan` para o plano inteiro; aqui reaproveitamos a mesma ideia sem puxar o mapper inteiro). */
function workoutRowsToWeeks(rows: WorkoutRow[]): Week[] {
  const weekNumbers = Array.from(new Set(rows.map((r) => r.week_number))).sort((a, b) => a - b);
  return weekNumbers.map((weekNumber) => {
    const weekRows = rows.filter((r) => r.week_number === weekNumber).sort((a, b) => a.week_index - b.week_index);
    return {
      week: `S${weekNumber}`,
      phase: (weekRows[0]?.phase as Week['phase']) ?? 'Base',
      off: false,
      workouts: weekRows.map(
        (r): MotorWorkout => ({
          dayOfWeek: r.day_label ?? '',
          dayType: (r.day_type as MotorWorkout['dayType']) ?? 'Base',
          title: r.title ?? '',
          desc: r.description ?? '',
          km: r.planned_km ?? 0,
          pace: r.planned_pace ?? '-',
        }),
      ),
    };
  });
}

function buildPlanContext(plan: TrainingPlan, weekNumber: number, phase: string) {
  return {
    raceType: plan.race_name || plan.objective || 'corrida',
    phase,
    weeksToRace: Math.max(0, (plan.total_weeks ?? weekNumber) - weekNumber),
  };
}

/** Persiste as linhas de `plan_workouts` cujo km/descrição mudaram entre `before` e `after` para uma semana. */
async function persistWeekChanges(originalRows: WorkoutRow[], week: Week): Promise<Result<void>> {
  const weekRows = originalRows
    .filter((r) => r.week_number === Number(week.week.replace(/^S/i, '')))
    .sort((a, b) => a.week_index - b.week_index);

  for (let i = 0; i < weekRows.length; i++) {
    const row = weekRows[i];
    const workout = week.workouts[i];
    if (!row || !workout) continue;
    if (row.planned_km === workout.km && row.description === workout.desc) continue;

    const res = await workoutRepository.upsert({ id: row.id, planned_km: workout.km, description: workout.desc });
    if (!res.ok) return err(res.error);
  }
  return ok(undefined);
}

/**
 * docs/fase-5-brief.md Grupo 2.3. Orquestra o check-in semanal: recomendação
 * local sempre como base; IA tentada, qualquer falha cai na local (o atleta
 * nunca fica sem check-in); guardrails §18 (`normalizeAICheckinRecommendation`)
 * só entram quando a IA respondeu — por isso `source` já sai certo de cada
 * caminho (local → 'local', normalizado → 'ai', ver adaptive-training.ts).
 */
export async function submitCheckin(
  input: SubmitCheckinInput,
  aiProvider: CheckinCoachProvider = remoteCheckinCoachProvider,
): Promise<Result<SubmitCheckinResult>> {
  try {
    const planRes = await trainingPlanRepository.findById(input.planId);
    if (!planRes.ok) return err(planRes.error);
    if (!planRes.value) return err(toAppError(new Error('Plano não encontrado.'), 'not_found'));
    const plan = planRes.value;

    const workoutsRes = await workoutRepository.listByPlan(input.planId);
    if (!workoutsRes.ok) return err(workoutsRes.error);
    const workouts = workoutsRes.value;

    const summary = summarizeWorkoutsForWeek(workouts, input.weekNumber);
    const weekRows = workouts
      .filter((w) => w.week_number === input.weekNumber)
      .sort((a, b) => a.week_index - b.week_index);
    const phase = weekRows[0]?.phase ?? 'Base';

    const local = recommendAdjustment(
      { pain: input.feedback.pain, effort: input.feedback.effort, feeling: input.feedback.feeling },
      { skipped: summary.skipped, completionRate: summary.completionRate },
    );

    let recommendation = local;
    try {
      const aiSuggestion = await aiProvider.suggest({
        weekNumber: input.weekNumber,
        summary: {
          total: summary.total,
          resolved: summary.resolved,
          completedKm: summary.completedKm,
          plannedKm: summary.plannedKm,
          averageEffort: summary.averageEffort,
          completionRate: summary.completionRate,
        },
        feedback: {
          effort: input.feedback.effort,
          feeling: input.feedback.feeling,
          pain: input.feedback.pain,
          notes: input.feedback.notes ?? '',
        },
        planContext: buildPlanContext(plan, input.weekNumber, phase),
      });
      recommendation = normalizeAICheckinRecommendation(
        aiSuggestion,
        {
          pain: input.feedback.pain,
          effort: input.feedback.effort,
          feeling: input.feedback.feeling,
          summary: { averageEffort: summary.averageEffort, completionRate: summary.completionRate },
        },
        local,
      );
    } catch (aiError) {
      console.warn('checkin-coach indisponível — usando recomendação local.', aiError);
      recommendation = local;
    }

    const weeks = workoutRowsToWeeks(workouts);
    const weekIndex = weeks.findIndex((w) => w.week === `S${input.weekNumber}`);

    const skippedWorkoutsKm = weekRows.filter((r) => r.status === 'skipped').map((r) => r.planned_km ?? 0);
    const nextWeek = weekIndex >= 0 ? weeks[weekIndex + 1] : undefined;
    const isNextWeekTheRaceWeek = weekIndex + 2 === weeks.length;

    const redistribution = redistributeSkipped(
      nextWeek,
      isNextWeekTheRaceWeek,
      `S${input.weekNumber}`,
      skippedWorkoutsKm,
      input.feedback.effort,
      summary.averageEffort,
      input.feedback.pain,
    );

    let updatedWeeks = weeks;
    if (redistribution.applied && redistribution.week && weekIndex >= 0) {
      updatedWeeks = weeks.map((w, i) => (i === weekIndex + 1 ? (redistribution.week as Week) : w));
    }

    if (weekIndex >= 0) {
      const applyResult = applyAdjustment(
        updatedWeeks,
        weekIndex,
        recommendation.factor,
        recommendation.action,
        recommendation.weeksToAdjust,
      );
      updatedWeeks = applyResult.weeks;
    }

    const start = weekIndex + 1;
    const end = Math.min(updatedWeeks.length - 1, start + recommendation.weeksToAdjust - 1);
    for (let i = start; i <= end && i < updatedWeeks.length; i++) {
      const week = updatedWeeks[i];
      if (!week) continue;
      const persistRes = await persistWeekChanges(workouts, week);
      if (!persistRes.ok) return err(persistRes.error);
    }

    const checkinRes = await checkinRepository.upsert({
      plan_id: input.planId,
      user_id: input.userId,
      week_number: input.weekNumber,
      current_weight_kg: input.feedback.currentWeightKg ?? null,
      fatigue_level: input.feedback.effort,
      // Schema legado guarda severidade 0-10; o formulário do brief só coleta
      // sim/não (§21) — decisão desta fase: sem dor = 0, com dor = 10 (extremo
      // da escala), já que não há granularidade fina coletada na UI.
      pain_level: input.feedback.pain ? 10 : 0,
      feeling: input.feedback.feeling,
      notes: input.feedback.notes ?? null,
      ai_analysis: { source: recommendation.source, confidence: recommendation.confidence },
      adjustment: {
        action: recommendation.action,
        factor: recommendation.factor,
        weeksToAdjust: recommendation.weeksToAdjust,
        reason: recommendation.reason,
        message: recommendation.message,
        redistribution,
      },
    });
    if (!checkinRes.ok) return err(checkinRes.error);

    await queryClient.invalidateQueries();

    return ok({ checkin: checkinRes.value, recommendation, redistribution });
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}
