import { computePlanProgress } from '@/services/plan/plan-progress.service';
import type { Workout } from '@/domain/entities';

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

describe('computePlanProgress', () => {
  it('soma só completed_km dos concluídos; planejado soma tudo', () => {
    const workouts = [
      workout({ status: 'completed', completed_km: 4.5, planned_km: 5 }),
      workout({ status: 'skipped', planned_km: 5 }),
      workout({ status: 'pending', planned_km: 6 }),
    ];
    const progress = computePlanProgress(workouts, null);
    expect(progress.completedKm).toBe(4.5);
    expect(progress.plannedKm).toBe(16);
    expect(progress.completedWorkouts).toBe(1);
    expect(progress.totalWorkouts).toBe(3);
  });

  it('completed sem completed_km registrado cai para planned_km (fallback)', () => {
    const workouts = [workout({ status: 'completed', completed_km: null, planned_km: 5 })];
    expect(computePlanProgress(workouts, null).completedKm).toBe(5);
  });

  it('sem race_date → daysRemaining null', () => {
    expect(computePlanProgress([], null).daysRemaining).toBeNull();
  });

  it('com race_date → dias restantes até a prova', () => {
    const today = new Date('2026-01-01T15:00:00');
    const progress = computePlanProgress([], '2026-01-11', today);
    expect(progress.daysRemaining).toBe(10);
  });

  it('prova já passou → daysRemaining negativo', () => {
    const today = new Date('2026-01-15T00:00:00');
    const progress = computePlanProgress([], '2026-01-10', today);
    expect(progress.daysRemaining).toBe(-5);
  });
});
