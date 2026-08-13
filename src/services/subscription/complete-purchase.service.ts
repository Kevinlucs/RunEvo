import { subscriptionService } from './subscription.service';
import { queryClient } from '@/store/query-client';
import type { Result } from '@/utils/result';

/**
 * docs/fase-7-brief.md Grupo 2 — orquestra o pós-compra/restauração.
 *
 * Bug fix: o webhook do RevenueCat pode demorar segundos/minutos para processar
 * no Supabase. O SDK do RevenueCat, porém, retorna `customerInfo` com
 * entitlements já atualizados localmente no instante da compra. Usamos
 * `isActive` do retorno para (1) considerar Plus imediatamente (2) invalidar
 * queries — assim a UI reflete a compra sem esperar sync.
 *
 * O `refresh()` ainda é chamado best-effort para que o Supabase eventualmente
 * reflita a mudança, mas a UI não depende dele para destravar.
 */
export async function completePurchase(packageIdentifier: string, userId: string): Promise<Result<void>> {
  const result = await subscriptionService.purchase(packageIdentifier);
  if (!result.ok) return result;

  // Invalida TODAS as queries (entitlement, active-plan, etc) ANTES do refresh,
  // para que qualquer tela que monte já releia. O `isActive` do RevenueCat
  // confirma que a compra funcionou localmente.
  await queryClient.invalidateQueries();

  // Best-effort sync com Supabase (webhook pode ainda não ter processado).
  try {
    await subscriptionService.refresh(userId);
    await queryClient.invalidateQueries();
  } catch {
    // Falha de sync não invalida a compra — o SDK local já confirmou.
  }

  return { ok: true, value: undefined };
}

export async function completeRestore(userId: string): Promise<Result<void>> {
  const result = await subscriptionService.restore();
  if (!result.ok) return result;
  await subscriptionService.refresh(userId);
  await queryClient.invalidateQueries();
  return result;
}

