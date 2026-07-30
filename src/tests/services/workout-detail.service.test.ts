import { readTrainingZones, splitWorkoutDescription, isRaceWorkout } from '@/services/workout/workout-detail.service';
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
    validation: {},
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

const trainingZonesFixture = {
  anchor: { label: 'Teste 3km', pace: '6:00', speed: '10', method: 'capacity_anchored' as const },
  Z1: { label: 'Z1', name: 'Leve', perception: 'fácil', from: '6:30', to: '7:00', speedFrom: '8.5', speedTo: '9.2' },
  Z2: { label: 'Z2', name: 'Moderado', perception: 'confortável', from: '6:00', to: '6:30', speedFrom: '9.2', speedTo: '10' },
  Z3: { label: 'Z3', name: 'Forte', perception: 'forte', from: '5:30', to: '6:00', speedFrom: '10', speedTo: '11' },
  Z4: { label: 'Z4', name: 'Muito forte', perception: 'muito forte', from: '5:00', to: '5:30', speedFrom: '11', speedTo: '12' },
  Z5: { label: 'Z5', name: 'Máximo', perception: 'máximo', from: '4:30', to: '5:00', speedFrom: '12', speedTo: '13' },
};

describe('readTrainingZones', () => {
  // TrainingPlanRepository já desserializa `blueprint` (jsonColumns do
  // BaseRepository — ver base.repository.test.ts); aqui só o cast de tipo.
  it('lê trainingZones do blueprint já desserializado', () => {
    const p = plan({ blueprint: { paceZones: { trainingZones: trainingZonesFixture } } as unknown as Record<string, unknown> });
    expect(readTrainingZones(p)?.Z1.label).toBe('Z1');
    expect(readTrainingZones(p)?.anchor.method).toBe('capacity_anchored');
  });

  it('sem blueprint/paceZones (plano antigo/sem dados) retorna null — não quebra', () => {
    expect(readTrainingZones(plan({ blueprint: {} }))).toBeNull();
  });
});

describe('splitWorkoutDescription', () => {
  it('divide a prescrição em linhas, removendo vazias e espaços', () => {
    expect(splitWorkoutDescription('1km em Z1\n3km em Z3\n1km em Z1')).toEqual([
      '1km em Z1',
      '3km em Z3',
      '1km em Z1',
    ]);
  });

  it('lida com \\n literal (escapado) e linhas em branco extras', () => {
    expect(splitWorkoutDescription('1km em Z1\\n\\n2km em Z2')).toEqual(['1km em Z1', '2km em Z2']);
  });

  it('descrição vazia/nula retorna lista vazia', () => {
    expect(splitWorkoutDescription(null)).toEqual([]);
    expect(splitWorkoutDescription('')).toEqual([]);
  });
});

describe('isRaceWorkout', () => {
  it('reconhece o treino da prova pelo título fixo atribuído pelo motor', () => {
    expect(isRaceWorkout(workout({ title: 'Prova alvo' }))).toBe(true);
  });

  it('qualquer outro título não é treino de prova', () => {
    expect(isRaceWorkout(workout({ title: 'Longão' }))).toBe(false);
  });
});
