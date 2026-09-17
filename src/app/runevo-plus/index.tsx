import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, Image, Alert, StyleSheet } from 'react-native';
import { X, Check, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useAuth } from '@/hooks/useAuth';
import { subscriptionService, completePurchase, completeRestore, annualDiscountPercent } from '@/services/subscription';
import { colors, radii, spacing, fontWeight } from '@/theme';
import type { SubscriptionPackage } from '@/domain/entities';

/**
 * Lista de conversão LOCAL do paywall — foca em benefícios que vendem, não nas
 * features técnicas de `PLUS_FEATURES` (essa é reusada em outras telas). Ordem
 * pensada para conversão: benefício principal → adaptação → viabilidade →
 * ganchos de gameficação/badges → histórico/Excel.
 */
const PAYWALL_HIGHLIGHTS: string[] = [
  'Plano completo e sem limite de semanas, adaptado a cada semana rumo à sua prova',
  'IA Evo aprimorada: análises mais profundas e recomendações personalizadas a cada ciclo',
  'Análise de viabilidade do seu objetivo e evolução entre ciclos de treino',
  'Badges exclusivos e gameficação para manter você motivado até a linha de chegada',
  'Histórico completo, comparação de planilhas e exportação em Excel',
];

// Preços fake só para visualizar o layout no emulador (__DEV__); nunca usados em produção.
const DEV_PACKAGES: SubscriptionPackage[] = [
  { identifier: 'dev_annual', productId: 'dev_annual', period: 'annual', priceString: 'R$ 199,90', priceAmount: 199.9, currencyCode: 'BRL', title: 'Anual' },
  { identifier: 'dev_monthly', productId: 'dev_monthly', period: 'monthly', priceString: 'R$ 19,90', priceAmount: 19.9, currencyCode: 'BRL', title: 'Mensal' },
];

type PlanCycle = 'monthly' | 'annual';

/**
 * docs/fase-7-brief.md Grupo 2 — oferta RunEvo+ com compra real. Preços vêm
 * sempre da loja (`getOfferings()`), nunca hardcoded — variam por moeda e
 * podem mudar sem deploy. `isPlus` só decide o que ESTA tela mostra; quem
 * decide Free/Plus de verdade é sempre `useEntitlement()`.
 */
