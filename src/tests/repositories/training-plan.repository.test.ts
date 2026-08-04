/* eslint-disable import/first */
// expo-sqlite exige o runtime RN/Metro — fora do alcance do ts-jest genérico
// (ver base.repository.test.ts). Mocka a interface do SQLiteDatabase; como
// `workoutRepository` (usado por `getById`) também lê de `@/db/sqlite`, o
// mesmo mock cobre a composição entre os dois repositórios.
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();

jest.mock('@/db/sqlite', () => ({
  getDb: async () => ({
    getFirstAsync: mockGetFirstAsync,
    getAllAsync: mockGetAllAsync,
  }),
}));
jest.mock('@/db/outbox', () => ({ enqueue: jest.fn() }));
jest.mock('@/utils/uuid', () => ({ newUuid: () => 'generated-uuid' }));

import { trainingPlanRepository } from '@/repositories/training-plan.repository';
import type { TrainingPlan, Workout } from '@/domain/entities';
/* eslint-enable import/first */

function plan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: 'plan-1',
    user_id: 'user-1',
    plan_name: 'Plano 10K',
    race_name: 'Corrida X',
    race_distance_km: 10,
    start_date: '2026-01-05',
    race_date: '2026-03-30',
    total_weeks: 8,
    days_per_week: 3,
    objective: null,
    terrain: 'plano',
    status: 'archived',
    user_data: {},
    blueprint: {},
    validation: {},
    quality: {},
    risk: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'w-1',
    plan_id: 'plan-1',
    user_id: 'user-1',
    week_number: 1,
    week_index: 0,
    phase: 'Base',
    workout_date: '2026-01-05',
    day_label: 'Segunda',
    day_type: 'Base',
    title: 'Rodagem',
    description: null,
    planned_km: 5,
    planned_pace: '6:00',
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

describe('trainingPlanRepository.listArchived', () => {
  beforeEach(() => {
    mockGetFirstAsync.mockReset();
    mockGetAllAsync.mockReset();
  });

  it('busca só arquivados do usuário, ordenados por race_date desc, via SQL', async () => {
    const rows = [plan({ id: 'p-2', race_date: '2026-06-01' }), plan({ id: 'p-1', race_date: '2025-01-01' })];
    mockGetAllAsync.mockResolvedValue(rows);

    const result = await trainingPlanRepository.listArchived('user-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((p) => p.id)).toEqual(['p-2', 'p-1']);

    const [sql, params] = mockGetAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'archived'");
    expect(sql).toContain('ORDER BY race_date DESC');
    expect(params).toEqual(['user-1']);
  });

  it('usuário sem ciclos arquivados retorna lista vazia, não erro', async () => {
    mockGetAllAsync.mockResolvedValue([]);

    const result = await trainingPlanRepository.listArchived('user-sem-historico');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });
});

describe('trainingPlanRepository.getById', () => {
  beforeEach(() => {
    mockGetFirstAsync.mockReset();
    mockGetAllAsync.mockReset();
  });

  it('retorna o plano com seus workouts (composição com workoutRepository)', async () => {
    mockGetFirstAsync.mockResolvedValue(plan({ id: 'plan-1' }));
    mockGetAllAsync.mockResolvedValue([workout({ id: 'w-1' }), workout({ id: 'w-2', week_index: 1 })]);

    const result = await trainingPlanRepository.getById('plan-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.plan.id).toBe('plan-1');
      expect(result.value?.workouts.map((w) => w.id)).toEqual(['w-1', 'w-2']);
    }
  });

  it('plano inexistente retorna null, não erro', async () => {
    mockGetFirstAsync.mockResolvedValue(null);

    const result = await trainingPlanRepository.getById('plano-nao-existe');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
    expect(mockGetAllAsync).not.toHaveBeenCalled();
  });
});
