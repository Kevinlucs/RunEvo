import { useQuery } from '@tanstack/react-query';
import { workoutRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth.store';
import { useCycleHistory } from './useCycleHistory';

export interface LifetimeStats {
  /** Km lifetime acumulado — soma de completed_km de TODOS os treinos concluídos (ativo + arquivados). */
  totalKm: number;
  /** Total de treinos concluídos (lifetime, cross-plan). */
  totalCompletedWorkouts: number;
  /** Maior distância registrada numa única atividade. */
  maxSingleWorkoutKm: number;
  /** Total de planos/ciclos concluídos (prova completada ou 100% de aderência). */
  completedPlansCount: number;
}

const EMPTY: LifetimeStats = {
  totalKm: 0,
  totalCompletedWorkouts: 0,
  maxSingleWorkoutKm: 0,
  completedPlansCount: 0,
};

/**
 * Agregação lifetime cross-plan para gameficação (níveis/conquistas/recordes).
 * Diferente de `useAthleteStats` (que olha só o plano ATIVO), aqui somamos os
 * treinos de TODOS os planos do usuário via `workoutRepository.listByUser`.
 *
 * Planos concluídos vêm de `useCycleHistory` (ciclos arquivados): conta como
 * concluído quem completou a prova (`raceCompleted`) ou 100% dos treinos.
 */
export function useLifetimeStats(): { stats: LifetimeStats; isLoading: boolean } {
  const userId = useAuthStore((s) => s.userId);
  const { cycles, isLoading: cyclesLoading } = useCycleHistory();

  const query = useQuery({
    queryKey: ['lifetime-workouts', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Pick<LifetimeStats, 'totalKm' | 'totalCompletedWorkouts' | 'maxSingleWorkoutKm'>> => {
      if (!userId) return { totalKm: 0, totalCompletedWorkouts: 0, maxSingleWorkoutKm: 0 };
      const res = await workoutRepository.listByUser(userId);
      if (!res.ok) throw res.error;

      let totalKm = 0;
      let totalCompletedWorkouts = 0;
      let maxSingleWorkoutKm = 0;
      for (const w of res.value) {
        if (w.status !== 'completed') continue;
        const km = w.completed_km ?? 0;
        totalKm += km;
        totalCompletedWorkouts += 1;
        if (km > maxSingleWorkoutKm) maxSingleWorkoutKm = km;
      }
      return { totalKm, totalCompletedWorkouts, maxSingleWorkoutKm };
    },
  });

  const completedPlansCount = cycles.filter(
    (c) => c.raceCompleted === true || c.adherence.completionRate === 1,
  ).length;

  if (!query.data) {
    return { stats: { ...EMPTY, completedPlansCount }, isLoading: query.isLoading || cyclesLoading };
  }

  return {
    stats: { ...query.data, completedPlansCount },
    isLoading: query.isLoading || cyclesLoading,
  };
}
