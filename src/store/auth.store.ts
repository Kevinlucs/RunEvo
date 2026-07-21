import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { authService } from '@/services/auth/auth.service';

type AuthState = {
  session: Session | null;
  initializing: boolean;
  userId: string | null;
  bootstrap: () => Promise<void>;
  setSession: (s: Session | null) => void;
};

/**
 * Estado de sessão global. `bootstrap` restaura a sessão persistida no boot e
 * assina mudanças de auth. A navegação reage a `session`/`initializing`.
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initializing: true,
  userId: null,

  bootstrap: async () => {
    const res = await authService.getSession();
    const session = res.ok ? res.value : null;
    set({ session, userId: session?.user.id ?? null, initializing: false });
    authService.onAuthStateChange((s) => {
      set({ session: s, userId: s?.user.id ?? null });
    });
  },

  setSession: (session) => set({ session, userId: session?.user.id ?? null }),
}));
