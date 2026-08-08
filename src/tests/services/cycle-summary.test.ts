import { buildCycleSummary } from '@/services/history/cycle-summary';
import type { TrainingPlan, Workout } from '@/domain/entities';

function plan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: 'plan-1',
    user_id: 'user-1',
    plan_name: 'Plano 10K',
    race_name: 'Corrida da Cidade',
    race_distance_km: 10,
    start_date: '2026-01-05',
    race_date: '2026-03-01',
    total_weeks: 8,
    days_per_week: 4,
    objective: 'sub 50',
    terrain: 'plano',
    status: 'archived',
    user_data: {},
    blueprint: {
      paceZones: {
        easy: 'Z1',
        moderate: 'Z2',
        threshold: 'Z3',
        interval: 'Z4',
        long: 'Z1',
        racePace: 'Ritmo de prova',
        trainingZones: null,
        zoneMethod: 'vdot',
        goalContext: { goalPace: 300 },
      },
    } as unknown as Record<string, unknown>,
    validation: {
      summary: {
        peakWeeklyKm: 45,
        biggestTrainingLongRunKm: 16,
        qualityScore: 8.5,
        qualityStatus: 'boa',
      },
    } as unknown as Record<string, unknown>,
    quality: { overall: 8.5, status: 'boa' } as unknown as Record<string, unknown>,
    risk: { level: 'baixo', points: 2, reasons: ['progressão suave'] },
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

describe('buildCycleSummary', () => {
  it('extrai as métricas de um plano fixture sem recalcular nada (só leitura dos campos já salvos)', () => {
    const workouts: Workout[] = [
      workout({ id: 'w-1', status: 'completed', planned_km: 5, completed_km: 5 }),
      workout({ id: 'w-2', status: 'completed', planned_km: 8, completed_km: 7.5 }),
      workout({ id: 'w-3', status: 'pending', planned_km: 6, completed_km: null }),
      workout({ id: 'w-race', title: 'Prova alvo', status: 'completed', planned_km: 10, completed_km: 10 }),
    ];

    const summary = buildCycleSummary(plan(), workouts);

    expect(summary).toMatchObject({
      planId: 'plan-1',
      raceName: 'Corrida da Cidade',
      raceDistanceKm: 10,
      raceDate: '2026-03-01',
      totalWeeks: 8,
      daysPerWeek: 4,
      peakWeeklyKm: 45,
      longestRunKm: 16,
      qualityScore: 8.5,
      qualityStatus: 'boa',
      riskLevel: 'baixo',
      riskPoints: 2,
      riskReasons: ['progressão suave'],
      goalPaceSeconds: 300,
      raceCompleted: true,
    });
    expect(summary.paceZones?.zoneMethod).toBe('vdot');
    expect(summary.adherence).toEqual({
      completedWorkouts: 3,
      totalWorkouts: 4,
      completionRate: 0.75,
      plannedKm: 29,
      completedKm: 22.5,
      kmRate: 22.5 / 29,
    });
  });

  it('usa os aliases de pico/longão quando o campo primário não está salvo (fingerprint.ts:135-139)', () => {
    const withAliases = plan({
      validation: {
        summary: { peakWeekKm: 40, peakTrainingLongRunKm: 14 },
      } as unknown as Record<string, unknown>,
    });

    const summary = buildCycleSummary(withAliases, []);

    expect(summary.peakWeeklyKm).toBe(40);
    expect(summary.longestRunKm).toBe(14);
  });

  it('plano sem workouts salvos: aderência null em vez de dividir por zero', () => {
    const summary = buildCycleSummary(plan(), []);

    expect(summary.adherence).toEqual({
      completedWorkouts: 0,
      totalWorkouts: 0,
      completionRate: null,
      plannedKm: 0,
      completedKm: 0,
      kmRate: null,
    });
    expect(summary.raceCompleted).toBeNull();
  });

  it('métrica não salva (sem validation.summary/quality/blueprint) não é inventada — vem null', () => {
    const bare = plan({ validation: {}, quality: {}, risk: {}, blueprint: {} });

    const summary = buildCycleSummary(bare, []);

    expect(summary.peakWeeklyKm).toBeNull();
    expect(summary.longestRunKm).toBeNull();
    expect(summary.qualityScore).toBeNull();
    expect(summary.qualityStatus).toBeNull();
    expect(summary.riskLevel).toBeNull();
    expect(summary.goalPaceSeconds).toBeNull();
    expect(summary.paceZones).toBeNull();
  });
});
