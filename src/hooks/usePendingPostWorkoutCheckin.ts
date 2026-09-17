import { useQuery } from '@tanstack/react-query';
import { workoutRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth.store';
import type { Workout } from '@/domain/entities';

/**
 * Retorna o check-in pós-treino sincronizado mais recente. A leitura continua
 * offline-first: a atualização remota chega ao SQLite pelo sincronizador.
 */
export function usePendingPostWorkoutCheckin(): {
  workout: Workout | null;
  pendingCount: number;
  isLoading: boolean;
} {
  const userId = useAuthStore((state) => state.userId);
  const query = useQuery({
    queryKey: ['pending-post-workout-checkin', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Workout[]> => {
      if (!userId) return [];
      const result = await workoutRepository.listPendingPostWorkoutCheckins(userId);
      return result.ok ? result.value : [];
    },
  });

  const workouts = query.data ?? [];
  return {
    workout: workouts[0] ?? null,
    pendingCount: workouts.length,
    isLoading: query.isLoading,
  };
}
