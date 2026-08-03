import { useAuthStore } from '@/store/auth.store';
import { useActivePlan } from './useActivePlan';
import { usePlanWorkouts } from './usePlanWorkouts';
import { usePlanProgress } from './usePlanProgress';
import { useAthleteProfile } from './useAthleteProfile';
import { computeWeeklyStats, computeWeeksStreak, type WeeklyStatPoint } from '@/services/stats/stats.service';

export interface AthleteStats {
  totalKm: number;
  completedWorkouts: number;
  remainingWorkouts: number;
  weeksStreak: number;
  imc: number | null;
  weeklyStats: WeeklyStatPoint[];
}

/**
 * docs/fase-6-brief.md Grupo 2 (§31) — agrega tudo que a tela de Estatísticas
 * precisa para a planilha ativa (visão Free). Nenhum cálculo de treino aqui:
 * só combina hooks já existentes (progresso, perfil) com a agregação pura de
 * `stats.service.ts`.
 */
export function useAthleteStats(): { stats: AthleteStats | null; isLoading: boolean } {
  const userId = useAuthStore((s) => s.userId);
  const { plan, isLoading: planLoading } = useActivePlan();
  const { workouts, isLoading: workoutsLoading } = usePlanWorkouts(plan?.id);
  const { progress } = usePlanProgress();
  const { profile, isLoading: profileLoading } = useAthleteProfile(userId);

  const isLoading = planLoading || workoutsLoading || profileLoading;

  if (!plan || !progress) return { stats: null, isLoading };

  const weeklyStats = computeWeeklyStats(workouts);

  return {
    stats: {
      totalKm: progress.completedKm,
      completedWorkouts: progress.completedWorkouts,
      remainingWorkouts: workouts.filter((w) => w.status === 'pending').length,
      weeksStreak: computeWeeksStreak(weeklyStats),
      imc: profile?.imc ?? null,
      weeklyStats,
    },
    isLoading,
  };
}
