import { pickNextWorkout } from '@/services/plan/next-workout.service';
import type { Workout } from '@/domain/entities';

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: overrides.id ?? 'w-1',
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

describe('pickNextWorkout', () => {
  const today = new Date('2026-01-10T12:00:00');

  it('escolhe o primeiro pending com data >= hoje, ignorando completed/skipped', () => {
    const workouts = [
      workout({ id: 'done', workout_date: '2026-01-08', status: 'completed' }),
      workout({ id: 'skipped', workout_date: '2026-01-09', status: 'skipped' }),
      workout({ id: 'far', workout_date: '2026-01-15', status: 'pending' }),
      workout({ id: 'near', workout_date: '2026-01-10', status: 'pending' }),
    ];
    expect(pickNextWorkout(workouts, today)?.id).toBe('near');
  });

  it('sem pending futuro: escolhe o pending atrasado mais recente', () => {
    const workouts = [
      workout({ id: 'old', workout_date: '2026-01-01', status: 'pending' }),
      workout({ id: 'less-old', workout_date: '2026-01-05', status: 'pending' }),
      workout({ id: 'done', workout_date: '2026-01-09', status: 'completed' }),
    ];
    expect(pickNextWorkout(workouts, today)?.id).toBe('less-old');
  });

  it('sem nenhum pending → null (plano concluído)', () => {
    const workouts = [
      workout({ id: 'a', status: 'completed' }),
      workout({ id: 'b', status: 'skipped' }),
    ];
    expect(pickNextWorkout(workouts, today)).toBeNull();
  });

  it('lista vazia → null', () => {
    expect(pickNextWorkout([], today)).toBeNull();
  });
});
