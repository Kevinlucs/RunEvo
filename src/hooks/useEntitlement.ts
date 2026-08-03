import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '@/services/subscription';
import { useAuth } from './useAuth';
import type { Entitlement } from '@/domain/entities';

const FREE: Entitlement = { plan: 'free', status: 'free', periodEnd: null };

/**
 * docs/fase-6-brief.md Grupo 1 — único ponto de leitura de entitlement na UI.
 * Nenhum componente decide Free/Plus por conta própria: tudo passa por
 * `subscriptionService.getEntitlement`, que resolve do cache local (offline).
 */
export function useEntitlement() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['entitlement', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Entitlement> => {
      if (!user?.id) return FREE;
      const result = await subscriptionService.getEntitlement(user.id);
      return result.ok ? result.value : FREE;
    },
  });

  const entitlement = query.data ?? FREE;
  return {
    ...query,
    entitlement,
    isPlus: entitlement.plan === 'plus',
  };
}

/** Gate do recurso Plus (histórico/comparação/Excel/auditoria avançada) — §34. */
export function useCanAccessHistory(): boolean {
  const { isPlus } = useEntitlement();
  return isPlus;
}
