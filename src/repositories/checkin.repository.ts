import { BaseRepository } from './base.repository';
import type { Checkin } from '@/domain/entities';

class CheckinRepository extends BaseRepository<Checkin> {
  protected table = 'weekly_checkins';
}
export const checkinRepository = new CheckinRepository();
