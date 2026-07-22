import { parseLocalDate, addDays, MONDAY_INDEXED_DAYS } from '@/domain/motor-evo/dates';
import type { Plan } from '@/domain/motor-evo/plan-generator';
import type { Week, Workout as MotorWorkout, Phase, DayType } from '@/domain/motor-evo/types';
import type { ValidationReport } from '@/domain/motor-evo/validation';
import type { PlanBlueprint } from '@/domain/motor-evo/blueprint';
import { newUuid } from '@/utils/uuid';
import { nowIso } from '@/utils/time';
import type { TrainingPlan, Workout as WorkoutRow } from '@/domain/entities';

/**
 * Converte entre o shape interno do motor (`Plan`, de `src/domain/motor-evo/`)
 * e as linhas do banco (`training_plans`/`plan_workouts`). O motor produz o
 * shape legado (`week: "S{n}"`, `workout.dayOfWeek/desc/km`); a conversão
 * para colunas do banco acontece só aqui (docs/legacy-audit.md §3.6).
 */

export interface PlanMapperResult {
  plan: TrainingPlan;
  workouts: WorkoutRow[];
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * ai-coach.js:2830-2897 (`convertToWeeksData`) — data real por treino a
 * partir do dia da semana (`dayOfWeek`) + índice da semana. Reusa
 * `parseLocalDate`/`addDays`/`MONDAY_INDEXED_DAYS` de `dates.ts` (motor
 * fechado — não reimplementados); a combinação semana+dia→data é
 * orquestração do mapper, fora do domínio.
 */
function computeWorkoutDates(startDateStr: string, weeks: Week[]): string[][] {
  const startDate = parseLocalDate(startDateStr);
  startDate.setHours(0, 0, 0, 0);

  const startDayOfWeek = startDate.getDay();
  const jsDayToMondayIndexed = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const week1Monday = addDays(startDate, -jsDayToMondayIndexed);

  return weeks.map((week, weekIndex) => {
    const weekStart = addDays(week1Monday, weekIndex * 7);

    return week.workouts.map((workout) => {
      const dayOffset = MONDAY_INDEXED_DAYS.indexOf(workout.dayOfWeek as (typeof MONDAY_INDEXED_DAYS)[number]);
      let workoutDate = addDays(weekStart, dayOffset === -1 ? 0 : dayOffset);

      // Se a primeira semana começa no meio/fim da semana, dias como Segunda/Quarta
      // precisam cair na semana seguinte, não antes da data de início.
      if (weekIndex === 0 && workoutDate < startDate) {
        workoutDate = addDays(workoutDate, 7);
      }

      return toISODate(workoutDate);
    });
  });
}

export function planToRows(plan: Plan, userId: string): PlanMapperResult {
  const planId = newUuid();
  const timestamp = nowIso();
  const workoutDates = computeWorkoutDates(plan.userData.startDate, plan.weeks);

  const trainingPlanRow: TrainingPlan = {
    id: planId,
    user_id: userId,
    plan_name: plan.planName,
    race_name: plan.raceName ?? null,
    race_distance_km: plan.validation?.summary?.raceDistanceKm ?? null,
    start_date: plan.userData.startDate ?? null,
    race_date: plan.raceDate ?? null,
    total_weeks: plan.totalWeeks ?? null,
    days_per_week: plan.daysPerWeek ?? null,
    objective: plan.userData.objective ?? null,
    terrain: plan.userData.terrainType ?? plan.userData.terrain ?? null,
    status: 'draft',
    user_data: plan.userData as unknown as Record<string, unknown>,
    blueprint: plan.blueprint as unknown as Record<string, unknown>,
    validation: (plan.validation ?? {}) as unknown as Record<string, unknown>,
    quality: (plan.validation?.quality ?? {}) as unknown as Record<string, unknown>,
    risk: {
      level: plan.validation?.summary?.riskLevel ?? null,
      points: plan.validation?.summary?.riskPoints ?? null,
      reasons: plan.validation?.summary?.riskReasons ?? [],
    },
    created_at: timestamp,
    updated_at: timestamp,
  };

  const workoutRows: WorkoutRow[] = [];
  plan.weeks.forEach((week, weekIndex) => {
    const weekNumber = Number(week.week.replace(/^S/i, '')) || weekIndex + 1;

    week.workouts.forEach((workout, index) => {
      workoutRows.push({
        id: newUuid(),
        plan_id: planId,
        user_id: userId,
        week_number: weekNumber,
        week_index: index,
        phase: week.phase,
        workout_date: workoutDates[weekIndex]?.[index] ?? null,
        day_label: workout.dayOfWeek,
        day_type: workout.dayType,
        title: workout.title,
        description: workout.desc,
        planned_km: workout.km,
        planned_pace: workout.pace,
        status: 'pending',
        completed_km: null,
        perceived_effort: null,
        feeling: null,
        pain: null,
        feedback: null,
        shoe_id: null,
        completed_at: null,
        updated_at: timestamp,
      });
    });
  });

  return { plan: trainingPlanRow, workouts: workoutRows };
}

/**
 * Reconstrói o shape do motor a partir das linhas do banco. Não é
 * byte-idêntico ao plano original: `zoneTarget` (opcional no motor,
 * ai-coach.js:1965-1972) não é persistido; `week.off` é reconstruído via
 * `validation.summary.recoveryWeeks` (não há coluna própria).
 */
export function rowsToPlan(planRow: TrainingPlan, workoutRows: WorkoutRow[]): Plan {
  const weekNumbers = Array.from(new Set(workoutRows.map((w) => w.week_number))).sort((a, b) => a - b);
  const validation = (planRow.validation ?? {}) as unknown as ValidationReport;
  const recoveryWeeks = new Set(validation?.summary?.recoveryWeeks ?? []);

  const weeks: Week[] = weekNumbers.map((weekNumber) => {
    const rows = workoutRows.filter((w) => w.week_number === weekNumber).sort((a, b) => a.week_index - b.week_index);
    const weekLabel = `S${weekNumber}`;

    return {
      week: weekLabel,
      phase: (rows[0]?.phase as Phase) ?? 'Base',
      off: recoveryWeeks.has(weekLabel),
      workouts: rows.map(
        (w): MotorWorkout => ({
          dayOfWeek: w.day_label ?? '',
          dayType: (w.day_type as DayType) ?? 'Base',
          title: w.title ?? '',
          desc: w.description ?? '',
          km: w.planned_km ?? 0,
          pace: w.planned_pace ?? '-',
        }),
      ),
    };
  });

  return {
    planName: planRow.plan_name,
    totalWeeks: planRow.total_weeks ?? weeks.length,
    raceName: planRow.race_name ?? '',
    raceDistance: planRow.race_name ?? '',
    raceDate: planRow.race_date ?? '',
    daysPerWeek: planRow.days_per_week ?? 3,
    weeks,
    blueprint: planRow.blueprint as unknown as PlanBlueprint,
    motorEvoContext: (planRow.blueprint as unknown as { engineCalibration?: { goalContext?: unknown } })
      ?.engineCalibration?.goalContext as Plan['motorEvoContext'],
    generatedAt: planRow.created_at,
    userData: planRow.user_data as unknown as Plan['userData'],
    validation,
  };
}
