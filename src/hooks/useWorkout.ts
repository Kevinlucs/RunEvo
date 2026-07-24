import { useQuery } from '@tanstack/react-query';
import { workoutRepository } from '@/repositories';
import type { Workout } from '@/domain/entities';

/** Treino individual por id (docs/fase-4-brief.md Grupo 4, §28). */
export function useWorkout(id: string | undefined) {
  const query = useQuery({
    queryKey: ['workout', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Workout | null> => {
      if (!id) return null;
      const result = await workoutRepository.findById(id);
      return result.ok ? result.value : null;
    },
  });

  return { workout: query.data ?? null, isLoading: query.isLoading };
}
