import { useQuery } from '@tanstack/react-query';
import { trainingPlanRepository } from '@/repositories';
import type { TrainingPlan } from '@/domain/entities';

/**
 * Plano por id (docs/fase-4-brief.md Grupo 4, §28) — diferente de
 * `useActivePlan`, busca o plano dono de um treino específico, que pode não
 * ser mais o plano ativo do usuário (ex.: plano arquivado).
 */
export function usePlan(planId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['plan', planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<TrainingPlan | null> => {
      if (!planId) return null;
      const result = await trainingPlanRepository.findById(planId);
      return result.ok ? result.value : null;
    },
  });

  return { plan: query.data ?? null, isLoading: query.isLoading };
}
