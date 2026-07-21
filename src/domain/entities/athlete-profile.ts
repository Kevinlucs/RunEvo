import { z } from 'zod';
import { uuid, isoTimestamp } from './common';

export const athleteProfileSchema = z.object({
  id: uuid, // = auth.users.id
  display_name: z.string().nullable().default(null),
  avatar_url: z.string().nullable().default(null),
  birth_date: z.string().nullable().default(null),
  height_cm: z.number().nullable().default(null),
  current_weight_kg: z.number().nullable().default(null),
  imc: z.number().nullable().default(null),
  preferred_unit: z.enum(['km', 'mi']).default('km'),
  language: z.string().default('pt-BR'),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  onboarding_seen: z.boolean().default(false),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});
export type AthleteProfile = z.infer<typeof athleteProfileSchema>;
