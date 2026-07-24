import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { authService } from '@/services/auth/auth.service';
import type { Result } from '@/utils/result';

type AuthState = {
  session: Session | null;
  initializing: boolean;
  userId: string | null;
  bootstrap: () => Promise<void>;
  setSession: (s: Session | null) => void;
};

/** Uma chamada nativa (Keystore/Keychain) pendurada nunca pode segurar o splash indefinidamente. */
const BOOTSTRAP_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * Estado de sessão global. `bootstrap` restaura a sessão persistida no boot e
 * assina mudanças de auth. A navegação reage a `session`/`initializing`.
 *
 * `initializing: false` sempre executa (try/finally) e a leitura da sessão
 * corre contra um timeout — sem isso, uma falha do SecureStore (chave do
 * Keystore/Keychain invalidada) prende o app no splash para sempre.
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initializing: true,
  userId: null,

  bootstrap: async () => {
    try {
      const res = await withTimeout<Result<Session | null> | null>(
        authService.getSession(),
        BOOTSTRAP_TIMEOUT_MS,
        null,
      );
      const session = res?.ok ? res.value : null;
      set({ session, userId: session?.user.id ?? null });
      authService.onAuthStateChange((s) => {
        set({ session: s, userId: s?.user.id ?? null });
      });
    } finally {
      set({ initializing: false });
    }
  },

  setSession: (session) => set({ session, userId: session?.user.id ?? null }),
}));
