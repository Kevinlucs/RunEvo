/**
 * Testes headless do SubscriptionService (docs/fase-6-brief.md Grupo 1).
 * Entitlement é decidido só aqui — nunca na UI. Lê sempre do cache local
 * (subscriptionRepository), nunca bate direto no Supabase: por isso o app
 * sabe "free vs plus" mesmo offline.
 */
/* eslint-disable import/first */
const getCurrentMock = jest.fn();
const runSyncMock = jest.fn();

jest.mock('@/repositories', () => ({ subscriptionRepository: { getCurrent: getCurrentMock } }));
jest.mock('@/db/sync', () => ({ runSync: runSyncMock }));

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

describe('purchase/restore — stubs até a Fase 7', () => {
  it('purchase() nunca simula uma compra: retorna not_implemented', async () => {
    const result = await subscriptionService.purchase('plus-monthly');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('not_implemented');
  });

  it('restore() também é not_implemented', async () => {
    const result = await subscriptionService.restore();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('not_implemented');
  });
});
