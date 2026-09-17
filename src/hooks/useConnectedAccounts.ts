import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import {
  listConnectedAccounts,
  type ConnectedAccountSummary,
} from '@/services/integrations/connected-accounts.service';

const FALLBACK: ConnectedAccountSummary[] = [
  {
    provider: 'strava',
    status: 'disconnected',
    connectedAt: null,
    lastSyncAt: null,
    activityEnrichment: false,
    lastError: null,
  },
];

/** Estado público das integrações. Credenciais nunca passam por este hook. */
export function useConnectedAccounts(): {
  accounts: ConnectedAccountSummary[];
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const userId = useAuthStore((state) => state.userId);
  const queryClient = useQueryClient();
  const queryKey = ['connected-accounts', userId];

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async (): Promise<ConnectedAccountSummary[]> => {
      const result = await listConnectedAccounts();
      if (!result.ok) throw result.error;
      return result.value;
    },
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return { accounts: query.data ?? FALLBACK, isLoading: query.isLoading, refresh };
}
