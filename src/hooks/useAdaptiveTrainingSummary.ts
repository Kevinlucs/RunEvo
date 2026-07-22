import { useQuery } from '@tanstack/react-query';
import { useActivePlan } from './useActivePlan';
import { usePlanWorkouts } from './usePlanWorkouts';
import { useCurrentWeek } from './useCurrentWeek';
import { checkinRepository } from '@/repositories';
import { summarizeWorkoutsForWeek } from '@/services/plan/week-summary.service';
import { getCheckinCandidateWeek, type CheckinCandidate, type WeekSummary } from '@/domain/motor-evo/adaptive-training';

export interface AdaptiveTrainingSummary {
  weekNumber: number | null;
  summary: WeekSummary | null;
  isLoading: boolean;
}

/**
 * Bloco "Adaptive Training" da Home (docs/fase-4-brief.md Grupo 2.2, só
 * leitura nesta fase): resolve a semana candidata ao check-in
 * (`getCheckinCandidateWeek`, domínio puro) a partir dos treinos + check-ins
 * já enviados para o plano, e devolve o resumo dessa semana.
 */
export function useAdaptiveTrainingSummary(): AdaptiveTrainingSummary {
  const { plan, isLoading: planLoading } = useActivePlan();
  const { workouts, isLoading: workoutsLoading } = usePlanWorkouts(plan?.id);
  const { weekNumber: currentWeekNumber, isLoading: currentWeekLoading } = useCurrentWeek();

  const checkinsQuery = useQuery({
    queryKey: ['plan-checkins', plan?.id],
    enabled: Boolean(plan?.id),
    queryFn: async () => {
      if (!plan?.id) return [];
      const result = await checkinRepository.listByPlan(plan.id);
      return result.ok ? result.value : [];
    },
  });

  const isLoading = planLoading || workoutsLoading || currentWeekLoading || checkinsQuery.isLoading;

  if (!plan || currentWeekNumber === null) return { weekNumber: null, summary: null, isLoading };

  const weekNumbers = Array.from(new Set(workouts.map((w) => w.week_number))).sort((a, b) => a - b);
  const checkinWeeks = new Set((checkinsQuery.data ?? []).map((c) => c.week_number));

  const candidates: CheckinCandidate[] = weekNumbers.map((weekNumber) => ({
    weekIndex: weekNumber,
    summary: summarizeWorkoutsForWeek(workouts, weekNumber),
    hasCheckin: checkinWeeks.has(weekNumber),
  }));

  const candidateWeek = getCheckinCandidateWeek(candidates, currentWeekNumber);
  if (candidateWeek === null) return { weekNumber: null, summary: null, isLoading };

  return {
    weekNumber: candidateWeek,
    summary: summarizeWorkoutsForWeek(workouts, candidateWeek),
    isLoading,
  };
}
