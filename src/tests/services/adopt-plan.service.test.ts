/**
 * Testes headless de `adoptPlan` (docs/fase-3-brief.md §4.4) — orquestração:
 * arquivar o plano ativo ANTES do insert do novo, gravar todos os treinos,
 * limpar rascunho, nunca deixar o plano anterior "active" ao mesmo tempo que
 * o novo. `@/repositories`/`@/db/sqlite` mockados (expo-sqlite exige runtime
 * RN/Metro) — mecanismo de outbox/enqueue em si é `BaseRepository` (Fase 1,
 * fora do escopo desta verificação; aqui só a orquestração de `adoptPlan`).
 */
/* eslint-disable import/first */
import { randomUUID } from 'node:crypto';
// expo-crypto exige o runtime RN/Metro — fora do alcance do ts-jest genérico
// (mesmo mock de src/tests/mappers/plan.mapper.test.ts).
jest.mock('@/utils/uuid', () => ({ newUuid: () => randomUUID() }));

const getActiveMock = jest.fn();
const upsertPlanMock = jest.fn();
const upsertWorkoutMock = jest.fn();
const listByPlanMock = jest.fn();
const clearDraftMock = jest.fn();
const invalidateQueriesMock = jest.fn();

jest.mock('@/repositories', () => ({
  trainingPlanRepository: { getActive: getActiveMock, upsert: upsertPlanMock },
  workoutRepository: { upsert: upsertWorkoutMock, listByPlan: listByPlanMock },
  draftRepository: { clear: clearDraftMock },
}));
jest.mock('@/store/query-client', () => ({ queryClient: { invalidateQueries: invalidateQueriesMock } }));

import { adoptPlan } from '@/services/plan/adopt-plan.service';
import { ok, err } from '@/utils/result';
import golden_f01 from '../motor-evo/golden/f01.json';
import type { Plan } from '@/domain/motor-evo/plan-generator';
/* eslint-enable import/first */

const USER_ID = '11111111-1111-4111-8111-111111111111';
const plan = golden_f01 as unknown as Plan;

beforeEach(() => {
  jest.clearAllMocks();
  upsertPlanMock.mockResolvedValue(ok({ id: 'new-plan-id' }));
  upsertWorkoutMock.mockResolvedValue(ok({}));
  clearDraftMock.mockResolvedValue(ok(undefined));
  invalidateQueriesMock.mockResolvedValue(undefined);
});

describe('adoptPlan', () => {
  it('sem plano ativo: não arquiva nada, insere o novo como active, grava todos os treinos, limpa rascunho', async () => {
    getActiveMock.mockResolvedValue(ok(null));

    const result = await adoptPlan(plan, USER_ID);

    expect(result.ok).toBe(true);
    expect(upsertPlanMock).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'archived' }));
    expect(upsertPlanMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));

    const expectedWorkoutCount = plan.weeks.reduce((sum, w) => sum + w.workouts.length, 0);
    expect(upsertWorkoutMock).toHaveBeenCalledTimes(expectedWorkoutCount);
    expect(clearDraftMock).toHaveBeenCalledWith(USER_ID);
    expect(invalidateQueriesMock).toHaveBeenCalled();
  });

  it('com plano ativo: arquiva o antigo ANTES de inserir o novo (índice único de 1 plano active)', async () => {
    const activePlan = { id: 'old-plan-id', status: 'active', user_id: USER_ID };
    getActiveMock.mockResolvedValue(ok(activePlan));

    const callOrder: string[] = [];
    upsertPlanMock.mockImplementation((row: { status: string }) => {
      callOrder.push(row.status);
      return Promise.resolve(ok({ id: row.status === 'archived' ? 'old-plan-id' : 'new-plan-id' }));
    });

    const result = await adoptPlan(plan, USER_ID);

    expect(result.ok).toBe(true);
    expect(callOrder).toEqual(['archived', 'active']);
    expect(upsertPlanMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'old-plan-id', status: 'archived' }));
  });

  it('falha ao arquivar o plano ativo → propaga erro e NÃO tenta inserir o novo', async () => {
    getActiveMock.mockResolvedValue(ok({ id: 'old-plan-id', status: 'active' }));
    upsertPlanMock.mockResolvedValueOnce(err({ code: 'storage', message: 'disco cheio' }));

    const result = await adoptPlan(plan, USER_ID);

    expect(result.ok).toBe(false);
    expect(upsertPlanMock).toHaveBeenCalledTimes(1); // só a tentativa de arquivar, não o insert do novo
    expect(clearDraftMock).not.toHaveBeenCalled();
  });

  it('falha ao gravar um treino → propaga erro', async () => {
    getActiveMock.mockResolvedValue(ok(null));
    upsertWorkoutMock.mockResolvedValueOnce(err({ code: 'storage', message: 'falhou' }));

    const result = await adoptPlan(plan, USER_ID);

    expect(result.ok).toBe(false);
    expect(clearDraftMock).not.toHaveBeenCalled();
  });
});
