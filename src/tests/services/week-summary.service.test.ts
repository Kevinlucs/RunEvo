import { summarizeWorkoutsForWeek } from '@/services/plan/week-summary.service';
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

describe('summarizeWorkoutsForWeek', () => {
  it('filtra só os treinos da semana pedida antes de agregar', () => {
    const workouts = [
      workout({ week_number: 1, status: 'completed', completed_km: 5, planned_km: 5 }),
      workout({ week_number: 2, status: 'pending', planned_km: 8 }),
    ];
    const summary = summarizeWorkoutsForWeek(workouts, 1);
    expect(summary.total).toBe(1);
    expect(summary.plannedKm).toBe(5);
    expect(summary.status).toBe('done');
  });

  it('semana sem treinos → summary vazio (total 0, pending)', () => {
    const summary = summarizeWorkoutsForWeek([workout({ week_number: 1 })], 2);
    expect(summary.total).toBe(0);
    expect(summary.status).toBe('pending');
  });
});
