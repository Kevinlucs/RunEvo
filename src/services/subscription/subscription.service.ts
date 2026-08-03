import { subscriptionRepository } from '@/repositories';
import { runSync } from '@/db/sync';
import { ok, err, AppError, type Result } from '@/utils/result';
import type { Entitlement, Subscription } from '@/domain/entities';

/**
 * docs/fase-6-brief.md Grupo 1 — fronteira única de entitlement. Lê sempre do
 * cache local (subscriptionRepository, offline-first); `refresh()` dispara um
 * ciclo de sync best-effort antes de reler, mas nunca falha por falta de rede
 * (o app precisa saber "free vs plus" mesmo offline). `purchase()`/`restore()`
 * são stubs até a Fase 7 — billing real pluga atrás desta mesma interface.
 */
export interface SubscriptionService {
  getEntitlement(userId: string): Promise<Result<Entitlement>>;
  refresh(userId: string): Promise<Result<Entitlement>>;
  purchase(productId: string): Promise<Result<void>>;
  restore(): Promise<Result<void>>;
}

const FREE: Entitlement = { plan: 'free', status: 'free', periodEnd: null };

function toEntitlement(sub: Subscription | null): Entitlement {
  if (!sub) return FREE;
  const active = sub.status === 'active' || sub.status === 'trialing';
  const notExpired = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
  return { plan: active && notExpired ? 'plus' : 'free', status: sub.status, periodEnd: sub.current_period_end };
}

export const subscriptionService: SubscriptionService = {
  async getEntitlement(userId) {
    const res = await subscriptionRepository.getCurrent(userId);
    if (!res.ok) return err(res.error);
    return ok(toEntitlement(res.value));
  },

  async refresh(userId) {
    try {
      await runSync(userId);
    } catch {
      // best-effort: falha de rede não pode impedir reler o cache local
    }
    return subscriptionService.getEntitlement(userId);
  },

  async purchase() {
    return err(new AppError('not_implemented', 'Compra ainda não conectada — chega na Fase 7.'));
  },

  async restore() {
    return err(new AppError('not_implemented', 'Restauração de compra ainda não conectada — chega na Fase 7.'));
  },
};
