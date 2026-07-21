import { z } from 'zod';
import { uuid, isoTimestamp } from './common';

export const subscriptionSchema = z.object({
  id: uuid,
  user_id: uuid,
  platform: z.enum(['google_play', 'apple', 'web', 'manual']),
  product_id: z.string().nullable().default(null),
  status: z.enum(['free', 'trialing', 'active', 'past_due', 'canceled', 'expired']).default('free'),
  current_period_end: isoTimestamp.nullable().default(null),
  raw_payload: z.record(z.unknown()).default({}),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});
export type Subscription = z.infer<typeof subscriptionSchema>;

/** Entitlement derivado — o que a UI consome (validado no serviço, não na UI). */
export type Entitlement = { plan: 'free' | 'plus'; status: Subscription['status']; periodEnd: string | null };