export default function RunEvoPlusOffer(): JSX.Element {
  const { isPlus } = useEntitlement();
  const { user } = useAuth();
  const [cycle, setCycle] = useState<PlanCycle>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const offeringsQuery = useQuery({
    queryKey: ['subscription-offerings'],
    enabled: !isPlus,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SubscriptionPackage[]> => {
      const result = await subscriptionService.getOfferings();
      if (!result.ok) throw result.error;
      return result.value.packages;
    },
  });

  const packages = offeringsQuery.data ?? [];
  // Em __DEV__ o RevenueCat não devolve offerings no emulador → usa mock só para
  // visualizar o layout. Produção sempre usa os pacotes reais da loja.
  const effectivePackages =
    packages.length > 0 ? packages : typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_PACKAGES : packages;
  const monthlyPkg = effectivePackages.find((p) => p.period === 'monthly');
  const annualPkg = effectivePackages.find((p) => p.period === 'annual');
  const selectedPkg = cycle === 'monthly' ? monthlyPkg : annualPkg;
  const discount = annualDiscountPercent(monthlyPkg, annualPkg);

  useEffect(() => {
    // Se a loja só devolveu um dos dois pacotes, seleciona o que existe.
    if (cycle === 'annual' && !annualPkg && monthlyPkg) setCycle('monthly');
    else if (cycle === 'monthly' && !monthlyPkg && annualPkg) setCycle('annual');
  }, [cycle, monthlyPkg, annualPkg]);

  const firstName = (() => {
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
    const raw = meta.full_name || meta.name || '';
    const first = raw.trim().split(' ')[0];
    return first || null;
  })();

  const weekly = (amount: number, period: 'annual' | 'monthly'): string => {
    const perWeek = period === 'annual' ? amount / 52 : (amount * 12) / 52;
    return `R$ ${perWeek.toFixed(2).replace('.', ',')}/sem`;
  };

  async function handlePurchase(): Promise<void> {
    if (!selectedPkg || !user?.id || purchasing) return;
    setPurchasing(true);
    try {
      const result = await completePurchase(selectedPkg.identifier, user.id);
      if (!result.ok) {
        if (result.error.code !== 'cancelled') {
          Alert.alert('Não foi possível concluir a compra', result.error.message);
        }
        return;
      }
      // Compra confirmada → navega pra Home (não router.back() que pode voltar
      // pra tela bloqueada). replace() limpa o stack do paywall.
      router.replace('/(tabs)');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore(): Promise<void> {
    if (!user?.id || restoring) return;
    setRestoring(true);
    try {
      const result = await completeRestore(user.id);
      if (!result.ok) {
        Alert.alert('Não foi possível restaurar', result.error.message);
        return;
      }
      Alert.alert('Restauração concluída', 'Se havia uma assinatura ativa nesta conta, ela foi restaurada.');
    } finally {
      setRestoring(false);
    }
  }

  function handleTerms(): void {
    Alert.alert('Termos', 'Termos de assinatura em breve.');
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Fechar">
          <X size={24} color={colors.textSecondary} />
        </Pressable>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image source={require('../../../assets/logo-runevo-plus.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          {isPlus ? (
            <>
              <Text style={styles.heroTitle}>Você já é RunEvo+</Text>
              <Text style={styles.heroGreeting}>Obrigado por apoiar o RunEvo!</Text>
            </>
          ) : (
            <>
              <Text style={styles.heroTitle}>Desbloqueie seu plano de treino completo</Text>
              <Text style={styles.heroGreeting}>
                {firstName ? `${firstName}, comece hoje mesmo` : 'Comece hoje mesmo'}
              </Text>
            </>
          )}
        </View>

        {/* Benefícios (sem card de fundo) */}
        <View style={styles.highlights}>
          {PAYWALL_HIGHLIGHTS.map((item) => (
            <View key={item} style={styles.highlightRow}>
              <View style={styles.highlightCheck}>
                <Check size={16} color={colors.neon} strokeWidth={3} />
              </View>
              <Text style={styles.highlightText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Planos */}
        {!isPlus ? (
          <View style={styles.plansCol}>
            {annualPkg ? (
              <Pressable
                style={[styles.planCard, cycle === 'annual' && styles.planCardSelected]}
                onPress={() => setCycle('annual')}
                accessibilityRole="button"
                accessibilityState={{ selected: cycle === 'annual' }}
              >
                {discount !== null ? (
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>ECONOMIZE {discount}%</Text>
                  </View>
                ) : null}
                <View style={styles.planRow}>
                  <View>
                    <Text style={styles.planPeriod}>Anual</Text>
                    <Text style={styles.planPrice}>
                      {annualPkg.priceString}<Text style={styles.planPriceSuffix}>/ano</Text>
                    </Text>
                  </View>
                  <Text style={styles.planWeekly}>{weekly(annualPkg.priceAmount, 'annual')}</Text>
                </View>
              </Pressable>
            ) : null}

            {monthlyPkg ? (
              <Pressable
                style={[styles.planCard, cycle === 'monthly' && styles.planCardSelected]}
                onPress={() => setCycle('monthly')}
                accessibilityRole="button"
                accessibilityState={{ selected: cycle === 'monthly' }}
              >
                <View style={styles.planRow}>
                  <View>
                    <Text style={styles.planPeriod}>Mensal</Text>
                    <Text style={styles.planPrice}>
                      {monthlyPkg.priceString}<Text style={styles.planPriceSuffix}>/mês</Text>
                    </Text>
                  </View>
                  <Text style={styles.planWeekly}>{weekly(monthlyPkg.priceAmount, 'monthly')}</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {offeringsQuery.isError && effectivePackages.length === 0 ? (
          <Text style={styles.errorText}>Não foi possível carregar os planos. Verifique sua conexão.</Text>
        ) : null}

        {/* Links (rolam com o conteúdo) */}
        {!isPlus ? (
          <View style={styles.linksCol}>
            <Pressable onPress={handleTerms} accessibilityRole="button">
              <Text style={styles.link}>Termos de uso</Text>
            </Pressable>
            <Pressable onPress={handleTerms} accessibilityRole="button">
              <Text style={styles.link}>Política de privacidade</Text>
            </Pressable>
            <Pressable onPress={() => void handleRestore()} disabled={restoring} accessibilityRole="button">
              <Text style={styles.link}>{restoring ? 'Restaurando...' : 'Restaurar compra'}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={handleTerms} accessibilityRole="button" style={styles.termsCentered}>
            <Text style={styles.link}>Termos</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Barra fixa só com o CTA */}
      {!isPlus ? (
        <View style={styles.ctaBar}>
          <Pressable
            style={[styles.ctaBtn, (!selectedPkg || purchasing) && styles.ctaBtnDisabled]}
            onPress={() => void handlePurchase()}
            disabled={!selectedPkg || purchasing}
            accessibilityRole="button"
          >
            <Text style={styles.ctaBtnText}>{purchasing ? 'Processando...' : 'Iniciar agora'}</Text>
            {!purchasing ? <ChevronRight size={20} color={colors.bg} /> : null}
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 110 },

  /* X fechar */
  closeBtn: { alignSelf: 'flex-end', padding: spacing.md, marginTop: spacing.xs },

  /* Logo */
  logoWrap: { alignItems: 'center', marginBottom: spacing.md },
  logo: { width: 160, height: 60 },

  /* Hero */
  hero: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xl, paddingHorizontal: spacing.md },
  heroTitle: { color: colors.textPrimary, fontSize: 26, ...fontWeight('800'), textAlign: 'center', lineHeight: 32, marginBottom: spacing.sm },
  heroGreeting: { color: colors.textSecondary, fontSize: 16, ...fontWeight('500'), textAlign: 'center' },

  /* Benefícios */
  highlights: { gap: spacing.lg, marginBottom: spacing.xl },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  highlightCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(204,255,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  highlightText: { color: colors.textPrimary, fontSize: 15, ...fontWeight('500'), flex: 1, lineHeight: 21 },

  /* Plans (empilhados) */
  plansCol: { gap: spacing.md, marginBottom: spacing.lg },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    padding: spacing.lg,
    position: 'relative',
  },
  planCardSelected: { borderColor: colors.neon, backgroundColor: 'rgba(204,255,0,0.04)' },
  saveBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    backgroundColor: colors.neon,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  saveBadgeText: { color: colors.bg, fontSize: 11, ...fontWeight('800') },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planPeriod: { color: colors.textSecondary, fontSize: 14, ...fontWeight('600'), marginBottom: 2 },
  planPrice: { color: colors.textPrimary, fontSize: 20, ...fontWeight('800') },
  planPriceSuffix: { color: colors.textSecondary, fontSize: 13, ...fontWeight('400') },
  planWeekly: { color: colors.textSecondary, fontSize: 14, ...fontWeight('600') },

  /* Error */
  errorText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: spacing.lg },
  termsCentered: { alignItems: 'center', marginTop: spacing.sm },

  /* Barra fixa só com o CTA */
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  ctaBtn: {
    height: 56,
    backgroundColor: colors.neon,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: colors.bg, fontSize: 16, ...fontWeight('700') },
  linksCol: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  link: { color: colors.textSecondary, fontSize: 13, ...fontWeight('600') },
});
