import { useActivePlan } from './useActivePlan';
import { computeCurrentWeekNumber } from '@/services/plan/current-week.service';

/** `week_number` (1-based) correspondente a hoje, dado o `start_date` do plano ativo. */
export function useCurrentWeek(): { weekNumber: number | null; isLoading: boolean } {
  const { plan, isLoading } = useActivePlan();
  if (!plan?.start_date) return { weekNumber: null, isLoading };
  return { weekNumber: computeCurrentWeekNumber(plan.start_date), isLoading };
}
