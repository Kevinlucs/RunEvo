/* eslint-disable import/first */
// expo-secure-store exige o runtime nativo — mockado com um Map em memória.
const store = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
}));

import { secureStoreAdapter } from '@/lib/secure-store';
/* eslint-enable import/first */

describe('secureStoreAdapter', () => {
  beforeEach(() => store.clear());

  it('só usa chaves com o charset aceito pelo SecureStore ([A-Za-z0-9._-])', async () => {
    const value = 'x'.repeat(5000); // acima do CHUNK_SIZE (1800) → fragmenta
    await secureStoreAdapter.setItem('sb-project-auth-token', value);

    expect(store.size).toBeGreaterThan(1);
    for (const key of store.keys()) {
      expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });

  it('fragmenta valores grandes (>2KB) e reconstrói no get', async () => {
    const key = 'sb-project-auth-token';
    const value = 'a1b2c3'.repeat(500); // 3000 chars, > CHUNK_SIZE

    await secureStoreAdapter.setItem(key, value);
    const result = await secureStoreAdapter.getItem(key);

    expect(result).toBe(value);
    expect(store.has(`${key}.count`)).toBe(true);
  });

  it('remove todos os fragmentos e o índice de contagem', async () => {
    const key = 'sb-project-auth-token';
    const value = 'z'.repeat(4000);

    await secureStoreAdapter.setItem(key, value);
    expect(store.size).toBeGreaterThan(1);

    await secureStoreAdapter.removeItem(key);

    expect(store.size).toBe(0);
    expect(await secureStoreAdapter.getItem(key)).toBeNull();
  });

  it('mantém compatibilidade com valores pequenos (chave direta, sem fragmentar)', async () => {
    const key = 'sb-project-auth-token';
    const value = 'valor-curto';

    await secureStoreAdapter.setItem(key, value);

    expect(store.has(key)).toBe(true);
    expect(store.has(`${key}.count`)).toBe(false);
    expect(await secureStoreAdapter.getItem(key)).toBe(value);
  });

  it('getItem: falha de decifragem (getItemAsync lança) retorna null sem propagar e purga os fragmentos', async () => {
    const key = 'sb-project-auth-token';
    const value = 'z'.repeat(4000);
    await secureStoreAdapter.setItem(key, value);
    expect(store.size).toBeGreaterThan(1);

    const { getItemAsync } = jest.requireMock<{ getItemAsync: jest.Mock }>('expo-secure-store');
    getItemAsync.mockRejectedValueOnce(new Error('Keystore key invalidated'));

    await expect(secureStoreAdapter.getItem(key)).resolves.toBeNull();
    // purga best-effort: nenhum fragmento da chave sobrevive à falha.
    expect(store.size).toBe(0);
  });

  it('getItem: fragmento ausente/corrompido no meio da sequência retorna null e purga o restante', async () => {
    const key = 'sb-project-auth-token';
    const value = 'z'.repeat(4000);
    await secureStoreAdapter.setItem(key, value);
    store.delete(`${key}.1`); // corrompe um fragmento no meio

    await expect(secureStoreAdapter.getItem(key)).resolves.toBeNull();
    expect(store.size).toBe(0);
  });

  it('getItem: chave nunca existiu (nenhuma falha) continua retornando null normalmente', async () => {
    await expect(secureStoreAdapter.getItem('chave-inexistente')).resolves.toBeNull();
  });
});
