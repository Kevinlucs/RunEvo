/**
 * Testes headless do SubscriptionService (docs/fase-7-brief.md Grupo 1).
 * Entitlement é decidido só aqui — nunca na UI. `getEntitlement`/`refresh`
 * leem sempre do cache local (subscriptionRepository), nunca do RevenueCat
 * direto: a verdade é o webhook → `subscriptions`, não o cliente.
 * `purchases.client.ts` (o único lugar que importa `react-native-purchases`,
 * SDK nativo) é mockado — Jest roda sem dev build, como pede o brief.
 */
/* eslint-disable import/first */
const getCurrentMock = jest.fn();
const runSyncMock = jest.fn();
const getOfferingsMock = jest.fn();
const purchaseMock = jest.fn();
const restoreMock = jest.fn();
const syncPurchasesIdentityMock = jest.fn();

jest.mock('@/repositories', () => ({ subscriptionRepository: { getCurrent: getCurrentMock } }));
jest.mock('@/db/sync', () => ({ runSync: runSyncMock }));
jest.mock('@/services/subscription/purchases.client', () => ({
  getOfferings: getOfferingsMock,
  purchase: purchaseMock,
  restore: restoreMock,
  syncPurchasesIdentity: syncPurchasesIdentityMock,
}));

import { subscriptionService } from '@/services/subscription';
import { ok, err, AppError } from '@/utils/result';
import type { Subscription } from '@/domain/entities';
/* eslint-enable import/first */

function mkSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    user_id: 'user-1',
    platform: 'google_play',
    product_id: null,
    status: 'active',
    current_period_end: null,
    raw_payload: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getEntitlement', () => {
  it('sem assinatura → free, histórico bloqueado', async () => {
    getCurrentMock.mockResolvedValue(ok(null));
    const result = await subscriptionService.getEntitlement('user-1');
    expect(result).toEqual(ok({ plan: 'free', status: 'free', periodEnd: null }));
  });

  it('status active e sem período de expiração → plus, tudo liberado', async () => {
    getCurrentMock.mockResolvedValue(ok(mkSub({ status: 'active' })));
    const result = await subscriptionService.getEntitlement('user-1');
    expect(result.ok && result.value.plan).toBe('plus');
  });

  it('trialing dentro do período → plus', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    getCurrentMock.mockResolvedValue(ok(mkSub({ status: 'trialing', current_period_end: future })));
    const result = await subscriptionService.getEntitlement('user-1');
    expect(result.ok && result.value.plan).toBe('plus');
  });

  it('active mas período já expirado → free', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    getCurrentMock.mockResolvedValue(ok(mkSub({ status: 'active', current_period_end: past })));
    const result = await subscriptionService.getEntitlement('user-1');
    expect(result.ok && result.value.plan).toBe('free');
  });

  it('canceled → free', async () => {
    getCurrentMock.mockResolvedValue(ok(mkSub({ status: 'canceled' })));
    const result = await subscriptionService.getEntitlement('user-1');
    expect(result.ok && result.value.plan).toBe('free');
  });

  it('erro do repository propaga (sem mascarar como free)', async () => {
    getCurrentMock.mockResolvedValue(err(new AppError('storage', 'db indisponível')));
    const result = await subscriptionService.getEntitlement('user-1');
    expect(result.ok).toBe(false);
  });
});

describe('refresh — offline resiliente', () => {
  it('sync falha (offline) mas ainda resolve o entitlement do cache local', async () => {
    runSyncMock.mockRejectedValue(new Error('network down'));
    getCurrentMock.mockResolvedValue(ok(mkSub({ status: 'active' })));

    const result = await subscriptionService.refresh('user-1');
    expect(result.ok && result.value.plan).toBe('plus');
  });

  it('sync bem-sucedido: relê do cache depois', async () => {
    runSyncMock.mockResolvedValue(ok({ changedTables: ['subscriptions'] }));
    getCurrentMock.mockResolvedValue(ok(mkSub({ status: 'active' })));

    const result = await subscriptionService.refresh('user-1');
    expect(runSyncMock).toHaveBeenCalledWith('user-1');
    expect(result.ok && result.value.plan).toBe('plus');
  });
});

describe('getOfferings/purchase/restore — delegam ao purchases.client (RevenueCat)', () => {
  it('getOfferings() repassa o resultado do client', async () => {
    const offerings = { packages: [{ identifier: '$rc_monthly', productId: 'runevo_plus_monthly', period: 'monthly' as const, priceString: 'R$ 19,90', priceAmount: 19.9, currencyCode: 'BRL', title: 'Mensal' }] };
    getOfferingsMock.mockResolvedValue(ok(offerings));

    const result = await subscriptionService.getOfferings();
    expect(result).toEqual(ok(offerings));
  });

  it('purchase() repassa o identifier do pacote e o resultado do client', async () => {
    purchaseMock.mockResolvedValue(ok(undefined));

    const result = await subscriptionService.purchase('$rc_annual');
    expect(purchaseMock).toHaveBeenCalledWith('$rc_annual');
    expect(result.ok).toBe(true);
  });

  it('purchase() nunca finge sucesso: erro do client (ex. cancelado) propaga', async () => {
    purchaseMock.mockResolvedValue(err(new AppError('cancelled', 'Compra cancelada.')));

    const result = await subscriptionService.purchase('$rc_monthly');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('cancelled');
  });

  it('restore() repassa o resultado do client', async () => {
    restoreMock.mockResolvedValue(ok(undefined));
    const result = await subscriptionService.restore();
    expect(result.ok).toBe(true);
    expect(restoreMock).toHaveBeenCalled();
  });
});

describe('identify — associa o RevenueCat ao user id do Supabase', () => {
  it('repassa o userId (ou null, no logout) pro purchases.client', async () => {
    await subscriptionService.identify('user-1');
    expect(syncPurchasesIdentityMock).toHaveBeenCalledWith('user-1');

    await subscriptionService.identify(null);
    expect(syncPurchasesIdentityMock).toHaveBeenCalledWith(null);
  });
});
