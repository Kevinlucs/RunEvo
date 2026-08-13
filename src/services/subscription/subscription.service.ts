import { subscriptionRepository } from '@/repositories';
import { runSync } from '@/db/sync';
import * as purchasesClient from './purchases.client';
import { ok, err, type Result } from '@/utils/result';
import type { Entitlement, Subscription, SubscriptionOfferings } from '@/domain/entities';

/**
 * docs/fase-7-brief.md Grupo 1 — fronteira única de entitlement e billing; a
 * UI nunca importa `react-native-purchases` nem fala com o RevenueCat direto,
 * só com este serviço.
 *
 * `getEntitlement`/`refresh` continuam lendo de `subscriptionRepository`
 * (cache local, offline-first, sincronizado do Supabase) — a VERDADE do
 * entitlement é `subscriptions`, escrita só pelo webhook (service_role). O
 * RevenueCat nunca é lido aqui como fonte final: ele só inicia a compra
 * (`purchase`) e alimenta o servidor via webhook; quem confirma "virou Plus"
 * pra sempre é o próximo `refresh()` (sync puxa a linha atualizada).
 */
export interface SubscriptionService {
  getEntitlement(userId: string): Promise<Result<Entitlement>>;
  refresh(userId: string): Promise<Result<Entitlement>>;
  getOfferings(): Promise<Result<SubscriptionOfferings>>;
  purchase(packageIdentifier: string): Promise<Result<{ isActive: boolean }>>;
  restore(): Promise<Result<void>>;
  /** Associa o SDK do RevenueCat ao user id do Supabase — chamado a cada mudança de sessão (auth.store.ts). */
  identify(userId: string | null): Promise<void>;
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
    // Fonte primária: banco local (Supabase sync via webhook).
    const res = await subscriptionRepository.getCurrent(userId);

    if (res.ok && res.value) return ok(toEntitlement(res.value));

    // Fallback: SDK local do RevenueCat. Necessário porque o webhook pode
    // demorar segundos/minutos após uma compra, mas o SDK já tem o estado
    // atualizado. Sem este fallback, a UI fica "Free" entre a compra e o
    // processamento do webhook — causando Bug 1 (paywall não destranca).
    const sdkActive = await purchasesClient.hasActiveEntitlement();
    if (sdkActive) {
      return ok({ plan: 'plus', status: 'active', periodEnd: null } as Entitlement);
    }

    // Se o repository falhou (erro de storage), propaga o erro.
    if (!res.ok) return err(res.error);

    // Sem subscription no banco e SDK também não tem → FREE.
    return ok(FREE);
  },

  async refresh(userId) {
    try {
      await runSync(userId);
    } catch {
      // best-effort: falha de rede não pode impedir reler o cache local
    }
    return subscriptionService.getEntitlement(userId);
  },

  async getOfferings() {
    return purchasesClient.getOfferings();
  },

  async purchase(packageIdentifier) {
    return purchasesClient.purchase(packageIdentifier);
  },

  async restore() {
    return purchasesClient.restore();
  },

  async identify(userId) {
    return purchasesClient.syncPurchasesIdentity(userId);
  },
};
