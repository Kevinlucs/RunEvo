import { buildWeekMeta, groupWeeksByPhase } from '@/services/plan/plan-cycle.service';
import type { TrainingPlan, Workout } from '@/domain/entities';

function plan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: 'plan-1',
    user_id: 'user-1',
    plan_name: 'Plano 5K',
    race_name: 'Corrida X',
    race_distance_km: 5,
    start_date: '2026-01-05',
    race_date: '2026-03-30',
    total_weeks: 3,
    days_per_week: 3,
    objective: null,
    terrain: 'plano',
    status: 'active',
    user_data: {},
    blueprint: {},
    validation: {
      summary: { recoveryWeeks: ['S2'], taperWeeks: ['S3'], raceWeek: 'S3' },
    } as unknown as Record<string, unknown>,
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

describe('buildWeekMeta', () => {
  it('agrega km/contagem por semana e marca recuperação, taper, prova e semana corrente', () => {
    const workouts = [
      workout({ id: 'w1', week_number: 1, phase: 'Base', planned_km: 5 }),
      workout({ id: 'w2', week_number: 1, phase: 'Base', planned_km: 4 }),
      workout({ id: 'w3', week_number: 2, phase: 'Base', planned_km: 3 }),
      workout({ id: 'w4', week_number: 3, phase: 'Polimento', planned_km: 2 }),
    ];
    const meta = buildWeekMeta(plan(), workouts, 2);

    expect(meta).toHaveLength(3);
    expect(meta[0]).toMatchObject({ weekNumber: 1, totalKm: 9, workoutCount: 2, isRecovery: false, isCurrent: false });
    expect(meta[1]).toMatchObject({ weekNumber: 2, isRecovery: true, isCurrent: true, isRace: false });
    expect(meta[2]).toMatchObject({ weekNumber: 3, isTaper: true, isRace: true });
  });

  it('sem validation.summary (plano antigo/sem dados) não quebra — nenhuma semana marcada', () => {
    const meta = buildWeekMeta(plan({ validation: {} }), [workout({ week_number: 1 })], null);
    expect(meta[0]).toMatchObject({ isRecovery: false, isTaper: false, isRace: false, isCurrent: false });
  });
});

describe('groupWeeksByPhase', () => {
  it('agrupa semanas consecutivas da mesma fase em um único grupo', () => {
    const workouts = [
      workout({ id: 'w1', week_number: 1, phase: 'Base' }),
      workout({ id: 'w2', week_number: 2, phase: 'Base' }),
      workout({ id: 'w3', week_number: 3, phase: 'Resistência' }),
      workout({ id: 'w4', week_number: 4, phase: 'Polimento' }),
    ];
    const meta = buildWeekMeta(plan(), workouts, null);
    const groups = groupWeeksByPhase(meta);

    expect(groups.map((g) => g.phase)).toEqual(['Base', 'Resistência', 'Polimento']);
    expect(groups[0]?.weeks).toHaveLength(2);
  });

  it('fases não-consecutivas com o mesmo nome viram grupos separados (preserva a ordem do ciclo)', () => {
    const workouts = [
      workout({ id: 'w1', week_number: 1, phase: 'Base' }),
      workout({ id: 'w2', week_number: 2, phase: 'Resistência' }),
      workout({ id: 'w3', week_number: 3, phase: 'Base' }),
    ];
    const meta = buildWeekMeta(plan(), workouts, null);
    const groups = groupWeeksByPhase(meta);
    expect(groups).toHaveLength(3);
  });
});
