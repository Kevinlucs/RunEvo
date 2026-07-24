import { BaseRepository } from './base.repository';
import { getDb } from '@/db/sqlite';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { TrainingPlan } from '@/domain/entities';

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
}
export const trainingPlanRepository = new TrainingPlanRepository();
