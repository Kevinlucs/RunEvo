/**
 * Testes headless do editor manual (docs/fase-5-brief.md Grupo 4, §22).
 * `@/repositories`/query-client mockados (mesmo padrão de
 * complete-workout.service.test.ts).
 */
/* eslint-disable import/first */
const findWorkoutByIdMock = jest.fn();
const listWorkoutsByPlanMock = jest.fn();
const upsertWorkoutMock = jest.fn();
const removeWorkoutMock = jest.fn();
const listCheckinsByPlanMock = jest.fn();
const upsertCheckinMock = jest.fn();
const invalidateQueriesMock = jest.fn();

jest.mock('@/repositories', () => ({
  workoutRepository: {
    findById: findWorkoutByIdMock,
    listByPlan: listWorkoutsByPlanMock,
    upsert: upsertWorkoutMock,
    remove: removeWorkoutMock,
  },
  checkinRepository: { listByPlan: listCheckinsByPlanMock, upsert: upsertCheckinMock },
}));
jest.mock('@/store/query-client', () => ({ queryClient: { invalidateQueries: invalidateQueriesMock } }));

import { updateWorkout, removeWorkout, addWorkout, moveWorkout } from '@/services/plan/edit-workout.service';
import { ok } from '@/utils/result';
import type { Workout, Checkin } from '@/domain/entities';
/* eslint-enable import/first */

function makeWorkout(overrides: Partial<Workout>): Workout {
  return {
    id: 'w-1',
    plan_id: 'plan-1',
    user_id: 'user-1',
    week_number: 2,
    week_index: 0,
    phase: 'Base',
    workout_date: null,
    day_label: 'Terça',
    day_type: 'Base',
    title: 'Técnica + rodagem',
    description: 'desc',
    planned_km: 3,
    planned_pace: '6:00/km',
    status: 'pending',
    completed_km: null,
    perceived_effort: null,
    feeling: null,
    pain: null,
    feedback: null,
    shoe_id: null,
    completed_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCheckin(overrides: Partial<Checkin>): Checkin {
  return {
    id: 'checkin-1',
    plan_id: 'plan-1',
    user_id: 'user-1',
    week_number: 2,
    current_weight_kg: null,
    fatigue_level: 5,
    pain_level: 0,
    feeling: 'normal',
    notes: null,
    ai_analysis: {},
    adjustment: {},
    invalidated: false,
    invalidated_reason: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  upsertWorkoutMock.mockImplementation((row: Record<string, unknown>) => Promise.resolve(ok({ ...row })));
  removeWorkoutMock.mockResolvedValue(ok(undefined));
  listCheckinsByPlanMock.mockResolvedValue(ok([]));
  upsertCheckinMock.mockImplementation((row: Record<string, unknown>) => Promise.resolve(ok({ ...row })));
  invalidateQueriesMock.mockResolvedValue(undefined);
});

describe('updateWorkout', () => {
  it('edita um treino pendente e invalida o check-in da semana, se houver', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({})));
    listCheckinsByPlanMock.mockResolvedValue(ok([makeCheckin({})]));

    const result = await updateWorkout({ workoutId: 'w-1', plannedKm: 5 });

    expect(result.ok).toBe(true);
    expect(upsertWorkoutMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'w-1', planned_km: 5 }));
    expect(upsertCheckinMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'checkin-1', invalidated: true, invalidated_reason: expect.any(String) }),
    );
  });

  it('sem check-in na semana → não toca em checkinRepository.upsert', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({})));
    listCheckinsByPlanMock.mockResolvedValue(ok([]));

    const result = await updateWorkout({ workoutId: 'w-1', plannedKm: 5 });

    expect(result.ok).toBe(true);
    expect(upsertCheckinMock).not.toHaveBeenCalled();
  });

  it('check-in já invalidado não é invalidado de novo', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({})));
    listCheckinsByPlanMock.mockResolvedValue(ok([makeCheckin({ invalidated: true })]));

    await updateWorkout({ workoutId: 'w-1', plannedKm: 5 });

    expect(upsertCheckinMock).not.toHaveBeenCalled();
  });

  it('treino da prova → erro, nunca edita', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({ title: 'Prova alvo' })));

    const result = await updateWorkout({ workoutId: 'w-1', plannedKm: 99 });

    expect(result.ok).toBe(false);
    expect(upsertWorkoutMock).not.toHaveBeenCalled();
  });
});

