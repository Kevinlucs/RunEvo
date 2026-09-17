import { z } from 'zod';
import { uuid, isoTimestamp } from './common';

export const workoutSchema = z.object({
  id: uuid,
  plan_id: uuid,
  user_id: uuid,
  week_number: z.number().int(),
  week_index: z.number().int().default(0),
  phase: z.string().nullable().default(null),
  workout_date: z.string().nullable().default(null),
  day_label: z.string().nullable().default(null),
  day_type: z.string().nullable().default(null),
  title: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  planned_km: z.number().nullable().default(null),
  planned_pace: z.string().nullable().default(null),
  status: z.enum(['pending', 'completed', 'skipped']).default('pending'),
  completed_km: z.number().nullable().default(null),
  perceived_effort: z.number().int().min(1).max(10).nullable().default(null),
  feeling: z.string().nullable().default(null),
  pain: z.boolean().nullable().default(null),
  feedback: z.string().nullable().default(null),
  shoe_id: uuid.nullable().default(null),
  completed_at: isoTimestamp.nullable().default(null),
  // O banco fornece os defaults. Mantemos opcionais no domínio até a
  // migration de integrações estar aplicada em todos os ambientes existentes.
  check_in_status: z.enum(['not_required', 'pending', 'completed']).optional(),
  completion_source: z.enum(['manual', 'strava_auto_match']).nullable().optional(),
  completion_activity_id: uuid.nullable().optional(),
  completion_match_type: z
    .enum(['direct_provider_match', 'auto_match', 'needs_confirmation', 'unmatched'])
    .nullable()
    .optional(),
  completion_match_score: z.number().int().min(0).max(100).nullable().optional(),
  updated_at: isoTimestamp,
});
export type Workout = z.infer<typeof workoutSchema>;
