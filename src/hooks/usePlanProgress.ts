import { useActivePlan } from './useActivePlan';
import { usePlanWorkouts } from './usePlanWorkouts';
import { computePlanProgress, type PlanProgress } from '@/services/plan/plan-progress.service';

/** Km feito/planejado, treinos concluídos e dias restantes até a prova do plano ativo. */
export function usePlanProgress(): { progress: PlanProgress | null; isLoading: boolean } {
  const { plan, isLoading: planLoading } = useActivePlan();
  const { workouts, isLoading: workoutsLoading } = usePlanWorkouts(plan?.id);

  if (!plan) return { progress: null, isLoading: planLoading };
  return {
    progress: computePlanProgress(workouts, plan.race_date),
    isLoading: planLoading || workoutsLoading,
  };
}
