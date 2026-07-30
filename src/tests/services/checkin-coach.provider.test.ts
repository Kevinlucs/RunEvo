/**
 * Testes headless do CheckinCoachProvider (docs/fase-5-brief.md Grupo 1).
 * `@/lib/supabase` depende de expo-constants/expo-secure-store (runtime
 * RN/Metro) — mockado aqui, fora do alcance do ts-jest genérico.
 */
/* eslint-disable import/first */
const invokeMock = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: invokeMock } } }));

import { remoteCheckinCoachProvider } from '@/services/ai/checkin-coach.provider';
import type { CheckinCoachRequest } from '@/services/ai/checkin-coach.schema';
/* eslint-enable import/first */

const input: CheckinCoachRequest = {
  weekNumber: 3,
  summary: { total: 4, resolved: 4, completedKm: 30, plannedKm: 32, averageEffort: 6, completionRate: 1 },
  feedback: { effort: 6, feeling: 'normal', pain: false, notes: '' },
  planContext: { raceType: '10km', phase: 'Base', weeksToRace: 8 },
};

const validRecommendation = {
  action: 'maintain',
  adjustmentPercent: 0,
  weeksToAdjust: 1,
  reason: 'Semana dentro do esperado.',
  coachTip: 'Hidrate-se bem.',
  messageToUser: 'Boa semana, siga assim.',
  confidence: 'alta',
};

beforeEach(() => {
  invokeMock.mockReset();
});

describe('remoteCheckinCoachProvider', () => {
  it('IA válida → devolve a recomendação (para normalizeAICheckinRecommendation decidir)', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, recommendation: validRecommendation }, error: null });

    const suggestion = await remoteCheckinCoachProvider.suggest(input);
    expect(suggestion).toMatchObject({ action: 'maintain', confidence: 'alta' });
  });

  it('resposta fora do contrato Zod (tipo errado) → lança', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, recommendation: { ...validRecommendation, action: 'invalido' } },
      error: null,
    });
    await expect(remoteCheckinCoachProvider.suggest(input)).rejects.toThrow();
  });

  it('resposta sem success:true → lança', async () => {
    invokeMock.mockResolvedValue({ data: { error: 'Resposta da IA fora do contrato esperado.' }, error: null });
    await expect(remoteCheckinCoachProvider.suggest(input)).rejects.toThrow();
  });

  it('invoke rejeita (fora do ar) → lança', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('network down') });
    await expect(remoteCheckinCoachProvider.suggest(input)).rejects.toThrow();
  });

  it('timeout (edge function retorna 504/erro) → lança', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('Tempo limite excedido ao gerar resposta com a IA.') });
    await expect(remoteCheckinCoachProvider.suggest(input)).rejects.toThrow();
  });
});
