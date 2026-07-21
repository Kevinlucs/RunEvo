import { BaseRepository } from './base.repository';
import type { AthleteProfile } from '@/domain/entities';

class AthleteProfileRepository extends BaseRepository<AthleteProfile> {
  protected table = 'athlete_profiles';
}
export const athleteProfileRepository = new AthleteProfileRepository();
