import * as SecureStore from 'expo-secure-store';

/**
 * Adapter de storage para o Supabase Auth usando Expo SecureStore.
 *
 * SecureStore tem limite de ~2KB por chave; a sessão do Supabase (com JWT +
 * refresh token) frequentemente ultrapassa isso. Este adapter fragmenta o
 * valor em blocos e guarda um índice de contagem, mantendo tudo cifrado no
 * enclave seguro do dispositivo. Tokens NUNCA vão para AsyncStorage/localStorage.
 *
 * Falha de leitura/decifragem (chave do Keystore/Keychain invalidada por
 * restauração de backup do Google, troca de aparelho ou reinstalação) é
 * tratada como sessão ausente, não como erro fatal — sem isso o app trava no
 * splash para sempre (o pior first-run possível). `getItem` purga os
 * fragmentos ilegíveis e retorna `null`; o app cai no fluxo de login, uma
 * degradação aceitável.
 */
const CHUNK_SIZE = 1800;
/** Teto de segurança para purga quando a própria contagem de fragmentos está ilegível. */
const MAX_PURGE_CHUNKS = 20;
const countKey = (key: string): string => `${key}.count`;
const chunkKey = (key: string, i: number): string => `${key}.${i}`;

async function safeDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // melhor esforço — a chave já está corrompida, uma falha ao apagar não pode propagar.
  }
}

/** Apaga a chave base, o índice de contagem e os fragmentos (contagem conhecida ou teto de segurança). */
async function purgeFragments(key: string, knownCount?: number): Promise<void> {
  await safeDelete(key);
  await safeDelete(countKey(key));
  const count = knownCount ?? MAX_PURGE_CHUNKS;
  for (let i = 0; i < count; i += 1) {
    await safeDelete(chunkKey(key, i));
  }
}

export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const countRaw = await SecureStore.getItemAsync(countKey(key));
      if (countRaw === null) {
        // valor pequeno salvo direto (compat) ou inexistente
        return await SecureStore.getItemAsync(key);
      }
      const count = Number(countRaw);
      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i));
        if (part === null) {
          // fragmento perdido — valor não reconstruível, purga o resto para não persistir lixo.
          await purgeFragments(key, count);
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    } catch {
      // leitura/decifragem falhou (ex.: chave do Keystore/Keychain invalidada).
      await purgeFragments(key);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
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
    } catch {
      // gravação falhou (ex.: Keystore indisponível) — purga fragmentos parciais
      // para não deixar a chave num estado inconsistente; sessão não persiste,
      // mesma degradação aceitável do getItem (login de novo no próximo boot).
      await purgeFragments(key);
    }
  },

  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(countKey(key)).catch(() => null);
    const count = countRaw !== null ? Number(countRaw) : undefined;
    await purgeFragments(key, count);
  },
};
