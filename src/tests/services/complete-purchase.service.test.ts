/**
 * Testes headless de complete-purchase.service.ts (docs/fase-7-brief.md
 * Grupo 2) — mesmo padrão de edit-profile.service.test.ts/shoes.service.test.ts:
 * `subscription.service`/query-client mockados, confere que refresh +
 * invalidateQueries só rodam quando purchase()/restore() teve sucesso.
 */
/* eslint-disable import/first */
const purchaseMock = jest.fn();
const restoreMock = jest.fn();
const refreshMock = jest.fn();
const invalidateQueriesMock = jest.fn();

jest.mock('@/services/subscription/subscription.service', () => ({
  subscriptionService: { purchase: purchaseMock, restore: restoreMock, refresh: refreshMock },
}));
jest.mock('@/store/query-client', () => ({ queryClient: { invalidateQueries: invalidateQueriesMock } }));

import { completePurchase, completeRestore } from '@/services/subscription/complete-purchase.service';
import { ok, err, AppError } from '@/utils/result';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
});

describe('completePurchase', () => {
  it('compra bem-sucedida → força refresh do entitlement e invalida o cache', async () => {
    purchaseMock.mockResolvedValue(ok(undefined));
    refreshMock.mockResolvedValue(ok({ plan: 'plus', status: 'active', periodEnd: null }));

    const result = await completePurchase('$rc_annual', 'user-1');

    expect(purchaseMock).toHaveBeenCalledWith('$rc_annual');
    expect(refreshMock).toHaveBeenCalledWith('user-1');
    expect(invalidateQueriesMock).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('compra cancelada/falha → nunca chama refresh/invalidate (não finge sucesso)', async () => {
    purchaseMock.mockResolvedValue(err(new AppError('cancelled', 'Compra cancelada.')));

    const result = await completePurchase('$rc_monthly', 'user-1');

    expect(result.ok).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});

describe('completeRestore', () => {
  it('restauração bem-sucedida → força refresh do entitlement e invalida o cache', async () => {
    restoreMock.mockResolvedValue(ok(undefined));
    refreshMock.mockResolvedValue(ok({ plan: 'plus', status: 'active', periodEnd: null }));

    const result = await completeRestore('user-1');

    expect(restoreMock).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledWith('user-1');
    expect(invalidateQueriesMock).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('restauração falha → nunca chama refresh/invalidate', async () => {
    restoreMock.mockResolvedValue(err(new AppError('network', 'Sem conexão.')));

    const result = await completeRestore('user-1');

    expect(result.ok).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});
