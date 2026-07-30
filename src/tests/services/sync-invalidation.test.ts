import { keysToInvalidate } from '@/services/sync/invalidation';

describe('keysToInvalidate', () => {
  it('mapeia cada tabela alterada para os prefixos de queryKey que dependem dela', () => {
    expect(keysToInvalidate(['athlete_profiles'])).toEqual(['onboarding-seen']);
    expect(keysToInvalidate(['training_plans'])).toEqual(['active-plan', 'plan']);
    expect(keysToInvalidate(['plan_workouts'])).toEqual(['plan-workouts', 'workout']);
    expect(keysToInvalidate(['weekly_checkins'])).toEqual(['plan-checkins']);
    expect(keysToInvalidate(['running_shoes'])).toEqual(['shoes']);
    expect(keysToInvalidate(['subscriptions'])).toEqual(['entitlement']);
  });

  it('combina múltiplas tabelas sem duplicar prefixos', () => {
    const keys = keysToInvalidate(['training_plans', 'plan_workouts']);
    expect(keys).toEqual(expect.arrayContaining(['active-plan', 'plan', 'plan-workouts', 'workout']));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('nenhuma tabela alterada → nada a invalidar', () => {
    expect(keysToInvalidate([])).toEqual([]);
  });
});
