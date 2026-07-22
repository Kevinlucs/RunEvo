/**
 * Testes headless (sem UI) do PlanBlueprintProvider — docs/fase-3-brief.md
 * §2.3. `@/lib/supabase` depende de expo-constants/expo-secure-store (runtime
 * RN/Metro) — mockado aqui, fora do alcance do ts-jest genérico.
 */
/* eslint-disable import/first */
const invokeMock = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: invokeMock } } }));

import {
  remoteBlueprintProvider,
  localBlueprintProvider,
  resolveBlueprint,
  type PlanBlueprintProvider,
} from '@/services/ai/plan-blueprint.provider';
import { fixtures } from '../motor-evo/fixtures';
/* eslint-enable import/first */

const input = fixtures.find((f) => f.id === 'f01')!.input;

const validAIText = JSON.stringify({
  athleteAnalysis: {
    detectedLevel: 'intermediário',
    riskLevel: 'baixo',
    goalFeasibility: 'viável',
    mainStrength: 'boa base',
    mainWeakness: 'pouca experiência',
    focus: 'consistência',
    coachSummary: 'resumo técnico curto.',
  },
  strategy: {
    initialWeeklyKm: 20,
    peakWeeklyKm: 45,
    initialLongRunKm: 6,
    peakLongRunKm: 15,
    recoveryEveryWeeks: 4,
    taperWeeks: 2,
  },
  paceZones: { easy: '6:40/km-7:20/km' },
  phaseDistribution: [
    { phase: 'Base', startWeek: 1, endWeek: 3 },
    { phase: 'Resistência', startWeek: 4, endWeek: 5 },
    { phase: 'Pico', startWeek: 6, endWeek: 6 },
    { phase: 'Polimento', startWeek: 7, endWeek: 8 },
  ],
  warnings: ['respeite sinais de dor'],
  engineCalibration: { progressionStyle: 'equilibrada', recoveryPriority: 'média', intensityBias: 'moderado' },
});

beforeEach(() => {
  invokeMock.mockReset();
});

describe('remoteBlueprintProvider', () => {
  it('IA válida → source "ai", valores clampados pelos limites de segurança', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, model: 'gemini-2.5-flash', text: validAIText }, error: null });

    const blueprint = await remoteBlueprintProvider.generate(input);
    expect(blueprint.source).toBe('ai');
    expect(blueprint.strategy.peakWeeklyKm).toBeGreaterThan(0);
    expect(blueprint.strategy.peakLongRunKm).toBeGreaterThan(0);
  });

  it('IA com JSON inválido → lança (resolveBlueprint decide o fallback)', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, model: 'gemini-2.5-flash', text: '{ isto não é json' }, error: null });
    await expect(remoteBlueprintProvider.generate(input)).rejects.toThrow();
  });

  it('resposta reprovada pelo Zod (tipo errado) → lança', async () => {
    const badText = JSON.stringify({
      athleteAnalysis: { riskLevel: 'baixíssimo' }, // fora do enum
      strategy: { initialWeeklyKm: 'vinte' }, // deveria ser number
    });
    invokeMock.mockResolvedValue({ data: { success: true, model: 'gemini-2.5-flash', text: badText }, error: null });
    await expect(remoteBlueprintProvider.generate(input)).rejects.toThrow();
  });

  it('invoke rejeita (fora do ar) → lança', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('network down') });
    await expect(remoteBlueprintProvider.generate(input)).rejects.toThrow();
  });

  it('timeout (edge function retorna 504/erro) → lança', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('Tempo limite excedido ao gerar resposta com a IA.') });
    await expect(remoteBlueprintProvider.generate(input)).rejects.toThrow();
  });
});

describe('resolveBlueprint — fallback local obrigatório (docs/fase-3-brief.md §0.4)', () => {
  it('remoto ok → usa o remoto (source "ai")', async () => {
    const remote: PlanBlueprintProvider = { generate: jest.fn().mockResolvedValue({ source: 'ai' }) };
    const local: PlanBlueprintProvider = { generate: jest.fn() };

    const result = await resolveBlueprint(input, remote, local);
    expect(result).toEqual({ source: 'ai' });
    expect(local.generate).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON inválido', new SyntaxError('Unexpected token')],
    ['timeout', new Error('Tempo limite excedido ao gerar resposta com a IA.')],
    ['fora do ar', new Error('network down')],
    ['Zod reprovou', new Error('Invalid input')],
  ])('%s → cai no local, nunca lança para o chamador', async (_label, thrownError) => {
    const remote: PlanBlueprintProvider = { generate: jest.fn().mockRejectedValue(thrownError) };
    const local: PlanBlueprintProvider = { generate: jest.fn().mockResolvedValue({ source: 'local' }) };

    const result = await resolveBlueprint(input, remote, local);
    expect(result).toEqual({ source: 'local' });
    expect(local.generate).toHaveBeenCalledWith(input);
  });

  it('usa localBlueprintProvider (buildFallbackBlueprint real) por padrão', async () => {
    const remote: PlanBlueprintProvider = { generate: jest.fn().mockRejectedValue(new Error('fail')) };
    const result = await resolveBlueprint(input, remote, localBlueprintProvider);
    expect(result.source).toBe('local');
    expect(result.strategy.peakWeeklyKm).toBeGreaterThan(0);
  });
});
