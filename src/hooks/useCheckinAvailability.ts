import { useQuery } from '@tanstack/react-query';
import { useActivePlan } from './useActivePlan';
import { usePlanWorkouts } from './usePlanWorkouts';
import { checkinRepository } from '@/repositories';
import { summarizeWorkoutsForWeek } from '@/services/plan/week-summary.service';
import type { WeekSummary } from '@/domain/motor-evo/adaptive-training';

export type CheckinAvailabilityStatus = 'done' | 'available' | 'waiting';

export interface CheckinAvailability {
  status: CheckinAvailabilityStatus;
  summary: WeekSummary | null;
  isLoading: boolean;
}

/**
 * docs/fase-5-brief.md Grupo 2.1/§21. Libera o check-in só quando todos os
 * treinos da semana estão resolvidos (`summarizeWeek.canCheckin`, domínio
 * puro). Três estados para a UI: `done` (já enviado), `available` (liberado,
 * ainda não enviado), `waiting` (treinos pendentes).
 */
export function useCheckinAvailability(weekNumber: number | null): CheckinAvailability {
  const { plan, isLoading: planLoading } = useActivePlan();
  const { workouts, isLoading: workoutsLoading } = usePlanWorkouts(plan?.id);

  const checkinsQuery = useQuery({
    queryKey: ['plan-checkins', plan?.id],
    enabled: Boolean(plan?.id),
    queryFn: async () => {
      if (!plan?.id) return [];
      const result = await checkinRepository.listByPlan(plan.id);
      return result.ok ? result.value : [];
    },
  });

  const isLoading = planLoading || workoutsLoading || checkinsQuery.isLoading;

  if (weekNumber === null || !plan) return { status: 'waiting', summary: null, isLoading };

  const summary = summarizeWorkoutsForWeek(workouts, weekNumber);
  // Check-in invalidado (docs/fase-5-brief.md §22 — edição manual pós-check-in)
  // não conta como enviado: o atleta precisa refazer.
  const hasCheckin = (checkinsQuery.data ?? []).some((c) => c.week_number === weekNumber && !c.invalidated);
  const status: CheckinAvailabilityStatus = hasCheckin ? 'done' : summary.canCheckin ? 'available' : 'waiting';

  return { status, summary, isLoading };
}
