import { createClient } from 'npm:@supabase/supabase-js@2';

type SupabaseClient = ReturnType<typeof createClient>;

export type CanonicalActivity = {
  id: string;
  user_id: string;
  sport_type: string;
  start_at: string;
  distance_m: number;
  duration_s: number;
  source_priority: number;
  matched_workout_id?: string | null;
  match_type?: string | null;
  match_score?: number | null;
};

export type MatchedWorkout = {
  id: string;
  title: string | null;
  description: string | null;
  phase: string | null;
  week_number: number | null;
};

export type ActivityMatchType =
  'direct_provider_match' | 'auto_match' | 'needs_confirmation' | 'unmatched';

export type CompletionSource = 'strava_auto_match';

export type ActivityMatchResult = {
  workoutId: string | null;
  type: ActivityMatchType;
  score: number | null;
  workout: MatchedWorkout | null;
  completed: boolean;
};

type PlannedWorkout = MatchedWorkout & {
  workout_date: string | null;
  day_type: string | null;
  planned_km: number | null;
};

export const ACTIVITY_DEDUPLICATION = {
  startToleranceSeconds: 120,
  distanceToleranceMeters: 120,
  distanceTolerancePercent: 0.025,
  durationToleranceSeconds: 150,
} as const;

export const WORKOUT_MATCH_WEIGHTS = {
  sameDay: 35,
  adjacentDay: 18,
  compatibleSport: 20,
  compatibleDistance: 20,
  compatibleWorkoutType: 10,
  automaticThreshold: 80,
  confirmationThreshold: 60,
  minimumConfidenceGap: 10,
  maximumDistanceDifference: 0.5,
  compatibleDistanceDifference: 0.12,
} as const;

function localDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function localActivityDate(value: string): string {
  return localDate(value);
}

export function isSameCanonicalActivity(
  incoming: Pick<CanonicalActivity, 'sport_type' | 'start_at' | 'distance_m' | 'duration_s'>,
  candidate: Pick<CanonicalActivity, 'sport_type' | 'start_at' | 'distance_m' | 'duration_s'>,
): boolean {
  if (incoming.sport_type !== candidate.sport_type) return false;
  const first = Date.parse(incoming.start_at);
  const second = Date.parse(candidate.start_at);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return false;
  if (Math.abs(first - second) / 1000 > ACTIVITY_DEDUPLICATION.startToleranceSeconds) {
    return false;
  }

  const distanceTolerance = Math.max(
    ACTIVITY_DEDUPLICATION.distanceToleranceMeters,
    Math.max(incoming.distance_m, candidate.distance_m) *
      ACTIVITY_DEDUPLICATION.distanceTolerancePercent,
  );
  return (
    Math.abs(incoming.distance_m - candidate.distance_m) <= distanceTolerance &&
    Math.abs(incoming.duration_s - candidate.duration_s) <=
      ACTIVITY_DEDUPLICATION.durationToleranceSeconds
  );
}

