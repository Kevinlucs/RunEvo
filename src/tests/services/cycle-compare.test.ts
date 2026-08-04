import { compareCycles } from '@/services/history/cycle-compare';
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

describe('compareCycles', () => {
  it('calcula deltas corretos entre dois fixtures (b em relação a a)', () => {
    const a = summary({ peakWeeklyKm: 40, longestRunKm: 14, goalPaceSeconds: 300, qualityScore: 7, adherence: { ...summary().adherence, completionRate: 0.7 } });
    const b = summary({ peakWeeklyKm: 56, longestRunKm: 16, goalPaceSeconds: 282, qualityScore: 8.4, adherence: { ...summary().adherence, completionRate: 0.83 } });

    const result = compareCycles(a, b);

    expect(result.peakWeeklyKm).toEqual({ absolute: 16, percent: 40 });
    expect(result.longestRunKm.absolute).toBeCloseTo(2);
    expect(result.goalPaceSeconds).toEqual({ absolute: -18, percent: -6 });
    expect(result.qualityScore.absolute).toBeCloseTo(1.4);
    expect(result.completionRate.absolute).toBeCloseTo(0.13, 5);
  });

  it('distâncias iguais e salvas → sameRaceDistance true', () => {
    const result = compareCycles(summary({ raceDistanceKm: 21.1 }), summary({ raceDistanceKm: 21.1 }));
    expect(result.sameRaceDistance).toBe(true);
  });

  it('distâncias diferentes → sameRaceDistance false, sem impedir o resto do cálculo', () => {
    const result = compareCycles(summary({ raceDistanceKm: 10 }), summary({ raceDistanceKm: 42.2 }));
    expect(result.sameRaceDistance).toBe(false);
  });

  it('métrica não salva de um dos lados não é inventada — delta vem null, não 0', () => {
    const a = summary({ qualityScore: null });
    const b = summary({ qualityScore: 8 });

    const result = compareCycles(a, b);

    expect(result.qualityScore).toEqual({ absolute: null, percent: null });
  });

  it('base 0 não divide por zero — percent vem null, absolute continua calculado', () => {
    const a = summary({ longestRunKm: 0 });
    const b = summary({ longestRunKm: 10 });

    const result = compareCycles(a, b);

    expect(result.longestRunKm).toEqual({ absolute: 10, percent: null });
  });
});
