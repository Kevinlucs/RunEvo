import { useQuery } from '@tanstack/react-query';
import { trainingPlanRepository } from '@/repositories';
import { buildCycleSummary, type CycleSummary } from '@/services/history/cycle-summary';
import type { TrainingPlan } from '@/domain/entities';

export interface CycleDetail {
  plan: TrainingPlan;
  summary: CycleSummary;
}

/** docs/fase-7-5-brief.md Grupo 2 — resumo read-only de um ciclo (histórico ou comparação). */
export function useCycleDetail(planId: string | undefined) {
  const query = useQuery({
    queryKey: ['cycle-detail', planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<CycleDetail | null> => {
      if (!planId) return null;
      const res = await trainingPlanRepository.getById(planId);
      if (!res.ok || !res.value) return null;
      return { plan: res.value.plan, summary: buildCycleSummary(res.value.plan, res.value.workouts) };
    },
  });

  return { data: query.data ?? null, isLoading: query.isLoading };
}
