import * as SecureStore from 'expo-secure-store';

/**
 * Adapter de storage para o Supabase Auth usando Expo SecureStore.
 *
 * SecureStore tem limite de ~2KB por chave; a sessão do Supabase (com JWT +
 * refresh token) frequentemente ultrapassa isso. Este adapter fragmenta o
 * valor em blocos e guarda um índice de contagem, mantendo tudo cifrado no
 * enclave seguro do dispositivo. Tokens NUNCA vão para AsyncStorage/localStorage.
 */
const CHUNK_SIZE = 1800;
const countKey = (key: string): string => `${key}.count`;
const chunkKey = (key: string, i: number): string => `${key}.${i}`;

export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(countKey(key));
    if (countRaw === null) {
      // valor pequeno salvo direto (compat) ou inexistente
      return SecureStore.getItemAsync(key);
    }
    const count = Number(countRaw);
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null; // fragmento perdido → trata como ausente
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i += 1) {
      const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(chunkKey(key, i), slice);
    }
    await SecureStore.setItemAsync(countKey(key), String(count));
  },

  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(countKey(key));
    if (countRaw !== null) {
      const count = Number(countRaw);
      for (let i = 0; i < count; i += 1) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
      await SecureStore.deleteItemAsync(countKey(key));
    }
    await SecureStore.deleteItemAsync(key);
  },
};
