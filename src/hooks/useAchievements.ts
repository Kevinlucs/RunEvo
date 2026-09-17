import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useLifetimeStats } from './useLifetimeStats';
import { computeAchievements } from '@/services/gamification/compute';
import { type Achievement } from '@/services/gamification/constants';
import { getDb } from '@/db/sqlite';

export interface AchievementWithDate extends Omit<Achievement, 'unlockedAt'> {
  /** ISO date (YYYY-MM-DD) em que foi desbloqueada pela primeira vez. Null se ainda bloqueada. */
  unlockedAt: string | null;
}

interface StoredUnlock {
  achievement_key: string;
  unlocked_at: string;
}

/** Lê todos os registros de achievements_unlocked para o usuário. */
async function fetchUnlockDates(userId: string): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<StoredUnlock>(
    'SELECT achievement_key, unlocked_at FROM achievements_unlocked WHERE user_id = ?',
    [userId],
  );
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.achievement_key] = row.unlocked_at;
  }
  return map;
}

/** Persiste data de desbloqueio para conquistas ainda não registradas. */
async function recordNewUnlocks(
  userId: string,
  achievements: Achievement[],
  existing: Record<string, string>,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const db = await getDb();
  let changed = false;

  for (const a of achievements) {
    if (a.unlocked && !existing[a.key]) {
      await db.runAsync(
        'INSERT OR IGNORE INTO achievements_unlocked (user_id, achievement_key, unlocked_at) VALUES (?, ?, ?)',
        [userId, a.key, today],
      );
      changed = true;
    }
  }

  return changed;
}

/**
 * Hook principal de conquistas com datas de desbloqueio persistidas localmente.
 *
 * - Computa conquistas a partir dos stats lifetime
 * - Detecta novas conquistas desbloqueadas e salva a data no SQLite local
 * - Retorna `AchievementWithDate[]` com `unlockedAt` preenchido para as desbloqueadas
 */
export function useAchievements(): {
  achievements: AchievementWithDate[];
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.userId);
  const qc = useQueryClient();
  const { stats, isLoading: statsLoading } = useLifetimeStats();

  // Conquistas computadas em runtime (sem data)
  const computed = computeAchievements(
    stats.totalKm,
    stats.totalCompletedWorkouts,
    stats.completedPlansCount,
    stats.maxSingleWorkoutKm,
  );

  // Datas persistidas no SQLite
  const { data: unlockDates, isLoading: datesLoading } = useQuery({
    queryKey: ['achievement-dates', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchUnlockDates(userId!),
    staleTime: 60_000, // 1 min — datas não mudam com frequência
  });

  // Detectar e persistir novas conquistas quando os stats mudarem
  useEffect(() => {
    if (!userId || !unlockDates || statsLoading) return;

    recordNewUnlocks(userId, computed, unlockDates).then((changed) => {
      if (changed) {
        // Invalida cache para que o hook re-leia as novas datas
        void qc.invalidateQueries({ queryKey: ['achievement-dates', userId] });
      }
    });
    // computed muda quando stats muda; não incluir no dep para evitar loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, stats, unlockDates, statsLoading]);

  const dates = unlockDates ?? {};

  const achievements: AchievementWithDate[] = computed.map((a) => ({
    ...a,
    unlockedAt: dates[a.key] ?? null,
  }));

  return {
    achievements,
    isLoading: statsLoading || datesLoading,
  };
}
