import { supabase } from '@/lib/supabase';
import { ok, err, appError, type Result } from '@/utils/result';
import type { Entitlement } from '@/types/entities';

// Entitlement é resolvido AQUI (serviço), lendo a tabela subscriptions +
// validando período — nunca só na UI (corrige o débito do legado, legacy-audit §6).
// Billing real (Google Play / App Store) pluga em purchase()/restore() na Fase 7.
export interface SubscriptionService {
  getEntitlement(userId: string): Promise<Result<Entitlement>>;
  purchase(productId: string): Promise<Result<void>>;
  restore(): Promise<Result<void>>;
}

const FREE: Entitlement = { plan: 'free', status: 'free', periodEnd: null };

function toEntitlement(row: {
  status: Entitlement['status'];
  current_period_end: string | null;
}): Entitlement {
  const active = row.status === 'active' || row.status === 'trialing';
  const notExpired = !row.current_period_end || new Date(row.current_period_end) > new Date();
  return {
    plan: active && notExpired ? 'plus' : 'free',
    status: row.status,
    periodEnd: row.current_period_end,
  };
}

export const supabaseSubscriptionService: SubscriptionService = {
  async getEntitlement(userId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return err(appError('subscription/read', error.message, error));
    if (!data) return ok(FREE);
    return ok(toEntitlement(data));
  },

  async purchase() {
    // Placeholder: billing real conecta na Fase 7 atrás desta mesma interface.
    return err(appError('subscription/not-implemented', 'Compra ainda não conectada.'));
  },

  async restore() {
    return err(appError('subscription/not-implemented', 'Restauração ainda não conectada.'));
  },
};
