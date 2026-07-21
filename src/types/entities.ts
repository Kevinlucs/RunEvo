// Entidades de domínio da aplicação (nível de app, acima do banco).
// O contrato completo do Motor RunEvo virá em src/domain/motor-evo/types.ts (Fase 2).
import type { Tables } from './database.types';

export type AthleteProfile = Tables<'athlete_profiles'>;
export type TrainingPlan = Tables<'training_plans'>;
export type PlanWorkout = Tables<'plan_workouts'>;
export type WeeklyCheckin = Tables<'weekly_checkins'>;
export type RunningShoe = Tables<'running_shoes'>;
export type Subscription = Tables<'subscriptions'>;

export type Plan = 'free' | 'plus';

export interface Entitlement {
  plan: Plan;
  status: Subscription['status'];
  periodEnd: string | null;
}
