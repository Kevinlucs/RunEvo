import { BaseRepository } from './base.repository';
import { workoutRepository } from './workout.repository';
import { getDb } from '@/db/sqlite';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { TrainingPlan, Workout } from '@/domain/entities';

export interface ArchivedCycle {
  plan: TrainingPlan;
  workouts: Workout[];
}

class TrainingPlanRepository extends BaseRepository<TrainingPlan> {
  protected table = 'training_plans';
  protected override jsonColumns = ['user_data', 'blueprint', 'validation', 'quality', 'risk'] as const;

  /** Plano ativo do usuário (regra Free: 1 ativo — garantido por índice no banco). */
  async getActive(userId: string): Promise<Result<TrainingPlan | null>> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<TrainingPlan>(
        `SELECT * FROM ${this.table} WHERE user_id = ? AND status = 'active' AND _deleted = 0 LIMIT 1`,
        [userId],
      );
      return ok(row ? this.deserialize(row) : null);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /**
   * docs/fase-7-5-brief.md Grupo 1 — ciclos arquivados do usuário (histórico),
   * mais recente primeiro por `race_date`. `adoptPlan` (Fase 3) já arquiva o
   * plano anterior (`status='archived'`, nunca delete) antes de ativar o novo.
   */
  async listArchived(userId: string): Promise<Result<TrainingPlan[]>> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<TrainingPlan>(
        `SELECT * FROM ${this.table} WHERE user_id = ? AND status = 'archived' AND _deleted = 0 ORDER BY race_date DESC`,
        [userId],
      );
      return ok(this.deserializeRows(rows));
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Um ciclo (plano + seus workouts) para detalhe/resumo de histórico. */
  async getById(planId: string): Promise<Result<ArchivedCycle | null>> {
    const planRes = await this.findById(planId);
    if (!planRes.ok) return err(planRes.error);
    if (!planRes.value) return ok(null);

    const workoutsRes = await workoutRepository.listByPlan(planId);
    if (!workoutsRes.ok) return err(workoutsRes.error);

    return ok({ plan: planRes.value, workouts: workoutsRes.value });
  }
}
export const trainingPlanRepository = new TrainingPlanRepository();
