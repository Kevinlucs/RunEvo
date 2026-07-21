import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { runSync } from '@/db/sync';
import { useAuthStore } from '@/store/auth.store';

/**
 * Dispara o ciclo de sincronização ao logar, ao voltar do background e em
 * intervalo leve. Best-effort: falhas de rede não quebram a UI (offline-first).
 */
export function useSync(): void {
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const sync = (): void => {
      void runSync(userId);
    };
    sync();
    const interval = setInterval(() => {
      if (active) sync();
    }, 60_000);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') sync();
    });
    return () => {
      active = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [userId]);
}
