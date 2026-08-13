/**
 * Testes headless de purchases.client.ts (docs/fase-7-brief.md Grupo 1) — o
 * único arquivo do app que importa `react-native-purchases` (SDK nativo,
 * exige dev build). Mockado por completo: Jest roda sem dev build, como
 * pede o brief ("Construa e teste tudo por Jest, sem depender de compra real").
 */
/* eslint-disable import/first */
const configureMock = jest.fn();
const logInMock = jest.fn();
const logOutMock = jest.fn();
const getOfferingsMock = jest.fn();
const purchasePackageMock = jest.fn();
const restorePurchasesMock = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: configureMock,
    logIn: logInMock,
    logOut: logOutMock,
    getOfferings: getOfferingsMock,
    purchasePackage: purchasePackageMock,
    restorePurchases: restorePurchasesMock,
  },
  PURCHASES_ERROR_CODE: {
    UNKNOWN_ERROR: '0',
    PURCHASE_CANCELLED_ERROR: '1',
    PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5',
    PRODUCT_ALREADY_PURCHASED_ERROR: '6',
    NETWORK_ERROR: '10',
    OFFLINE_CONNECTION_ERROR: '35',
  },
}));

const revenueCatApiKeyAndroidMock = jest.fn();
jest.mock('@/lib/env', () => ({ env: { get revenueCatApiKeyAndroid() { return revenueCatApiKeyAndroidMock(); } } }));

let platformOS = 'android';
jest.mock('react-native', () => ({ get Platform() { return { OS: platformOS }; } }));
/* eslint-enable import/first */

const API_KEY = 'goog_test_key';

// `jest.resetModules()` + `require()` (não `import()` dinâmico — o tsconfig
// do projeto não habilita o `module` necessário pro TS aceitar import()
// dinâmico) dá uma instância nova do módulo a cada teste: `configured`/
// `currentUserId` são estado de closure com propósito (mesma lógica de
// configure-once-then-logIn/logOut que o SDK real do RevenueCat pede), e
// cada teste precisa começar do zero.
function loadClient(): typeof import('@/services/subscription/purchases.client') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@/services/subscription/purchases.client');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  platformOS = 'android';
  revenueCatApiKeyAndroidMock.mockReturnValue(API_KEY);
});

describe('syncPurchasesIdentity', () => {
  it('sem chave configurada → não chama Purchases.configure (app segue em modo Free)', async () => {
    revenueCatApiKeyAndroidMock.mockReturnValue(null);
    const { syncPurchasesIdentity } = loadClient();

    await syncPurchasesIdentity('user-1');
    expect(configureMock).not.toHaveBeenCalled();
  });

  it('fora do Android → não chama Purchases.configure (iOS entra quando a conta Apple existir)', async () => {
    platformOS = 'ios';
    const { syncPurchasesIdentity } = loadClient();

    await syncPurchasesIdentity('user-1');
    expect(configureMock).not.toHaveBeenCalled();
  });

  it('primeira chamada configura o SDK associando o appUserID ao user id do Supabase', async () => {
    const { syncPurchasesIdentity } = loadClient();

    await syncPurchasesIdentity('user-1');
    expect(configureMock).toHaveBeenCalledWith({ apiKey: API_KEY, appUserID: 'user-1' });
    expect(logInMock).not.toHaveBeenCalled();
  });

  it('mesmo userId de novo → não chama logIn/logOut (no-op)', async () => {
    const { syncPurchasesIdentity } = loadClient();

    await syncPurchasesIdentity('user-1');
    await syncPurchasesIdentity('user-1');
    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(logInMock).not.toHaveBeenCalled();
  });

  it('troca de usuário depois de configurado → chama logIn com o novo id', async () => {
    const { syncPurchasesIdentity } = loadClient();

    await syncPurchasesIdentity('user-1');
    await syncPurchasesIdentity('user-2');
    expect(logInMock).toHaveBeenCalledWith('user-2');
  });

  it('logout (userId null) depois de configurado → chama logOut', async () => {
    const { syncPurchasesIdentity } = loadClient();

    await syncPurchasesIdentity('user-1');
    await syncPurchasesIdentity(null);
    expect(logOutMock).toHaveBeenCalled();
  });

  it('erro do SDK nunca propaga — identidade de billing é best-effort', async () => {
    configureMock.mockImplementation(() => {
      throw new Error('SDK não linkado');
    });
    const { syncPurchasesIdentity } = loadClient();

    await expect(syncPurchasesIdentity('user-1')).resolves.toBeUndefined();
  });
});

