/**
 * Testes headless de completeWorkout/skipWorkout (docs/fase-4-brief.md
 * Grupo 1.3). `@/repositories`/query-client mockados (mesmo padrão de
 * adopt-plan.service.test.ts) — aqui só a orquestração é verificada:
 * concluir enfileira update do treino e do tênis (via upsert, que já
 * enfileira no outbox em BaseRepository — fora do escopo desta verificação);
 * pular nunca grava completed_km/tênis.
 */
/* eslint-disable import/first */
const upsertWorkoutMock = jest.fn();
const findShoeByIdMock = jest.fn();
const upsertShoeMock = jest.fn();
const invalidateQueriesMock = jest.fn();

jest.mock('@/repositories', () => ({
  workoutRepository: { upsert: upsertWorkoutMock },
  shoeRepository: { findById: findShoeByIdMock, upsert: upsertShoeMock },
}));
jest.mock('@/store/query-client', () => ({ queryClient: { invalidateQueries: invalidateQueriesMock } }));

import { completeWorkout, skipWorkout } from '@/services/workout/complete-workout.service';
import { ok, err } from '@/utils/result';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  upsertWorkoutMock.mockResolvedValue(ok({ id: 'w-1', status: 'completed' }));
  upsertShoeMock.mockResolvedValue(ok({ id: 'shoe-1' }));
  invalidateQueriesMock.mockResolvedValue(undefined);
});

describe('completeWorkout', () => {
  it('sem tênis: só atualiza o treino (status completed, completed_km, sem tocar shoeRepository)', async () => {
    const result = await completeWorkout({ workoutId: 'w-1', completedKm: 5, perceivedEffort: 6 });

    expect(result.ok).toBe(true);
    expect(upsertWorkoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w-1', status: 'completed', completed_km: 5, shoe_id: null }),
    );
    expect(findShoeByIdMock).not.toHaveBeenCalled();
    expect(upsertShoeMock).not.toHaveBeenCalled();
    expect(invalidateQueriesMock).toHaveBeenCalled();
  });

  it('com tênis: incrementa current_km do tênis (treino + tênis, os dois enfileirados)', async () => {
    findShoeByIdMock.mockResolvedValue(ok({ id: 'shoe-1', current_km: 100 }));

    const result = await completeWorkout({ workoutId: 'w-1', completedKm: 5, perceivedEffort: 6, shoeId: 'shoe-1' });

    expect(result.ok).toBe(true);
    expect(upsertWorkoutMock).toHaveBeenCalledWith(expect.objectContaining({ shoe_id: 'shoe-1' }));
    expect(upsertShoeMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'shoe-1', current_km: 105 }));
  });

  it('tênis informado mas não encontrado localmente: conclui o treino sem quebrar', async () => {
    findShoeByIdMock.mockResolvedValue(ok(null));

    const result = await completeWorkout({ workoutId: 'w-1', completedKm: 5, perceivedEffort: 6, shoeId: 'ghost' });

    expect(result.ok).toBe(true);
    expect(upsertShoeMock).not.toHaveBeenCalled();
  });

  it('falha ao atualizar o treino → propaga erro e não mexe no tênis', async () => {
    upsertWorkoutMock.mockResolvedValueOnce(err({ code: 'storage', message: 'falhou' }));

    const result = await completeWorkout({ workoutId: 'w-1', completedKm: 5, perceivedEffort: 6, shoeId: 'shoe-1' });

    expect(result.ok).toBe(false);
    expect(findShoeByIdMock).not.toHaveBeenCalled();
  });
});

describe('skipWorkout', () => {
  it('marca status skipped com o motivo, nunca grava completed_km', async () => {
    upsertWorkoutMock.mockResolvedValueOnce(ok({ id: 'w-1', status: 'skipped' }));

    const result = await skipWorkout({ workoutId: 'w-1', reason: 'dor no joelho' });

    expect(result.ok).toBe(true);
    const call = upsertWorkoutMock.mock.calls[0][0];
    expect(call).toEqual(expect.objectContaining({ id: 'w-1', status: 'skipped', feedback: 'dor no joelho' }));
    expect(call).not.toHaveProperty('completed_km');
    expect(call).not.toHaveProperty('shoe_id');
  });

  it('nunca chama shoeRepository', async () => {
    await skipWorkout({ workoutId: 'w-1' });
    expect(findShoeByIdMock).not.toHaveBeenCalled();
    expect(upsertShoeMock).not.toHaveBeenCalled();
  });
});
