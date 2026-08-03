import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from 'react-native-purchases';
import { env } from '@/lib/env';
import { ok, err, AppError, toAppError, type Result } from '@/utils/result';
import type { SubscriptionOfferings, SubscriptionPackage, SubscriptionPeriod } from '@/domain/entities';

/**
 * docs/fase-7-brief.md Grupo 1 — único ponto do app que importa
 * `react-native-purchases` direto. `subscription.service.ts` fala só com
 * este arquivo; a UI não sabe que o RevenueCat existe. Isola também o SDK
 * nativo (exige dev build — não roda no Expo Go) do resto do código, que
 * continua testável em Jest via `jest.mock('@/services/subscription/purchases.client')`.
 */

let configured = false;
let currentUserId: string | null = null;

function apiKeyOrNull(): string | null {
  // Só Android por enquanto (guardrail do brief: "código deve funcionar em
  // modo Google primeiro"; iOS entra quando a conta Apple + chave existirem).
  if (Platform.OS !== 'android') return null;
  return env.revenueCatApiKeyAndroid;
}

/**
 * Chamada uma vez no boot e a cada mudança de sessão (`auth.store.ts`).
 * Sem chave configurada ou fora do Android: no-op — o app segue funcional
 * em modo Free, nunca crasha por falta de config do RevenueCat.
 */
export async function syncPurchasesIdentity(userId: string | null): Promise<void> {
  const apiKey = apiKeyOrNull();
  if (!apiKey) return;

  try {
    if (!configured) {
      // appUserID no configure já associa a compra ao user id do Supabase
      // desde o primeiro boot autenticado (docs/fase-7-brief.md: "App user ID
      // do RevenueCat deve ser associado ao user id do Supabase").
      Purchases.configure({ apiKey, appUserID: userId ?? undefined });
      configured = true;
      currentUserId = userId;
      return;
    }
    if (userId === currentUserId) return;
    if (userId) {
      await Purchases.logIn(userId);
    } else {
      await Purchases.logOut();
    }
    currentUserId = userId;
  } catch (e) {
    // Identidade de billing nunca pode travar navegação/login — best-effort.
    console.warn('[purchases] falha ao sincronizar identidade do RevenueCat:', e);
  }
}

function mapPackage(pkg: PurchasesPackage, period: SubscriptionPeriod): SubscriptionPackage {
  return {
    identifier: pkg.identifier,
    productId: pkg.product.identifier,
    period,
    priceString: pkg.product.priceString,
    priceAmount: pkg.product.price,
    currencyCode: pkg.product.currencyCode,
    title: pkg.product.title,
  };
}

function mapPurchasesError(e: unknown): AppError {
  const code = (e as { code?: PURCHASES_ERROR_CODE } | undefined)?.code;
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return new AppError('cancelled', 'Compra cancelada.');
  }
  if (code === PURCHASES_ERROR_CODE.NETWORK_ERROR || code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR) {
    return new AppError('network', 'Falha de rede ao processar a compra. Tente novamente.');
  }
  if (
    code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR ||
    code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR
  ) {
    return new AppError('not_found', 'Este plano não está disponível para compra no momento.');
  }
  return toAppError(e, 'unknown');
}

export async function getOfferings(): Promise<Result<SubscriptionOfferings>> {
  if (!apiKeyOrNull()) {
    return err(new AppError('not_implemented', 'RevenueCat não configurado nesta plataforma/ambiente.'));
  }
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return ok({ packages: [] });

    const packages: SubscriptionPackage[] = [];
    if (current.monthly) packages.push(mapPackage(current.monthly, 'monthly'));
    if (current.annual) packages.push(mapPackage(current.annual, 'annual'));
    return ok({ packages });
  } catch (e) {
    return err(mapPurchasesError(e));
  }
}

export async function purchase(packageIdentifier: string): Promise<Result<void>> {
  if (!apiKeyOrNull()) {
    return err(new AppError('not_implemented', 'RevenueCat não configurado nesta plataforma/ambiente.'));
  }
  try {
    const offerings = await Purchases.getOfferings();
    const target = offerings.current?.availablePackages.find((p) => p.identifier === packageIdentifier);
    if (!target) {
      return err(new AppError('not_found', 'Pacote de assinatura não encontrado na oferta atual.'));
    }
    await Purchases.purchasePackage(target);
    return ok(undefined);
  } catch (e) {
    return err(mapPurchasesError(e));
  }
}

export async function restore(): Promise<Result<void>> {
  if (!apiKeyOrNull()) {
    return err(new AppError('not_implemented', 'RevenueCat não configurado nesta plataforma/ambiente.'));
  }
  try {
    await Purchases.restorePurchases();
    return ok(undefined);
  } catch (e) {
    return err(mapPurchasesError(e));
  }
}
