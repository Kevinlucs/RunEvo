import { toLocalISODate } from '@/utils/time';
import type { Workout } from '@/domain/entities';

/**
 * docs/fase-4-brief.md Grupo 1.2 (`useNextWorkout`): primeiro treino `pending`
 * com `workout_date >= hoje`; se não houver, o `pending` mais próximo no
 * passado (treino atrasado); se nenhum `pending`, `null` (plano concluído).
 * Comparação por string ISO (`YYYY-MM-DD`) — ordena igual à ordem cronológica.
 */
export function pickNextWorkout(workouts: Workout[], today: Date = new Date()): Workout | null {
  const todayStr = toLocalISODate(today);
  const pendingWithDate = workouts.filter((w) => w.status === 'pending' && w.workout_date);

  const upcoming = pendingWithDate
    .filter((w) => (w.workout_date as string) >= todayStr)
    .sort((a, b) => (a.workout_date as string).localeCompare(b.workout_date as string));
  if (upcoming.length) return upcoming[0] as Workout;

  const overdue = pendingWithDate
    .filter((w) => (w.workout_date as string) < todayStr)
    .sort((a, b) => (b.workout_date as string).localeCompare(a.workout_date as string));
  return overdue.length ? (overdue[0] as Workout) : null;
}
