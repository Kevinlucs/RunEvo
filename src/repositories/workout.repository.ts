import { BaseRepository } from './base.repository';
import { getDb } from '@/db/sqlite';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { Workout } from '@/domain/entities';

class WorkoutRepository extends BaseRepository<Workout> {
  protected table = 'plan_workouts';
  protected override booleanColumns = ['pain'] as const;

  async listByPlan(planId: string): Promise<Result<Workout[]>> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<Workout>(
        `SELECT * FROM ${this.table} WHERE plan_id = ? AND _deleted = 0 ORDER BY week_number, week_index`,
        [planId],
      );
      return ok(this.deserializeRows(rows));
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Check-ins individuais aguardando resposta, priorizando a corrida mais recente. */
  async listPendingPostWorkoutCheckins(userId: string): Promise<Result<Workout[]>> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<Workout>(
        `SELECT * FROM ${this.table}
         WHERE user_id = ? AND status = 'completed'
           AND check_in_status = 'pending' AND _deleted = 0
         ORDER BY completed_at DESC, updated_at DESC`,
        [userId],
      );
      return ok(this.deserializeRows(rows));
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }
}
export const workoutRepository = new WorkoutRepository();
