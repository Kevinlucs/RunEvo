/**
 * Atividade canônica do atleta. Provedores externos são normalizados para
 * este formato antes de qualquer regra de deduplicação ou vínculo com treino.
 */
export type ActivityProvider = 'runevo' | 'strava' | 'manual';
export type ActivityMatchType =
  'direct_provider_match' | 'auto_match' | 'needs_confirmation' | 'unmatched';

export interface AthleteActivity {
  id: string;
  userId: string;
  sportType: string;
  startAt: string;
  distanceM: number;
  durationS: number;
  title?: string | null;
  externalUrl?: string | null;
  matchedWorkoutId?: string | null;
  matchType?: ActivityMatchType | null;
  matchScore?: number | null;
  sourcePriority: number;
}

export interface ActivitySource {
  id: string;
  activityId: string;
  provider: ActivityProvider;
  externalActivityId: string;
}

export interface PlannedWorkoutCandidate {
  id: string;
  scheduledDate: string | null;
  dayType: string | null;
  plannedDistanceKm: number | null;
  plannedDurationS?: number | null;
  sportType?: string | null;
}
