import { z } from 'zod';
import { uuid, isoTimestamp } from './common';

export const shoeSchema = z.object({
  id: uuid,
  user_id: uuid,
  brand: z.string().nullable().default(null),
  model: z.string(),
  nickname: z.string().nullable().default(null),
  initial_km: z.number().default(0),
  current_km: z.number().default(0),
  max_km: z.number().default(600),
  is_active: z.boolean().default(true),
  created_at: isoTimestamp,
  retired_at: isoTimestamp.nullable().default(null),
  updated_at: isoTimestamp,
});
export type Shoe = z.infer<typeof shoeSchema>;
