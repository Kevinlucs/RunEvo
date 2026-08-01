import { computeWeeklyStats, computeWeeksStreak, classifyImc, type WeeklyStatPoint } from '@/services/stats/stats.service';
import type { Workout } from '@/domain/entities';

function mkWorkout(overrides: Partial<Workout>): Workout {
  return {
    id: `w-${Math.random()}`,
    plan_id: 'plan-1',
    user_id: 'user-1',
    week_number: 1,
    week_index: 0,
    phase: 'Base',
    workout_date: null,
    day_label: 'Segunda',
    day_type: 'Base',
    title: 'Treino',
    description: '',
    planned_km: 5,
    planned_pace: '6:00/km',
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

describe('computeWeeklyStats', () => {
  it('agrega km planejado/realizado por semana, sem duplicar semanas', () => {
    const workouts = [
      mkWorkout({ week_number: 1, planned_km: 5, status: 'completed', completed_km: 5 }),
      mkWorkout({ week_number: 1, planned_km: 3, status: 'completed', completed_km: 3 }),
      mkWorkout({ week_number: 2, planned_km: 6, status: 'pending' }),
    ];
    const result = computeWeeklyStats(workouts);
    expect(result.map((w) => w.weekNumber)).toEqual([1, 2]);
    expect(result[0]).toMatchObject({ label: 'S1', plannedKm: 8, completedKm: 8, total: 2, resolved: 2, skipped: 0 });
    expect(result[1]).toMatchObject({ label: 'S2', plannedKm: 6, completedKm: 0, total: 1, resolved: 0 });
  });
});

describe('computeWeeksStreak', () => {
  const week = (overrides: Partial<WeeklyStatPoint>): WeeklyStatPoint => ({
    weekNumber: 1,
    label: 'S1',
    plannedKm: 10,
    completedKm: 10,
    completionRate: 1,
    resolved: 3,
    total: 3,
    skipped: 0,
    ...overrides,
  });

  it('conta semanas perfeitas consecutivas de trás para frente', () => {
    const weeks = [week({ weekNumber: 1 }), week({ weekNumber: 2 }), week({ weekNumber: 3 })];
    expect(computeWeeksStreak(weeks)).toBe(3);
  });

  it('para na primeira semana (de trás pra frente) com treino pulado', () => {
    const weeks = [
      week({ weekNumber: 1, skipped: 1, resolved: 3 }),
      week({ weekNumber: 2 }),
      week({ weekNumber: 3 }),
    ];
    expect(computeWeeksStreak(weeks)).toBe(2);
  });

  it('semana ainda em andamento (atual) não conta nem quebra o streak anterior', () => {
    const weeks = [week({ weekNumber: 1 }), week({ weekNumber: 2 }), week({ weekNumber: 3, resolved: 1, total: 3 })];
    expect(computeWeeksStreak(weeks)).toBe(2);
  });

  it('semana sem treino (off) não conta nem quebra', () => {
    const weeks = [week({ weekNumber: 1 }), week({ weekNumber: 2, total: 0, resolved: 0 }), week({ weekNumber: 3 })];
    expect(computeWeeksStreak(weeks)).toBe(2);
  });

  it('sem semanas resolvidas → streak 0', () => {
    expect(computeWeeksStreak([])).toBe(0);
  });
});

describe('classifyImc (docs/legacy-audit.md §13.1, texto idêntico ao legado)', () => {
  it.each([
    [null, '-'],
    [18.0, 'Abaixo do normal'],
    [22.0, 'Normal'],
    [26.1, 'Sobrepeso'],
    [32.0, 'Obesidade grau I'],
    [37.0, 'Obesidade grau II'],
    [42.0, 'Obesidade grau III'],
  ])('imc=%s → %s', (imc, expected) => {
    expect(classifyImc(imc)).toBe(expected);
  });
});
