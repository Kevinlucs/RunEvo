import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '@/services/subscription';
import { useAuth } from './useAuth';
import type { Entitlement } from '@/types/entities';

const FREE: Entitlement = { plan: 'free', status: 'free', periodEnd: null };

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
