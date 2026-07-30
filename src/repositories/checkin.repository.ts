import { BaseRepository } from './base.repository';
import { getDb } from '@/db/sqlite';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { Checkin } from '@/domain/entities';

class CheckinRepository extends BaseRepository<Checkin> {
  protected table = 'weekly_checkins';
  protected override jsonColumns = ['ai_analysis', 'adjustment'] as const;

  /** Débito da Fase 4 (docs/fase-4-brief.md Grupo 2.2) — quais semanas já têm check-in enviado. */
  async listByPlan(planId: string): Promise<Result<Checkin[]>> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<Checkin>(
        `SELECT * FROM ${this.table} WHERE plan_id = ? AND _deleted = 0`,
        [planId],
      );
      return ok(this.deserializeRows(rows));
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }
}
export const checkinRepository = new CheckinRepository();
