// Lógica pura do webhook RevenueCat → linha de `subscriptions` (docs/fase-7-brief.md
// Grupo 1). Sem `Deno.*` de propósito: este módulo é importado tanto pelo
// `index.ts` (runtime Deno) quanto pelos testes Jest
// (`src/tests/services/revenuecat-webhook-mapping.test.ts`, caminho
// relativo) — os testes cobrem a lógica de mapeamento e a paridade deste
// identificador com `@/domain/entities/revenuecat.ts` (única fonte "oficial"
// do lado do app; não importada aqui direto porque Deno exige extensão
// `.ts` explícita em imports relativos e o `moduleResolution: "node"` do
// tsconfig do app rejeita especificadores com `.ts` — cruzar os dois
// runtimes por import direto quebraria um dos dois lados).
export const REVENUECAT_ENTITLEMENT_ID = 'RunEvo+';

export interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  product_id?: string | null;
  store?: string;
  period_type?: string;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[];
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
export type SubscriptionPlatform = 'google_play' | 'apple' | 'web' | 'manual';

export interface SubscriptionRow {
  user_id: string;
  platform: SubscriptionPlatform;
  product_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  raw_payload: RevenueCatEvent;
}

// Eventos que concedem/renovam acesso (docs oficiais do RevenueCat). PRODUCT_CHANGE
// e TRANSFER também chegam com o entitlement já ativo na nova assinatura.
const ACTIVE_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'TRANSFER',
]);

function mapStatus(event: RevenueCatEvent): SubscriptionStatus | null {
  if (ACTIVE_TYPES.has(event.type)) return event.period_type === 'TRIAL' ? 'trialing' : 'active';
  // §34/Grupo 5 do brief: cancelamento e expiração voltam a Free no próximo
  // refresh — 'canceled'/'expired' não passam em `active`/`trialing` no
  // SubscriptionService, então já resolvem para free sem lógica extra aqui.
  if (event.type === 'CANCELLATION') return 'canceled';
  if (event.type === 'EXPIRATION') return 'expired';
  if (event.type === 'BILLING_ISSUE') return 'past_due';
  if (event.type === 'SUBSCRIPTION_PAUSED') return 'canceled';
  // TEST (clique de "Send Test" no dashboard) e tipos desconhecidos: sem
  // efeito no banco — a função responde 200 mesmo assim (não é erro).
  return null;
}

function mapPlatform(store: string | undefined): SubscriptionPlatform {
  if (store === 'PLAY_STORE') return 'google_play';
  if (store === 'APP_STORE') return 'apple';
  if (store === 'STRIPE' || store === 'RC_BILLING' || store === 'PROMOTIONAL') return 'web';
  return 'manual';
}

/**
 * `null` = evento sem efeito para nós (tipo desconhecido/TEST, ou não é
 * sobre a entitlement RunEvo+) — quem chama só responde 200 sem tocar no
 * banco. Determinístico: o mesmo evento sempre produz a mesma linha, então
 * o upsert por `user_id` (migration 0008, `onConflict: 'user_id'`) já torna
 * reentregas idempotentes — não precisa de deduplicação por `event.id` aqui.
 */
export function mapRevenueCatEventToRow(
  event: RevenueCatEvent,
  entitlementId: string = REVENUECAT_ENTITLEMENT_ID,
): SubscriptionRow | null {
  if (event.entitlement_ids && event.entitlement_ids.length > 0 && !event.entitlement_ids.includes(entitlementId)) {
    return null;
  }
  const status = mapStatus(event);
  if (!status) return null;

  return {
    user_id: event.app_user_id,
    platform: mapPlatform(event.store),
    product_id: event.product_id ?? null,
    status,
    current_period_end: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    raw_payload: event,
  };
}

/**
 * RevenueCat envia, no header `Authorization`, exatamente o valor
 * configurado no dashboard do webhook — sem prefixo "Bearer " automático.
 * Comparação simples e explícita (não HMAC): é o mecanismo de auth que o
 * RevenueCat oferece para webhooks.
 */
export function isValidWebhookAuth(headerValue: string | null, expectedSecret: string | undefined): boolean {
  if (!headerValue || !expectedSecret) return false;
  return headerValue === expectedSecret;
}
