import { BaseRepository } from './base.repository';
import { getDb } from '@/db/sqlite';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { Subscription } from '@/domain/entities';

class SubscriptionRepository extends BaseRepository<Subscription> {
  protected table = 'subscriptions';

  async getCurrent(userId: string): Promise<Result<Subscription | null>> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<Subscription>(
        `SELECT * FROM ${this.table} WHERE user_id = ? AND _deleted = 0 ORDER BY updated_at DESC LIMIT 1`,
        [userId],
      );
      return ok(row ?? null);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }
}
export const subscriptionRepository = new SubscriptionRepository();
