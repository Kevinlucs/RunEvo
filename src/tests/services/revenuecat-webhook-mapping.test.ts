/**
 * Testes headless do módulo puro do webhook RevenueCat (docs/fase-7-brief.md
 * Grupo 1). `mapping.ts` vive fora de `src/` (é importado pela Edge Function
 * Deno também) — import relativo direto, sem mock: é puro, sem `Deno.*`.
 */
import {
  mapRevenueCatEventToRow,
  isValidWebhookAuth,
  REVENUECAT_ENTITLEMENT_ID as WEBHOOK_ENTITLEMENT_ID,
  type RevenueCatEvent,
} from '../../../supabase/functions/revenuecat-webhook/mapping';
import { REVENUECAT_ENTITLEMENT_ID as APP_ENTITLEMENT_ID } from '@/domain/entities';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function mkEvent(overrides: Partial<RevenueCatEvent>): RevenueCatEvent {
  return {
    type: 'INITIAL_PURCHASE',
    app_user_id: USER_ID,
    product_id: 'runevo_plus_monthly',
    store: 'PLAY_STORE',
    entitlement_ids: ['RunEvo+'],
    ...overrides,
  };
}

describe('REVENUECAT_ENTITLEMENT_ID — paridade app × webhook', () => {
  it('o identificador do webhook bate exatamente com o do app (com o "+")', () => {
    expect(WEBHOOK_ENTITLEMENT_ID).toBe(APP_ENTITLEMENT_ID);
    expect(WEBHOOK_ENTITLEMENT_ID).toBe('RunEvo+');
  });
});

describe('mapRevenueCatEventToRow', () => {
  it('compra inicial → status active', () => {
    const row = mapRevenueCatEventToRow(mkEvent({ type: 'INITIAL_PURCHASE' }));
    expect(row).toMatchObject({ user_id: USER_ID, status: 'active', platform: 'google_play', product_id: 'runevo_plus_monthly' });
  });

  it('renovação em período de trial → status trialing', () => {
    const row = mapRevenueCatEventToRow(mkEvent({ type: 'RENEWAL', period_type: 'TRIAL' }));
    expect(row?.status).toBe('trialing');
  });

  it('expiração → status expired (volta a free na resolução do entitlement)', () => {
    const row = mapRevenueCatEventToRow(mkEvent({ type: 'EXPIRATION' }));
    expect(row?.status).toBe('expired');
  });

  it('cancelamento → status canceled', () => {
    const row = mapRevenueCatEventToRow(mkEvent({ type: 'CANCELLATION' }));
    expect(row?.status).toBe('canceled');
  });

  it('problema de cobrança → status past_due', () => {
    const row = mapRevenueCatEventToRow(mkEvent({ type: 'BILLING_ISSUE' }));
    expect(row?.status).toBe('past_due');
  });

  it('evento TEST → null (sem efeito, mas não é erro)', () => {
    expect(mapRevenueCatEventToRow(mkEvent({ type: 'TEST', entitlement_ids: [] }))).toBeNull();
  });

  it('tipo desconhecido → null', () => {
    expect(mapRevenueCatEventToRow(mkEvent({ type: 'ALGO_NOVO_DO_REVENUECAT' }))).toBeNull();
  });

  it('evento de outra entitlement (não RunEvo+) → null', () => {
    expect(mapRevenueCatEventToRow(mkEvent({ entitlement_ids: ['outro_produto'] }))).toBeNull();
  });

  it('converte expiration_at_ms em ISO; null quando ausente', () => {
    const withExpiration = mapRevenueCatEventToRow(mkEvent({ expiration_at_ms: 1_800_000_000_000 }));
    expect(withExpiration?.current_period_end).toBe(new Date(1_800_000_000_000).toISOString());

    const withoutExpiration = mapRevenueCatEventToRow(mkEvent({ expiration_at_ms: null }));
    expect(withoutExpiration?.current_period_end).toBeNull();
  });

  it.each([
    ['PLAY_STORE', 'google_play'],
    ['APP_STORE', 'apple'],
    ['STRIPE', 'web'],
    ['RC_BILLING', 'web'],
    [undefined, 'manual'],
  ])('store=%s → platform=%s', (store, expected) => {
    const row = mapRevenueCatEventToRow(mkEvent({ store }));
    expect(row?.platform).toBe(expected);
  });

  it('determinístico: o mesmo evento processado duas vezes produz a mesma linha (idempotência do upsert por user_id)', () => {
    const event = mkEvent({ type: 'RENEWAL' });
    expect(mapRevenueCatEventToRow(event)).toEqual(mapRevenueCatEventToRow(event));
  });
});

describe('isValidWebhookAuth', () => {
  it('header batendo com o secret configurado → válido', () => {
    expect(isValidWebhookAuth('meu-secret-123', 'meu-secret-123')).toBe(true);
  });

  it('header divergente → inválido (401)', () => {
    expect(isValidWebhookAuth('errado', 'meu-secret-123')).toBe(false);
  });

  it('sem header ou sem secret configurado → inválido', () => {
    expect(isValidWebhookAuth(null, 'meu-secret-123')).toBe(false);
    expect(isValidWebhookAuth('meu-secret-123', undefined)).toBe(false);
  });
});
