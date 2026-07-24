import { useActivePlan } from './useActivePlan';
import { usePlanWorkouts } from './usePlanWorkouts';
import { pickNextWorkout } from '@/services/plan/next-workout.service';
import type { Workout } from '@/domain/entities';

/**
 * Próximo treino a executar (docs/fase-4-brief.md Grupo 1.2): primeiro
 * `pending` com data futura; senão o atrasado mais recente; senão `null`
 * (plano concluído, ou nenhum plano ativo).
 */
export function useNextWorkout(): { workout: Workout | null; isLoading: boolean } {
  const { plan, isLoading: planLoading } = useActivePlan();
  const { workouts, isLoading: workoutsLoading } = usePlanWorkouts(plan?.id);

  if (!plan) return { workout: null, isLoading: planLoading };
  return { workout: pickNextWorkout(workouts), isLoading: planLoading || workoutsLoading };
}
