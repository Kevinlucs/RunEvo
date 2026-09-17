import { findDuplicateActivity, matchWorkout } from '@/services/integrations';
import type { AthleteActivity, PlannedWorkoutCandidate } from '@/domain/entities';

const activity: AthleteActivity = {
  id: 'activity-1',
  userId: 'user-1',
  sportType: 'run',
  startAt: '2026-09-10T10:00:00.000Z',
  distanceM: 9_900,
  durationS: 3_300,
  sourcePriority: 4,
};

const planned: PlannedWorkoutCandidate = {
  id: 'workout-1',
  scheduledDate: '2026-09-10',
  dayType: 'intervalado',
  plannedDistanceKm: 10,
  plannedDurationS: 3_360,
  sportType: 'run',
};

describe('integrações — matcher e deduplicação', () => {
  it('faz auto match de 10 km planejados e 9,9 km realizados no mesmo dia', () => {
    expect(matchWorkout(activity, [planned])).toEqual({
      workoutId: 'workout-1',
      type: 'auto_match',
      score: 100,
    });
  });

  it('mantém atividade de 3 km sem vínculo quando o treino esperado é de 10 km', () => {
    const result = matchWorkout({ ...activity, distanceM: 3_000 }, [planned]);
    expect(result.type).toBe('unmatched');
    expect(result.workoutId).toBeNull();
  });

  it('pede confirmação quando dois treinos têm confiança muito próxima', () => {
    const result = matchWorkout(activity, [planned, { ...planned, id: 'workout-2' }]);
    expect(result).toEqual({
      workoutId: 'workout-1',
      type: 'needs_confirmation',
      score: 100,
    });
  });

  it('prioriza o vínculo direto do provedor', () => {
    expect(matchWorkout(activity, [planned], { directWorkoutId: 'workout-provider' })).toEqual({
      workoutId: 'workout-provider',
      type: 'direct_provider_match',
      score: null,
    });
  });

  it('deduplica a mesma corrida recebida por duas fontes', () => {
    const importedActivity: AthleteActivity = {
      ...activity,
      id: 'provider-1',
      startAt: '2026-09-10T10:00:00.000Z',
      distanceM: 10_020,
      durationS: 3_303,
      sourcePriority: 2,
    };
    const duplicate = findDuplicateActivity(
      {
        userId: 'user-1',
        sportType: 'run',
        startAt: '2026-09-10T10:00:02.000Z',
        distanceM: 10_010,
        durationS: 3_301,
        provider: 'strava',
      },
      [importedActivity],
    );
    expect(duplicate?.id).toBe('provider-1');
  });
});
