import { useQuery } from '@tanstack/react-query';
import { workoutRepository } from '@/repositories';
import type { Workout } from '@/domain/entities';

/** Todos os treinos do plano, ordenados por week_number/week_index (docs/fase-4-brief.md Grupo 1.2). */
export function usePlanWorkouts(planId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['plan-workouts', planId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<Workout[]> => {
      if (!planId) return [];
      const result = await workoutRepository.listByPlan(planId);
      return result.ok ? result.value : [];
    },
  });

  return { workouts: query.data ?? [], isLoading: query.isLoading };
}
