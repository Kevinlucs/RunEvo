/**
 * Fase 3 §2.2/§2.3 — buildBlueprintPrompt e normalizeBlueprint, adicionadas a
 * src/domain/motor-evo/blueprint.ts (débito documentado da Fase 2; motor
 * reaberto pontualmente com aprovação — ver docs/fase-3-brief.md).
 * Mesma fidelidade 1:1 + verificação empírica dos Grupos A-F.
 */
import { getLegacyInternals, loadLegacyAICoach } from './legacy-harness';
import { buildBlueprintPrompt, normalizeBlueprint } from '../../domain/motor-evo/blueprint';
import { fixtures } from './fixtures';

describe('buildBlueprintPrompt vs. legado (AICoach.buildPrompt)', () => {
  const legacy = loadLegacyAICoach();

  it.each(fixtures)('$id — prompt idêntico ao legado', (fixture) => {
    const newPrompt = buildBlueprintPrompt(fixture.input);
    const legacyPrompt = legacy.buildPrompt(fixture.input as never);
    expect(newPrompt).toBe(legacyPrompt);
  });
});

describe('normalizeBlueprint vs. legado (respostas de IA sintéticas)', () => {
  const legacy = getLegacyInternals();

  const goodRaw = {
    athleteAnalysis: {
      detectedLevel: 'intermediário — bom histórico',
      riskLevel: 'baixo',
      goalFeasibility: 'viável',
      mainStrength: 'boa base aeróbica',
      mainWeakness: 'pouca experiência em provas longas',
      focus: 'resistência e consistência',
      coachSummary: 'plano equilibrado considerando teste de 3km e objetivo.',
    },
    strategy: {
      initialWeeklyKm: 25,
      peakWeeklyKm: 55,
      initialLongRunKm: 8,
      peakLongRunKm: 20,
      recoveryEveryWeeks: 4,
      taperWeeks: 2,
    },
    paceZones: { easy: '6:40/km-7:20/km' },
    phaseDistribution: [
      { phase: 'Base', startWeek: 1, endWeek: 4 },
      { phase: 'Resistência', startWeek: 5, endWeek: 6 },
      { phase: 'Pico', startWeek: 7, endWeek: 7 },
      { phase: 'Polimento', startWeek: 8, endWeek: 8 },
    ],
    warnings: ['respeite sinais de dor', 'hidrate-se bem'],
    engineCalibration: { progressionStyle: 'equilibrada', recoveryPriority: 'média', intensityBias: 'moderado' },
  };

  const absurdRaw = {
    athleteAnalysis: { riskLevel: 'muito alto' },
    strategy: {
      initialWeeklyKm: -500,
      peakWeeklyKm: 999999,
      initialLongRunKm: 0,
      peakLongRunKm: -10,
      recoveryEveryWeeks: 999,
      taperWeeks: -5,
    },
    phaseDistribution: [{ phase: 'Base', startWeek: 1, endWeek: 999 }],
    warnings: Array.from({ length: 20 }, (_, i) => `alerta ${i} `.repeat(30)),
    engineCalibration: { progressionStyle: 'INVALIDO123' },
  };

  const rawCases: [string, unknown][] = [
    ['boa', goodRaw],
    ['números absurdos', absurdRaw],
    ['incompleta ({})', {}],
    ['ausente (null)', null],
  ];

  describe.each(fixtures)('$id', (fixture) => {
    it.each(rawCases)('resposta %s — idêntica ao legado', (_label, raw) => {
      const newResult = normalizeBlueprint(raw as never, fixture.input, 'ai');
      const legacyResult = legacy.normalizeBlueprint(raw as never, fixture.input as never, 'ai' as never);
      expect(newResult).toEqual(legacyResult);
    });
  });
});
