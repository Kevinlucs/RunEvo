import type { ActivityMatchType, AthleteActivity, PlannedWorkoutCandidate } from '@/domain/entities';

export const MATCH_WEIGHTS = {
  sameDay: 35,
  adjacentDay: 18,
  compatibleSport: 20,
  compatibleDistance: 20,
  compatibleDuration: 15,
  compatibleWorkoutType: 10,
  autoMatchThreshold: 80,
  confirmationThreshold: 60,
  minConfidenceGap: 10,
  dateWindowDays: 1,
} as const;

export interface WorkoutMatch {
  workoutId: string | null;
  type: ActivityMatchType;
  score: number | null;
}

export interface MatchOptions {
  /** Vínculo de um treino que o RunEvo enviou ao provider: prioridade máxima. */
  directWorkoutId?: string | null;
  timeZone?: string;
}

function toLocalDate(value: string, timeZone: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function calendarDistanceDays(first: string, second: string): number | null {
  const a = Date.parse(`${first}T12:00:00Z`);
  const b = Date.parse(`${second}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.abs(a - b) / 86_400_000;
}

function normalizedDayType(dayType: string | null): string {
  return (dayType ?? '').trim().toLowerCase();
}

function isRunActivity(activity: AthleteActivity): boolean {
  return ['run', 'running', 'corrida'].includes(activity.sportType.toLowerCase());
}

function scoreCandidate(
  activity: AthleteActivity,
  workout: PlannedWorkoutCandidate,
  timeZone: string,
): number | null {
  const localActivityDate = toLocalDate(activity.startAt, timeZone);
  if (!localActivityDate || !workout.scheduledDate) return null;

  const dayDistance = calendarDistanceDays(localActivityDate, workout.scheduledDate);
  if (dayDistance === null || dayDistance > MATCH_WEIGHTS.dateWindowDays) return null;

  let score = dayDistance === 0 ? MATCH_WEIGHTS.sameDay : MATCH_WEIGHTS.adjacentDay;
  const sport = workout.sportType?.toLowerCase() ?? 'run';
  if (isRunActivity(activity) && ['run', 'running', 'corrida'].includes(sport)) {
    score += MATCH_WEIGHTS.compatibleSport;
  }

  if (workout.plannedDistanceKm && workout.plannedDistanceKm > 0) {
    const plannedM = workout.plannedDistanceKm * 1000;
    const difference = Math.abs(activity.distanceM - plannedM) / plannedM;
    // Uma corrida muito menor/maior não pode ser vinculada apenas por ter
    // ocorrido no mesmo dia: distância é um sinal eliminatório neste caso.
    if (difference > 0.5) return null;
    if (difference <= 0.12) score += MATCH_WEIGHTS.compatibleDistance;
  }

  if (workout.plannedDurationS && workout.plannedDurationS > 0) {
    const difference = Math.abs(activity.durationS - workout.plannedDurationS) / workout.plannedDurationS;
    if (difference <= 0.2) score += MATCH_WEIGHTS.compatibleDuration;
  }

  const type = normalizedDayType(workout.dayType);
  if (isRunActivity(activity) && ['run', 'running', 'corrida', 'intervalado', 'longão', 'ritmo'].some((value) => type.includes(value))) {
    score += MATCH_WEIGHTS.compatibleWorkoutType;
  }

  return score;
}

/** Matcher determinístico: não consulta provider nem IA. */
export function matchWorkout(
  activity: AthleteActivity,
  candidates: PlannedWorkoutCandidate[],
  options: MatchOptions = {},
): WorkoutMatch {
  if (options.directWorkoutId) {
    return { workoutId: options.directWorkoutId, type: 'direct_provider_match', score: null };
  }

  const timeZone = options.timeZone ?? 'America/Sao_Paulo';
  const scored = candidates
    .map((workout) => ({ workout, score: scoreCandidate(activity, workout, timeZone) }))
    .filter((item): item is { workout: PlannedWorkoutCandidate; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < MATCH_WEIGHTS.confirmationThreshold) {
    return { workoutId: null, type: 'unmatched', score: best?.score ?? null };
  }

  const next = scored[1];
  const ambiguous = Boolean(
    next &&
      best.score >= MATCH_WEIGHTS.autoMatchThreshold &&
      best.score - next.score < MATCH_WEIGHTS.minConfidenceGap,
  );
  if (best.score >= MATCH_WEIGHTS.autoMatchThreshold && !ambiguous) {
    return { workoutId: best.workout.id, type: 'auto_match', score: best.score };
  }

  return { workoutId: best.workout.id, type: 'needs_confirmation', score: best.score };
}