describe('removeWorkout', () => {
  it('remove um treino pendente e invalida o check-in da semana', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({})));
    listCheckinsByPlanMock.mockResolvedValue(ok([makeCheckin({})]));

    const result = await removeWorkout('w-1');

    expect(result.ok).toBe(true);
    expect(removeWorkoutMock).toHaveBeenCalledWith('w-1');
    expect(upsertCheckinMock).toHaveBeenCalledWith(expect.objectContaining({ invalidated: true }));
  });

  it('treino da prova → erro, nunca remove', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({ title: 'Prova alvo' })));

    const result = await removeWorkout('w-1');

    expect(result.ok).toBe(false);
    expect(removeWorkoutMock).not.toHaveBeenCalled();
  });
});

describe('addWorkout', () => {
  it('adiciona treino ao final da semana (sem prova na semana)', async () => {
    listWorkoutsByPlanMock.mockResolvedValue(ok([makeWorkout({ id: 'w-1', week_index: 0 }), makeWorkout({ id: 'w-2', week_index: 1 })]));

    const result = await addWorkout({
      planId: 'plan-1',
      userId: 'user-1',
      weekNumber: 2,
      phase: 'Base',
      title: 'Treino extra',
      dayType: 'Base',
      dayLabel: 'Sexta',
      plannedKm: 4,
    });

    expect(result.ok).toBe(true);
    expect(upsertWorkoutMock).toHaveBeenCalledWith(expect.objectContaining({ week_index: 2, title: 'Treino extra' }));
  });

  it('semana com a prova → novo treino entra antes, prova continua sendo o último', async () => {
    listWorkoutsByPlanMock.mockResolvedValue(
      ok([makeWorkout({ id: 'w-1', week_index: 0 }), makeWorkout({ id: 'race', week_index: 1, title: 'Prova alvo' })]),
    );

    const result = await addWorkout({
      planId: 'plan-1',
      userId: 'user-1',
      weekNumber: 2,
      phase: 'Base',
      title: 'Treino extra',
      dayType: 'Base',
      dayLabel: 'Sexta',
      plannedKm: 4,
    });

    expect(result.ok).toBe(true);
    // prova empurrada para week_index 2, novo treino fica no antigo índice da prova (1)
    expect(upsertWorkoutMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'race', week_index: 2 }));
    expect(upsertWorkoutMock).toHaveBeenCalledWith(expect.objectContaining({ week_index: 1, title: 'Treino extra' }));
  });
});

describe('moveWorkout', () => {
  it('move um treino para cima, trocando week_index com o vizinho', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({ id: 'w-2', week_index: 1 })));
    listWorkoutsByPlanMock.mockResolvedValue(
      ok([makeWorkout({ id: 'w-1', week_index: 0 }), makeWorkout({ id: 'w-2', week_index: 1 })]),
    );

    const result = await moveWorkout('w-2', 'up');

    expect(result.ok).toBe(true);
    expect(upsertWorkoutMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'w-2', week_index: 0 }));
    expect(upsertWorkoutMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'w-1', week_index: 1 }));
  });

  it('não deixa mover para depois da prova', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({ id: 'w-1', week_index: 0 })));
    listWorkoutsByPlanMock.mockResolvedValue(
      ok([makeWorkout({ id: 'w-1', week_index: 0 }), makeWorkout({ id: 'race', week_index: 1, title: 'Prova alvo' })]),
    );

    const result = await moveWorkout('w-1', 'down');

    expect(result.ok).toBe(false);
    expect(upsertWorkoutMock).not.toHaveBeenCalled();
  });

  it('a prova nunca se move', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({ id: 'race', title: 'Prova alvo' })));

    const result = await moveWorkout('race', 'up');

    expect(result.ok).toBe(false);
    expect(upsertWorkoutMock).not.toHaveBeenCalled();
  });

  it('primeiro treino não pode subir mais', async () => {
    findWorkoutByIdMock.mockResolvedValue(ok(makeWorkout({ id: 'w-1', week_index: 0 })));
    listWorkoutsByPlanMock.mockResolvedValue(
      ok([makeWorkout({ id: 'w-1', week_index: 0 }), makeWorkout({ id: 'w-2', week_index: 1 })]),
    );

    const result = await moveWorkout('w-1', 'up');

    expect(result.ok).toBe(false);
  });
});
