import {
  chronological,
  buildPeakVolumeSeries,
  buildAdherenceSeries,
  buildQualitySeries,
  buildPaceSeries,
  buildEvolutionSynthesis,
} from '@/services/history/cycle-evolution';
import type { CycleSummary } from '@/services/history/cycle-summary';

function summary(overrides: Partial<CycleSummary> = {}): CycleSummary {
  return {
    planId: 'p',
    raceName: 'Corrida',
    raceDistanceKm: 10,
    raceDate: '2026-01-01',
    totalWeeks: 8,
    daysPerWeek: 3,
    peakWeeklyKm: 40,
    longestRunKm: 14,
    qualityScore: 7,
    qualityStatus: 'boa',
    riskLevel: 'baixo',
    riskPoints: 1,
    riskReasons: [],
    goalPaceSeconds: 300,
    paceZones: null,
    adherence: { completedWorkouts: 8, totalWorkouts: 10, completionRate: 0.8, plannedKm: 100, completedKm: 90, kmRate: 0.9 },
    raceCompleted: true,
    ...overrides,
  };
}

describe('chronological', () => {
  it('ordena do ciclo mais antigo para o mais recente (listArchived vem no sentido oposto)', () => {
    const cycles = [summary({ planId: 'c', raceDate: '2026-06-01' }), summary({ planId: 'a', raceDate: '2025-01-01' }), summary({ planId: 'b', raceDate: '2025-06-01' })];
    expect(chronological(cycles).map((c) => c.planId)).toEqual(['a', 'b', 'c']);
  });
});

describe('buildPeakVolumeSeries / buildAdherenceSeries / buildQualitySeries / buildPaceSeries', () => {
  it('com 3 ciclos, traça a série cronológica com os valores já salvos', () => {
    const cycles = [
      summary({ planId: 'c3', raceDate: '2026-06-01', peakWeeklyKm: 56, qualityScore: 8.4, goalPaceSeconds: 282, adherence: { ...summary().adherence, completionRate: 0.83 } }),
      summary({ planId: 'c1', raceDate: '2025-01-01', peakWeeklyKm: 40, qualityScore: 7, goalPaceSeconds: 300, adherence: { ...summary().adherence, completionRate: 0.7 } }),
      summary({ planId: 'c2', raceDate: '2025-06-01', peakWeeklyKm: 48, qualityScore: 7.8, goalPaceSeconds: 291, adherence: { ...summary().adherence, completionRate: 0.76 } }),
    ];

    expect(buildPeakVolumeSeries(cycles).map((p) => p.value)).toEqual([40, 48, 56]);
    expect(buildQualitySeries(cycles).map((p) => p.value)).toEqual([7, 7.8, 8.4]);
    expect(buildAdherenceSeries(cycles).map((p) => p.value)).toEqual([70, 76, 83]);
    expect(buildPaceSeries(cycles).map((p) => p.value)).toEqual([5, 4.9, 4.7]);
  });

  it('ciclo sem a métrica salva é excluído da série, não vira 0 (não inventa valor)', () => {
    const cycles = [summary({ planId: 'c1', raceDate: '2025-01-01', qualityScore: null }), summary({ planId: 'c2', raceDate: '2025-06-01', qualityScore: 8 })];

    const series = buildQualitySeries(cycles);

    expect(series).toEqual([{ label: expect.any(String), value: 8 }]);
  });

  it('1 ciclo só: série tem um único ponto (tela decide a mensagem de estado insuficiente)', () => {
    const series = buildPeakVolumeSeries([summary()]);
    expect(series).toHaveLength(1);
  });
});

describe('buildEvolutionSynthesis', () => {
  it('com 3 ciclos, gera a frase com os valores batendo com o primeiro e o último cronológicos', () => {
    const cycles = [
      summary({ planId: 'c3', raceDate: '2026-06-01', goalPaceSeconds: 292 }),
      summary({ planId: 'c1', raceDate: '2025-01-01', goalPaceSeconds: 310 }),
      summary({ planId: 'c2', raceDate: '2025-06-01', goalPaceSeconds: 300 }),
    ];

    expect(buildEvolutionSynthesis(cycles)).toBe('Em 3 ciclos, seu pace-alvo evoluiu de 5:10/km para 4:52/km.');
  });

  it('menos de 2 ciclos com pace-alvo salvo: null, não fabrica frase', () => {
    expect(buildEvolutionSynthesis([summary({ goalPaceSeconds: null })])).toBeNull();
    expect(buildEvolutionSynthesis([summary()])).toBeNull();
  });
});
