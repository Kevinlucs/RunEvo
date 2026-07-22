import { useQuery } from '@tanstack/react-query';
import { trainingPlanRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth.store';
import type { TrainingPlan } from '@/domain/entities';

/**
 * Guard de conteúdo vazio (docs/fase-3-brief.md §Grupo 5): as abas Início,
 * Treinos e Estatísticas usam isto para decidir entre o placeholder normal
 * e o estado vazio compacto com CTA para a IA Evo.
 */
export function useActivePlan() {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: ['active-plan', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<TrainingPlan | null> => {
      if (!userId) return null;
      const result = await trainingPlanRepository.getActive(userId);
      return result.ok ? result.value : null;
    },
  });

  return { plan: query.data ?? null, isLoading: query.isLoading };
}