function matchWindow(value: string): { from: string; to: string } {
  const anchor = new Date(`${localDate(value)}T12:00:00.000Z`);
  const from = new Date(anchor);
  const to = new Date(anchor);
  from.setUTCDate(from.getUTCDate() - 1);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function scoreWorkout(activity: CanonicalActivity, workout: PlannedWorkout): number | null {
  if (activity.sport_type !== 'run' || !workout.workout_date) return null;
  const activityDay = Date.parse(`${localDate(activity.start_at)}T12:00:00.000Z`);
  const workoutDay = Date.parse(`${workout.workout_date}T12:00:00.000Z`);
  if (!Number.isFinite(activityDay) || !Number.isFinite(workoutDay)) return null;

  const dayGap = Math.abs(activityDay - workoutDay) / 86_400_000;
  if (dayGap > 1) return null;

  let score = dayGap === 0 ? WORKOUT_MATCH_WEIGHTS.sameDay : WORKOUT_MATCH_WEIGHTS.adjacentDay;
  score += WORKOUT_MATCH_WEIGHTS.compatibleSport;

  if (workout.planned_km && workout.planned_km > 0) {
    const plannedMeters = workout.planned_km * 1000;
    const difference = Math.abs(activity.distance_m - plannedMeters) / plannedMeters;
    if (difference > WORKOUT_MATCH_WEIGHTS.maximumDistanceDifference) return null;
    if (difference <= WORKOUT_MATCH_WEIGHTS.compatibleDistanceDifference) {
      score += WORKOUT_MATCH_WEIGHTS.compatibleDistance;
    }
  }

  const type = (workout.day_type ?? '').toLowerCase();
  if (['corrida', 'intervalado', 'longão', 'ritmo'].some((item) => type.includes(item))) {
    score += WORKOUT_MATCH_WEIGHTS.compatibleWorkoutType;
  }
  return score;
}

async function findPendingWorkout(
  db: SupabaseClient,
  userId: string,
  workoutId: string,
): Promise<PlannedWorkout | null> {
  const { data, error } = await db
    .from('plan_workouts')
    .select('id,workout_date,day_type,planned_km,title,description,phase,week_number')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw new Error('Não foi possível validar o vínculo do treino.');
  return (data as PlannedWorkout | null) ?? null;
}

export async function loadMatchedWorkout(
  db: SupabaseClient,
  userId: string,
  workoutId: string,
): Promise<MatchedWorkout | null> {
  const { data, error } = await db
    .from('plan_workouts')
    .select('id,title,description,phase,week_number')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Não foi possível recuperar o treino vinculado.');
  return (data as MatchedWorkout | null) ?? null;
}

async function resolveWorkoutMatch(
  db: SupabaseClient,
  activity: CanonicalActivity,
  directWorkoutId: string | null | undefined,
): Promise<{
  workoutId: string | null;
  type: ActivityMatchType;
  score: number | null;
  workout: PlannedWorkout | null;
}> {
  if (activity.sport_type !== 'run') {
    return { workoutId: null, type: 'unmatched', score: null, workout: null };
  }

  if (directWorkoutId) {
    const workout = await findPendingWorkout(db, activity.user_id, directWorkoutId);
    return workout
      ? {
          workoutId: workout.id,
          type: 'direct_provider_match',
          score: null,
          workout,
        }
      : { workoutId: null, type: 'unmatched', score: null, workout: null };
  }

  const window = matchWindow(activity.start_at);
  const { data, error } = await db
    .from('plan_workouts')
    .select('id,workout_date,day_type,planned_km,title,description,phase,week_number')
    .eq('user_id', activity.user_id)
    .eq('status', 'pending')
    .gte('workout_date', window.from)
    .lte('workout_date', window.to);
  if (error) throw new Error('Não foi possível avaliar o treino correspondente.');

  const scored = ((data ?? []) as PlannedWorkout[])
    .map((workout) => ({ workout, score: scoreWorkout(activity, workout) }))
    .filter((item): item is { workout: PlannedWorkout; score: number } => item.score !== null)
    .sort((first, second) => second.score - first.score);
  const best = scored[0];
  if (!best || best.score < WORKOUT_MATCH_WEIGHTS.confirmationThreshold) {
    return { workoutId: null, type: 'unmatched', score: best?.score ?? null, workout: null };
  }

  const next = scored[1];
  const ambiguous = Boolean(
    next &&
    best.score >= WORKOUT_MATCH_WEIGHTS.automaticThreshold &&
    best.score - next.score < WORKOUT_MATCH_WEIGHTS.minimumConfidenceGap,
  );
  const type: ActivityMatchType =
    best.score >= WORKOUT_MATCH_WEIGHTS.automaticThreshold && !ambiguous
      ? 'auto_match'
      : 'needs_confirmation';
  return { workoutId: best.workout.id, type, score: best.score, workout: best.workout };
}

/**
 * Rotina única de vínculo e conclusão para qualquer provedor. A atividade é
 * sempre canônica; o provedor define apenas a origem da conclusão.
 */
export async function matchAndCompleteCanonicalActivity(
  db: SupabaseClient,
  activity: CanonicalActivity,
  options: {
    completionSource: CompletionSource;
    directWorkoutId?: string | null;
  },
): Promise<ActivityMatchResult> {
  const match = await resolveWorkoutMatch(db, activity, options.directWorkoutId);
  const { error: activityError } = await db
    .from('athlete_activities')
    .update({
      matched_workout_id: match.workoutId,
      match_type: match.type,
      match_score: match.score,
    })
    .eq('id', activity.id);
  if (activityError) throw new Error('Não foi possível salvar o vínculo com o treino.');

  if (
    !match.workoutId ||
    !match.workout ||
    (match.type !== 'direct_provider_match' && match.type !== 'auto_match')
  ) {
    return { ...match, completed: false };
  }

  const completionSource: CompletionSource = options.completionSource;
  const { data: completedWorkout, error: completionError } = await db
    .from('plan_workouts')
    .update({
      status: 'completed',
      completed_km: Math.round((activity.distance_m / 1000) * 100) / 100,
      completed_at: activity.start_at,
      check_in_status: 'pending',
      completion_source: completionSource,
      completion_activity_id: activity.id,
      completion_match_type: match.type,
      completion_match_score: match.score,
    })
    .eq('id', match.workoutId)
    .eq('user_id', activity.user_id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (completionError) throw new Error('Não foi possível concluir o treino automaticamente.');
  if (!completedWorkout) return { ...match, completed: false };

  console.info('[WORKOUT_COMPLETED]', {
    source: completionSource,
    activityId: activity.id,
    workoutId: match.workoutId,
  });
  console.info('[CHECKIN_CREATED_PENDING]', { workoutId: match.workoutId });
  return { ...match, completed: true };
}
