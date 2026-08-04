import { useQuery } from '@tanstack/react-query';
import { trainingPlanRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth.store';
import { buildCycleSummary, type CycleSummary } from '@/services/history/cycle-summary';

/**
 * docs/fase-7-5-brief.md Grupo 2 — ciclos arquivados do usuário, já resumidos
 * (mais recente primeiro, mesma ordem de `trainingPlanRepository.listArchived`).
 * Cada resumo usa `getById` (Grupo 1) para buscar os workouts daquele plano —
 * nunca recalcula, só lê o que já está salvo. Offline-first (React Query
 * sobre o cache SQLite local, igual `useActivePlan`).
 */
export function useCycleHistory() {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: ['cycle-history', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<CycleSummary[]> => {
      if (!userId) return [];
      const plansRes = await trainingPlanRepository.listArchived(userId);
      if (!plansRes.ok) throw plansRes.error;

      return Promise.all(
        plansRes.value.map(async (plan) => {
          const cycleRes = await trainingPlanRepository.getById(plan.id);
          const workouts = cycleRes.ok && cycleRes.value ? cycleRes.value.workouts : [];
          return buildCycleSummary(plan, workouts);
        }),
      );
    },
  });

  return { cycles: query.data ?? [], isLoading: query.isLoading };
}
