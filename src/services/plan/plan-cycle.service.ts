import type { ValidationReport } from '@/domain/motor-evo/validation';
import type { TrainingPlan, Workout } from '@/domain/entities';

export interface WeekMeta {
  weekNumber: number;
  label: string;
  phase: string;
  isRecovery: boolean;
  isTaper: boolean;
  isRace: boolean;
  isCurrent: boolean;
  totalKm: number;
  workoutCount: number;
}

/**
 * Lê `validation.summary` do plano. `TrainingPlanRepository` já desserializa
 * `validation` (jsonColumns do BaseRepository) — aqui só o cast de tipo.
 */
function readValidationSummary(plan: TrainingPlan): ValidationReport['summary'] | undefined {
  return (plan.validation as unknown as ValidationReport | undefined)?.summary;
}

/**
 * docs/fase-4-brief.md Grupo 3 (§29) — agrega os treinos por semana e marca
 * recuperação/taper/prova (validation.summary.recoveryWeeks/taperWeeks/raceWeek,
 * gravados pelo motor em app.js §693-712 — rótulos "S{n}") e a semana corrente.
 */
export function buildWeekMeta(
  plan: TrainingPlan,
  workouts: Workout[],
  currentWeekNumber: number | null,
): WeekMeta[] {
  const summary = readValidationSummary(plan);
  const recoveryWeeks = new Set(summary?.recoveryWeeks ?? []);
  const taperWeeks = new Set(summary?.taperWeeks ?? []);
  const raceWeek = summary?.raceWeek;

  // Garante que todas as semanas do plano apareçam, mesmo sem treinos (para edição Plus)
  const maxWeeks = plan.total_weeks ?? 0;
  const existingWeeks = new Set(workouts.map((w) => w.week_number));
  const allWeekNumbers: number[] = [];

  // Adiciona semanas de 1 até total_weeks
  for (let i = 1; i <= maxWeeks; i++) {
    allWeekNumbers.push(i);
  }

  // Adiciona qualquer semana extra que tenha treino mas esteja fora do range (segurança)
  existingWeeks.forEach(w => {
    if (!allWeekNumbers.includes(w)) allWeekNumbers.push(w);
  });

  const weekNumbers = allWeekNumbers.sort((a, b) => a - b);

  return weekNumbers.map((weekNumber) => {
    const weekWorkouts = workouts.filter((w) => w.week_number === weekNumber);
    const label = `S${weekNumber}`;
    return {
      weekNumber,
      label,
      phase: weekWorkouts[0]?.phase ?? 'Base',
      isRecovery: recoveryWeeks.has(label),
      isTaper: taperWeeks.has(label),
      isRace: raceWeek === label,
      isCurrent: weekNumber === currentWeekNumber,
      totalKm: Math.round(weekWorkouts.reduce((sum, w) => sum + Number(w.planned_km ?? 0), 0) * 10) / 10,
      workoutCount: weekWorkouts.length,
    };
  });
}

export interface PhaseGroup {
  phase: string;
  weeks: WeekMeta[];
}

/** Agrupa as semanas em blocos consecutivos da mesma fase, preservando a ordem do ciclo. */
export function groupWeeksByPhase(weeks: WeekMeta[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const week of weeks) {
    const last = groups[groups.length - 1];
    if (last && last.phase === week.phase) {
      last.weeks.push(week);
    } else {
      groups.push({ phase: week.phase, weeks: [week] });
    }
  }
  return groups;
}
