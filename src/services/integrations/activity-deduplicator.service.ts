import type { AthleteActivity, ActivityProvider } from '@/domain/entities';

export const SOURCE_PRIORITY: Record<ActivityProvider, number> = {
  runevo: 1,
  strava: 4,
  manual: 5,
};

export const DEDUPLICATION_TOLERANCES = {
  startTimeSeconds: 120,
  distanceMeters: 120,
  distancePercent: 0.025,
  durationSeconds: 150,
} as const;

export interface IncomingActivity {
  userId: string;
  sportType: string;
  startAt: string;
  distanceM: number;
  durationS: number;
  provider: ActivityProvider;
}

/**
 * Encontra a atividade canônica equivalente. O identificador externo é
 * verificado antes deste serviço; esta heurística cobre a mesma corrida
 * entregue por dois provedores com pequenas diferenças de arredondamento.
 */
export function findDuplicateActivity(
  incoming: IncomingActivity,
  existing: AthleteActivity[],
): AthleteActivity | null {
  const incomingStart = Date.parse(incoming.startAt);
  if (!Number.isFinite(incomingStart)) return null;

  return (
    existing.find((candidate) => {
      if (candidate.userId !== incoming.userId) return false;
      if (candidate.sportType.toLowerCase() !== incoming.sportType.toLowerCase()) return false;

      const candidateStart = Date.parse(candidate.startAt);
      if (!Number.isFinite(candidateStart)) return false;
      if (
        Math.abs(candidateStart - incomingStart) / 1000 >
        DEDUPLICATION_TOLERANCES.startTimeSeconds
      ) {
        return false;
      }

      const distanceTolerance = Math.max(
        DEDUPLICATION_TOLERANCES.distanceMeters,
        Math.max(candidate.distanceM, incoming.distanceM) *
          DEDUPLICATION_TOLERANCES.distancePercent,
      );
      if (Math.abs(candidate.distanceM - incoming.distanceM) > distanceTolerance) return false;

      return (
        Math.abs(candidate.durationS - incoming.durationS) <=
        DEDUPLICATION_TOLERANCES.durationSeconds
      );
    }) ?? null
  );
}
