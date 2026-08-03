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

/** Ciclo de cobrança de um pacote da oferta — só o que a UI precisa pra renderizar preço/desconto. */
export type SubscriptionPeriod = 'monthly' | 'annual' | 'unknown';

/**
 * Pacote de compra já normalizado a partir do SDK do RevenueCat (preço real,
 * localizado, vindo da loja) — a UI nunca importa tipos do `react-native-purchases`
 * direto, só este shape (mapeado em `services/subscription/purchases.client.ts`).
 */
export interface SubscriptionPackage {
  identifier: string;
  productId: string;
  period: SubscriptionPeriod;
  priceString: string;
  priceAmount: number;
  currencyCode: string;
  title: string;
}

export interface SubscriptionOfferings {
  packages: SubscriptionPackage[];
}
