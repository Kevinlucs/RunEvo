/**
 * Testes headless de submitCheckin (docs/fase-5-brief.md Grupo 2.3).
 * `@/repositories`/query-client mockados (mesmo padrão de
 * complete-workout.service.test.ts) — aqui a orquestração completa:
 * local sempre calculada, IA tentada com fallback obrigatório, guardrails
 * §18 decidindo, redistribuição de pulado, reescala só de semanas futuras,
 * prova nunca tocada, persistência via repositories.
 */
/* eslint-disable import/first */
const findPlanByIdMock = jest.fn();
const listWorkoutsByPlanMock = jest.fn();
const upsertWorkoutMock = jest.fn();
const upsertCheckinMock = jest.fn();
const invalidateQueriesMock = jest.fn();

jest.mock('@/repositories', () => ({
  trainingPlanRepository: { findById: findPlanByIdMock },
  workoutRepository: { listByPlan: listWorkoutsByPlanMock, upsert: upsertWorkoutMock },
  checkinRepository: { upsert: upsertCheckinMock },
}));
jest.mock('@/store/query-client', () => ({ queryClient: { invalidateQueries: invalidateQueriesMock } }));
// `remoteCheckinCoachProvider` (default do 2º parâmetro) depende de `@/lib/supabase`,
// que exige runtime RN/Metro — mockado aqui pelo mesmo motivo de
// plan-blueprint.provider.test.ts. Todos os testes abaixo passam um provider
// explícito, mas o import estático de submit-checkin.service.ts ainda resolve o módulo.
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

import { submitCheckin, isWeightRequiredForWeek } from '@/services/checkin/submit-checkin.service';
import type { CheckinCoachProvider } from '@/services/ai/checkin-coach.provider';
import { ok } from '@/utils/result';
import type { Workout } from '@/domain/entities';
/* eslint-enable import/first */

const plan = {
  id: 'plan-1',
  race_name: '10km',
  objective: 'completar',
  total_weeks: 8,
} as never;

function makeWorkout(overrides: Partial<Workout>): Workout {
  return {
    id: `w-${Math.random()}`,
    plan_id: 'plan-1',
    user_id: 'user-1',
    week_number: 1,
    week_index: 0,
    phase: 'Base',
    workout_date: null,
    day_label: 'Segunda',
    day_type: 'Base',
    title: 'Treino',
    description: 'desc',
    planned_km: 5,
    planned_pace: '6:00/km',
    status: 'completed',
    completed_km: 5,
    perceived_effort: 6,
    feeling: null,
    pain: null,
    feedback: null,
    shoe_id: null,
    completed_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Semana 1 (checkin) totalmente resolvida (3 treinos completos); semana 2 (futura) com 2 treinos.
function baseWorkouts(): Workout[] {
  return [
    makeWorkout({ id: 'w1-1', week_number: 1, week_index: 0, status: 'completed', planned_km: 5 }),
    makeWorkout({ id: 'w1-2', week_number: 1, week_index: 1, status: 'completed', planned_km: 5 }),
    makeWorkout({ id: 'w1-3', week_number: 1, week_index: 2, status: 'completed', planned_km: 5 }),
    makeWorkout({ id: 'w2-1', week_number: 2, week_index: 0, status: 'pending', planned_km: 6, day_type: 'Base' }),
    makeWorkout({ id: 'w2-2', week_number: 2, week_index: 1, status: 'pending', planned_km: 6, day_type: 'Longão' }),
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  findPlanByIdMock.mockResolvedValue(ok(plan));
  listWorkoutsByPlanMock.mockResolvedValue(ok(baseWorkouts()));
  upsertWorkoutMock.mockImplementation((row: Record<string, unknown>) => Promise.resolve(ok(row)));
  upsertCheckinMock.mockImplementation((row: Record<string, unknown>) => Promise.resolve(ok({ id: 'checkin-1', ...row })));
  invalidateQueriesMock.mockResolvedValue(undefined);
});

const baseInput = {
  planId: 'plan-1',
  userId: 'user-1',
  weekNumber: 1,
  feedback: { effort: 6, feeling: 'normal' as const, pain: false },
};

describe('submitCheckin', () => {
  it('IA fora do ar → cai na recomendação local, source "local", nunca lança', async () => {
    const failingProvider: CheckinCoachProvider = { suggest: jest.fn().mockRejectedValue(new Error('network down')) };

    const result = await submitCheckin(baseInput, failingProvider);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.recommendation.source).toBe('local');
      expect(upsertCheckinMock).toHaveBeenCalledWith(
        expect.objectContaining({ ai_analysis: expect.objectContaining({ source: 'local' }) }),
      );
    }
  });

  it('IA responde slight_increase mas dor=true → guardrail força recovery (source "ai")', async () => {
    const aiProvider: CheckinCoachProvider = {
      suggest: jest.fn().mockResolvedValue({
        action: 'slight_increase',
        adjustmentPercent: 5,
        weeksToAdjust: 1,
        reason: 'ia sugeriu aumento',
        confidence: 'alta',
        messageToUser: 'vamos aumentar',
        coachTip: '',
      }),
    };

    const result = await submitCheckin({ ...baseInput, feedback: { ...baseInput.feedback, pain: true } }, aiProvider);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.recommendation.action).toBe('recovery');
      expect(result.value.recommendation.source).toBe('ai');
    }
  });

  it('semana perfeita + leve → maintain, nunca reescala semanas futuras', async () => {
    const result = await submitCheckin({
      ...baseInput,
      feedback: { effort: 4, feeling: 'leve', pain: false },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.recommendation.action).toBe('maintain');
    expect(upsertWorkoutMock).not.toHaveBeenCalled();
  });

  it('recovery (dor) → reescala só a semana futura, nunca a semana do check-in', async () => {
    const result = await submitCheckin({ ...baseInput, feedback: { ...baseInput.feedback, pain: true } });

    expect(result.ok).toBe(true);
    // Só treinos da semana 2 (futura) devem ser tocados — nenhum id w1-*.
    for (const call of upsertWorkoutMock.mock.calls) {
      expect((call[0] as { id: string }).id).toMatch(/^w2-/);
    }
    expect(upsertWorkoutMock).toHaveBeenCalled();
  });

  it('treino pulado na semana do check-in → redistribui parte da carga para a próxima semana', async () => {
    const workoutsWithSkip = baseWorkouts();
    workoutsWithSkip[1] = { ...workoutsWithSkip[1], status: 'skipped', completed_km: null } as Workout;
    listWorkoutsByPlanMock.mockResolvedValue(ok(workoutsWithSkip));

    const result = await submitCheckin({
      ...baseInput,
      feedback: { effort: 5, feeling: 'normal', pain: false },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.redistribution.applied).toBe(true);
  });

  it('plano inexistente → erro not_found, nenhuma escrita', async () => {
    findPlanByIdMock.mockResolvedValue(ok(null));

    const result = await submitCheckin(baseInput);

    expect(result.ok).toBe(false);
    expect(upsertCheckinMock).not.toHaveBeenCalled();
  });
});

describe('isWeightRequiredForWeek', () => {
  it.each([
    [4, true],
    [8, true],
    [1, false],
    [3, false],
    [5, false],
  ])('semana %i → obrigatório=%s', (weekNumber, expected) => {
    expect(isWeightRequiredForWeek(weekNumber)).toBe(expected);
  });
});
