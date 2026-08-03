import { subscriptionService } from './subscription.service';
import { queryClient } from '@/store/query-client';
import type { Result } from '@/utils/result';

/**
 * docs/fase-7-brief.md Grupo 2 — orquestra o pós-compra/restauração: a
 * verdade do entitlement é o webhook (`subscriptions`), então depois de um
 * `purchase()`/`restore()` bem-sucedido puxamos `refresh()` (força sync) e
 * invalidamos o cache do React Query, pra `useEntitlement()` reler o estado
 * atualizado sem precisar reiniciar o app. Se `purchase()`/`restore()` falhar,
 * retornamos o erro tal como veio — nunca chamamos refresh/invalidate, pra
 * nunca fingir que uma compra que falhou desbloqueou algo.
 */
export async function completePurchase(packageIdentifier: string, userId: string): Promise<Result<void>> {
  const result = await subscriptionService.purchase(packageIdentifier);
  if (!result.ok) return result;
  await subscriptionService.refresh(userId);
  await queryClient.invalidateQueries();
  return result;
}

export async function completeRestore(userId: string): Promise<Result<void>> {
  const result = await subscriptionService.restore();
  if (!result.ok) return result;
  await subscriptionService.refresh(userId);
  await queryClient.invalidateQueries();
  return result;
}
