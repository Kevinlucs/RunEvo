import { useQuery, useQueryClient } from '@tanstack/react-query';
import { athleteProfileRepository } from '@/repositories';
import type { AthleteProfile } from '@/domain/entities';

/**
 * Perfil do atleta (docs/fase-6-brief.md Grupo 2/4) — leitura via repository
 * (offline-first). `invalidate` é exposto para telas de edição (Grupo 4)
 * atualizarem a UI logo após um `upsert` local.
 */
export function useAthleteProfile(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['athlete-profile', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AthleteProfile | null> => {
      if (!userId) return null;
      const result = await athleteProfileRepository.findById(userId);
      return result.ok ? result.value : null;
    },
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['athlete-profile', userId] }),
  };
}
