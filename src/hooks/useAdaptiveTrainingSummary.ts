import { useQuery } from '@tanstack/react-query';
import { useActivePlan } from './useActivePlan';
import { usePlanWorkouts } from './usePlanWorkouts';
import { useCurrentWeek } from './useCurrentWeek';
import { checkinRepository } from '@/repositories';
import { summarizeWorkoutsForWeek } from '@/services/plan/week-summary.service';
import { getCheckinCandidateWeek, type CheckinCandidate, type WeekSummary } from '@/domain/motor-evo/adaptive-training';
import type { CheckinAvailabilityStatus } from './useCheckinAvailability';

export interface AdaptiveTrainingSummary {
  weekNumber: number | null;
  summary: WeekSummary | null;
  /**
   * docs/fase-5-brief.md Grupo 2.1/§21 — os 3 estados do check-in (distinto
   * de `summary.status`, que só fala de treinos resolvidos/não). `done` só
   * acontece no fallback de `getCheckinCandidateWeek` (nenhuma semana
   * candidata sem check-in — cai na semana corrente mesmo já enviada).
   */
  checkinStatus: CheckinAvailabilityStatus | null;
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

  if (!plan || currentWeekNumber === null) return { weekNumber: null, summary: null, checkinStatus: null, isLoading };

  const weekNumbers = Array.from(new Set(workouts.map((w) => w.week_number))).sort((a, b) => a - b);
  // Check-in invalidado (§22 — edição manual pós-check-in) não conta como
  // enviado: reabre a semana como candidata a um novo check-in.
  const checkinWeeks = new Set((checkinsQuery.data ?? []).filter((c) => !c.invalidated).map((c) => c.week_number));

  const candidates: CheckinCandidate[] = weekNumbers.map((weekNumber) => ({
    weekIndex: weekNumber,
    summary: summarizeWorkoutsForWeek(workouts, weekNumber),
    hasCheckin: checkinWeeks.has(weekNumber),
  }));

  const candidateWeek = getCheckinCandidateWeek(candidates, currentWeekNumber);
  if (candidateWeek === null) return { weekNumber: null, summary: null, checkinStatus: null, isLoading };

  const summary = summarizeWorkoutsForWeek(workouts, candidateWeek);
  const checkinStatus: CheckinAvailabilityStatus = checkinWeeks.has(candidateWeek)
    ? 'done'
    : summary.canCheckin
      ? 'available'
      : 'waiting';

  return { weekNumber: candidateWeek, summary, checkinStatus, isLoading };
}
