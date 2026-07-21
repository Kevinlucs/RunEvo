import { z } from 'zod';
import { uuid, isoTimestamp } from './common';

export const trainingPlanSchema = z.object({
  id: uuid,
  user_id: uuid,
  plan_name: z.string(),
  race_name: z.string().nullable().default(null),
  race_distance_km: z.number().nullable().default(null),
  start_date: z.string().nullable().default(null),
  race_date: z.string().nullable().default(null),
  total_weeks: z.number().int().nullable().default(null),
  days_per_week: z.number().int().nullable().default(null),
  objective: z.string().nullable().default(null),
  terrain: z.enum(['plano', 'misto', 'elevado']).nullable().default(null),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  // blobs do Motor RunEvo (preenchidos na Fase 2/3). jsonb no Postgres.
  user_data: z.record(z.unknown()).default({}),
  blueprint: z.record(z.unknown()).default({}),
  validation: z.record(z.unknown()).default({}),
  quality: z.record(z.unknown()).default({}),
  risk: z.record(z.unknown()).default({}),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;
