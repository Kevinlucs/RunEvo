import { useActivePlan } from './useActivePlan';
import { usePlanWorkouts } from './usePlanWorkouts';
import { summarizeWorkoutsForWeek } from '@/services/plan/week-summary.service';
import type { WeekSummary } from '@/domain/motor-evo/adaptive-training';

/** Aplica `summarizeWeek` (domínio) sobre os treinos de uma semana do plano ativo. */
export function useWeekSummary(weekNumber: number | null): { summary: WeekSummary | null; isLoading: boolean } {
  const { plan, isLoading: planLoading } = useActivePlan();
  const { workouts, isLoading: workoutsLoading } = usePlanWorkouts(plan?.id);

  if (weekNumber === null) return { summary: null, isLoading: planLoading };
  return { summary: summarizeWorkoutsForWeek(workouts, weekNumber), isLoading: planLoading || workoutsLoading };
}
