import type { SubscriptionPackage } from '@/domain/entities';

/**
 * docs/fase-7-brief.md Grupo 2 — "desconto do anual em destaque" precisa vir
 * do preço real da loja, não de um número fixo no texto (preços variam por
 * moeda/região). Compara o anual contra 12x o mensal, ambos localizados.
 */
export function annualDiscountPercent(
  monthly: SubscriptionPackage | undefined,
  annual: SubscriptionPackage | undefined,
): number | null {
  if (!monthly || !annual) return null;
  const yearlyIfMonthly = monthly.priceAmount * 12;
  if (yearlyIfMonthly <= 0) return null;
  const discount = 1 - annual.priceAmount / yearlyIfMonthly;
  if (discount <= 0) return null;
  return Math.round(discount * 100);
}
