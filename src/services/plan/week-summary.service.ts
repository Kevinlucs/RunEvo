import { summarizeWeek, type WeekSummary, type WorkoutResolution } from '@/domain/motor-evo/adaptive-training';
import type { Workout } from '@/domain/entities';

/** Ponte DB → domínio: adapta as colunas de `plan_workouts` para o shape puro que `summarizeWeek` espera. */
export function toWorkoutResolution(workout: Workout): WorkoutResolution {
  return {
    km: workout.planned_km ?? 0,
    status: workout.status,
    completedKm: workout.completed_km ?? undefined,
    effort: workout.perceived_effort ?? undefined,
  };
}

/** Filtra os treinos da semana (`week_number`) e aplica `summarizeWeek` (domínio puro). */
export function summarizeWorkoutsForWeek(workouts: Workout[], weekNumber: number): WeekSummary {
  const weekWorkouts = workouts.filter((w) => w.week_number === weekNumber);
  return summarizeWeek(weekWorkouts.map(toWorkoutResolution));
}
