import { BaseRepository } from './base.repository';
import type { AthleteProfile } from '@/domain/entities';

class AthleteProfileRepository extends BaseRepository<AthleteProfile> {
  protected table = 'athlete_profiles';
  protected override booleanColumns = ['onboarding_seen'] as const;
}
export const athleteProfileRepository = new AthleteProfileRepository();
