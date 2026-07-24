import { parseLocalDate } from '@/domain/motor-evo/dates';
import type { Workout } from '@/domain/entities';

export interface PlanProgress {
  completedKm: number;
  plannedKm: number;
  completedWorkouts: number;
  totalWorkouts: number;
  /** `null` quando o plano não tem `race_date`. Pode ser negativo (prova já passou). */
  daysRemaining: number | null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** docs/fase-4-brief.md Grupo 1.2 (`usePlanProgress`) — agregação sobre os treinos do plano ativo. */
export function computePlanProgress(
  workouts: Workout[],
  raceDate: string | null,
  today: Date = new Date(),
): PlanProgress {
  const completedKm = round1(
    workouts.reduce((sum, w) => sum + (w.status === 'completed' ? Number(w.completed_km ?? w.planned_km ?? 0) : 0), 0),
  );
  const plannedKm = round1(workouts.reduce((sum, w) => sum + Number(w.planned_km ?? 0), 0));
  const completedWorkouts = workouts.filter((w) => w.status === 'completed').length;

  let daysRemaining: number | null = null;
  if (raceDate) {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const race = parseLocalDate(raceDate);
    race.setHours(0, 0, 0, 0);
    daysRemaining = Math.round((race.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  }

  return { completedKm, plannedKm, completedWorkouts, totalWorkouts: workouts.length, daysRemaining };
}
