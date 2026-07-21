import { z } from 'zod';
import { uuid, isoTimestamp } from './common';

export const checkinSchema = z.object({
  id: uuid,
  plan_id: uuid,
  user_id: uuid,
  week_number: z.number().int(),
  current_weight_kg: z.number().nullable().default(null),
  fatigue_level: z.number().int().min(1).max(10).nullable().default(null),
  pain_level: z.number().int().min(0).max(10).nullable().default(null),
  feeling: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  ai_analysis: z.record(z.unknown()).default({}),
  adjustment: z.record(z.unknown()).default({}),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});
export type Checkin = z.infer<typeof checkinSchema>;
