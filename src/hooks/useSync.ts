import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { runSync } from '@/db/sync';
import { useAuthStore } from '@/store/auth.store';
import { withTimeout } from '@/utils/timeout';
import { keysToInvalidate } from '@/services/sync/invalidation';

/** Nunca deixa o guard de rota esperando o 1º sync por mais que isso (ver `_layout.tsx`). */
const INITIAL_SYNC_TIMEOUT_MS = 8000;

async function syncAndInvalidate(userId: string, queryClient: QueryClient): Promise<void> {
  const result = await runSync(userId);
  if (!result.ok) return;
  for (const keyPrefix of keysToInvalidate(result.value.changedTables)) {
    void queryClient.invalidateQueries({ queryKey: [keyPrefix] });
  }
}

/**
 * Dispara o ciclo de sincronização ao logar, ao voltar do background e em
 * intervalo leve. Best-effort: falhas de rede não quebram a UI (offline-first).
 *
 * Dado que popular o SQLite local não invalida sozinho as queries do React
 * Query que já leram (undefined) do cache vazio, cada ciclo que gravou algo
 * invalida as queryKeys afetadas — sem isso, telas que leram antes do 1º
 * sync terminar (onboarding, Home) ficam presas no estado inicial para
 * sempre. `initialSyncDone` deixa o guard de rota saber quando é seguro
 * parar de esperar (nunca mais que `INITIAL_SYNC_TIMEOUT_MS`).
 */
export function useSync(): { initialSyncDone: boolean } {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  useEffect(() => {
    if (!userId) {
      setInitialSyncDone(false);
      return;
    }
    let active = true;

    void withTimeout(syncAndInvalidate(userId, queryClient), INITIAL_SYNC_TIMEOUT_MS, undefined).then(() => {
      if (active) setInitialSyncDone(true);
    });

    const interval = setInterval(() => {
      if (active) void syncAndInvalidate(userId, queryClient);
    }, 60_000);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void syncAndInvalidate(userId, queryClient);
    });
    return () => {
      active = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [userId, queryClient]);

  return { initialSyncDone };
}
