import { BaseRepository } from './base.repository';
import type { Shoe } from '@/domain/entities';

class ShoeRepository extends BaseRepository<Shoe> {
  protected table = 'running_shoes';
  protected override booleanColumns = ['is_active'] as const;
}
export const shoeRepository = new ShoeRepository();
