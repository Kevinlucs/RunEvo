/* eslint-disable import/first */
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockIdentify = jest.fn();

jest.mock('@/services/auth/auth.service', () => ({
  authService: {
    getSession: () => mockGetSession(),
    onAuthStateChange: (cb: (s: unknown) => void) => mockOnAuthStateChange(cb),
  },
}));
// subscriptionService puxa @/repositories → expo-sqlite (runtime nativo,
// fora do alcance do Jest) — mockado pra isolar só o que este teste cobre
// (o hang do SecureStore no bootstrap, não a identidade do RevenueCat).
jest.mock('@/services/subscription', () => ({ subscriptionService: { identify: mockIdentify } }));

import { useAuthStore } from '@/store/auth.store';
import { ok } from '@/utils/result';
/* eslint-enable import/first */

/**
 * docs/fase-4-brief.md — hang do SecureStore: uma chamada nativa pendurada
 * (Keystore/Keychain invalidado) nunca pode prender o app no splash. `bootstrap`
 * precisa desligar `initializing` em qualquer cenário (sucesso, erro, timeout).
 */
describe('useAuthStore.bootstrap', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockReset().mockReturnValue(() => {});
    mockIdentify.mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({ session: null, initializing: true, userId: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolve normalmente e desliga initializing quando getSession responde', async () => {
    mockGetSession.mockResolvedValue(ok(null));

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().initializing).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('cai no login (session null) e desliga initializing via timeout quando a chamada nativa não responde', async () => {
    jest.useFakeTimers();
    mockGetSession.mockReturnValue(new Promise(() => {})); // nunca resolve — simula Keystore pendurado

    const bootstrapPromise = useAuthStore.getState().bootstrap();
    await jest.advanceTimersByTimeAsync(8000);
    await bootstrapPromise;

    expect(useAuthStore.getState().initializing).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('desliga initializing mesmo se getSession rejeitar inesperadamente (try/finally)', async () => {
    mockGetSession.mockRejectedValue(new Error('falha inesperada'));

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().initializing).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
  });
});
