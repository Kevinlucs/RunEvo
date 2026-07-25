import type { SyncedTable } from '@/db/schema';

/** Tabela sincronizada → prefixos de queryKey que leem dela. */
const QUERY_KEYS_BY_TABLE: Record<SyncedTable, readonly string[]> = {
  athlete_profiles: ['onboarding-seen'],
  training_plans: ['active-plan', 'plan'],
  plan_workouts: ['plan-workouts', 'workout'],
  weekly_checkins: ['plan-checkins'],
  running_shoes: ['shoes'],
  subscriptions: ['entitlement'],
};

/** Achata as tabelas alteradas num ciclo de sync nos prefixos de queryKey a invalidar, sem duplicatas. */
export function keysToInvalidate(changedTables: readonly SyncedTable[]): string[] {
  const keys = new Set<string>();
  for (const table of changedTables) {
    for (const keyPrefix of QUERY_KEYS_BY_TABLE[table]) keys.add(keyPrefix);
  }
  return Array.from(keys);
}
