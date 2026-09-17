/* eslint-disable import/first */
const upsertWorkoutMock = jest.fn();
const invalidateQueriesMock = jest.fn();

jest.mock('@/repositories', () => ({ workoutRepository: { upsert: upsertWorkoutMock } }));
jest.mock('@/store/query-client', () => ({
  queryClient: { invalidateQueries: invalidateQueriesMock },
}));

import { submitPostWorkoutCheckin } from '@/services/workout/submit-post-workout-checkin.service';
import { ok } from '@/utils/result';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  upsertWorkoutMock.mockResolvedValue(ok({ id: 'workout-1', check_in_status: 'completed' }));
  invalidateQueriesMock.mockResolvedValue(undefined);
});

describe('submitPostWorkoutCheckin', () => {
  it('salva o feedback subjetivo e encerra o check-in pendente', async () => {
    const result = await submitPostWorkoutCheckin({
      workoutId: 'workout-1',
      effort: 7,
      feeling: 'dificil',
      pain: false,
      notes: 'As últimas séries pesaram.',
    });

    expect(result.ok).toBe(true);
    expect(upsertWorkoutMock).toHaveBeenCalledWith({
      id: 'workout-1',
      perceived_effort: 7,
      feeling: 'dificil',
      pain: false,
      feedback: 'As últimas séries pesaram.',
      check_in_status: 'completed',
    });
    expect(invalidateQueriesMock).toHaveBeenCalled();
  });

  it('recusa um RPE fora da escala antes de gravar', async () => {
    const result = await submitPostWorkoutCheckin({
      workoutId: 'workout-1',
      effort: 11,
      feeling: 'ideal',
      pain: false,
    });

    expect(result.ok).toBe(false);
    expect(upsertWorkoutMock).not.toHaveBeenCalled();
  });
});
