import { BaseRepository } from './base.repository';
import type { Shoe } from '@/domain/entities';

class ShoeRepository extends BaseRepository<Shoe> {
  protected table = 'running_shoes';
}
export const shoeRepository = new ShoeRepository();