describe('getOfferings', () => {
  it('mapeia monthly/annual da oferta atual para o shape do domínio', async () => {
    getOfferingsMock.mockResolvedValue({
      current: {
        monthly: { identifier: '$rc_monthly', product: { identifier: 'runevo_plus_monthly', priceString: 'R$ 19,90', price: 19.9, currencyCode: 'BRL', title: 'RunEvo+ Mensal' } },
        annual: { identifier: '$rc_annual', product: { identifier: 'runevo_plus_annual', priceString: 'R$ 149,90', price: 149.9, currencyCode: 'BRL', title: 'RunEvo+ Anual' } },
      },
    });
    const { getOfferings } = loadClient();

    const result = await getOfferings();
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.packages).toEqual([
      { identifier: '$rc_monthly', productId: 'runevo_plus_monthly', period: 'monthly', priceString: 'R$ 19,90', priceAmount: 19.9, currencyCode: 'BRL', title: 'RunEvo+ Mensal' },
      { identifier: '$rc_annual', productId: 'runevo_plus_annual', period: 'annual', priceString: 'R$ 149,90', priceAmount: 149.9, currencyCode: 'BRL', title: 'RunEvo+ Anual' },
    ]);
  });

  it('sem oferta atual configurada no dashboard → lista vazia (não é erro)', async () => {
    getOfferingsMock.mockResolvedValue({ current: null });
    const { getOfferings } = loadClient();

    const result = await getOfferings();
    expect(result).toEqual({ ok: true, value: { packages: [] } });
  });

  it('sem chave do RevenueCat configurada → not_implemented (nunca finge ter ofertas)', async () => {
    revenueCatApiKeyAndroidMock.mockReturnValue(null);
    const { getOfferings } = loadClient();

    const result = await getOfferings();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('not_implemented');
  });
});

describe('purchase', () => {
  it('encontra o pacote pela oferta atual e chama purchasePackage', async () => {
    const targetPackage = { identifier: '$rc_annual', product: { identifier: 'runevo_plus_annual' } };
    getOfferingsMock.mockResolvedValue({ current: { availablePackages: [targetPackage] } });
    purchasePackageMock.mockResolvedValue({
      productIdentifier: 'runevo_plus_annual',
      customerInfo: { entitlements: { active: { plus: {} } } },
    });
    const { purchase } = loadClient();

    const result = await purchase('$rc_annual');
    expect(purchasePackageMock).toHaveBeenCalledWith(targetPackage);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.isActive).toBe(true);
  });

  it('pacote não encontrado na oferta atual → not_found (nunca simula compra)', async () => {
    getOfferingsMock.mockResolvedValue({ current: { availablePackages: [] } });
    const { purchase } = loadClient();

    const result = await purchase('$rc_monthly');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('not_found');
    expect(purchasePackageMock).not.toHaveBeenCalled();
  });

  it('cancelamento pelo usuário → error code cancelled (não trava, não simula sucesso)', async () => {
    getOfferingsMock.mockResolvedValue({ current: { availablePackages: [{ identifier: '$rc_monthly' }] } });
    purchasePackageMock.mockRejectedValue({ code: '1', message: 'cancelled' });
    const { purchase } = loadClient();

    const result = await purchase('$rc_monthly');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('cancelled');
  });

  it('falha de rede → error code network', async () => {
    getOfferingsMock.mockResolvedValue({ current: { availablePackages: [{ identifier: '$rc_monthly' }] } });
    purchasePackageMock.mockRejectedValue({ code: '10', message: 'network' });
    const { purchase } = loadClient();

    const result = await purchase('$rc_monthly');
    expect(!result.ok && result.error.code).toBe('network');
  });
});

describe('restore', () => {
  it('chama Purchases.restorePurchases()', async () => {
    restorePurchasesMock.mockResolvedValue({});
    const { restore } = loadClient();

    const result = await restore();
    expect(restorePurchasesMock).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('erro do SDK propaga (não finge restauração bem-sucedida)', async () => {
    restorePurchasesMock.mockRejectedValue({ code: '10', message: 'network' });
    const { restore } = loadClient();

    const result = await restore();
    expect(result.ok).toBe(false);
  });
});
