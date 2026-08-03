import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useAuth } from '@/hooks/useAuth';
import { subscriptionService, completePurchase, completeRestore, annualDiscountPercent, PLUS_FEATURES } from '@/services/subscription';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { SubscriptionPackage } from '@/domain/entities';

const CONVERSION_MESSAGES: Record<string, string> = {
  'first-cycle': 'Você concluiu seu primeiro ciclo. Acompanhe sua evolução, compare estratégias e leve seu histórico — RunEvo+.',
  history: 'Desbloqueie o histórico completo entre ciclos, comparação de planilhas e auditoria avançada da IA.',
};
const DEFAULT_MESSAGE = 'Leve sua evolução além de uma prova: histórico entre ciclos, comparação de planilhas e exportação em Excel.';

type PlanCycle = 'monthly' | 'annual';

/**
 * docs/fase-7-brief.md Grupo 2 — oferta RunEvo+ com compra real. Preços vêm
 * sempre da loja (`getOfferings()`), nunca hardcoded — variam por moeda e
 * podem mudar sem deploy. `isPlus` só decide o que ESTA tela mostra; quem
 * decide Free/Plus de verdade é sempre `useEntitlement()`.
 */
export default function RunEvoPlusOffer(): JSX.Element {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
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
  const monthlyPkg = packages.find((p) => p.period === 'monthly');
  const annualPkg = packages.find((p) => p.period === 'annual');
  const selectedPkg = cycle === 'monthly' ? monthlyPkg : annualPkg;
  const discount = annualDiscountPercent(monthlyPkg, annualPkg);

  useEffect(() => {
    // Se a loja só devolveu um dos dois pacotes, seleciona o que existe.
    if (cycle === 'annual' && !annualPkg && monthlyPkg) setCycle('monthly');
    else if (cycle === 'monthly' && !monthlyPkg && annualPkg) setCycle('annual');
  }, [cycle, monthlyPkg, annualPkg]);

  const message = (reason && CONVERSION_MESSAGES[reason]) || DEFAULT_MESSAGE;

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
      router.back();
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="flash" size={32} color={colors.neon} />
          <Text style={styles.heroTitle}>RunEvo+</Text>
          <Text style={styles.heroMessage}>{isPlus ? 'Você já é assinante RunEvo+. Obrigado por apoiar o RunEvo!' : message}</Text>
        </View>

        <View style={styles.featureWrap}>
          <View style={[styles.featureList, !isPlus && styles.featureListDimmed]} pointerEvents={isPlus ? 'auto' : 'none'}>
            {PLUS_FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Ionicons name={f.icon} size={20} color={colors.neon} />
                <Text style={styles.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>
          {!isPlus && (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={16} color={colors.neon} />
            </View>
          )}
        </View>

        {!isPlus && (
          <>
            {offeringsQuery.isError && (
              <Text style={styles.errorText}>Não foi possível carregar os planos agora. Verifique sua conexão e tente novamente.</Text>
            )}

            <View style={styles.plans}>
              <Pressable
                style={[styles.planCard, cycle === 'monthly' && styles.planCardSelected]}
                onPress={() => setCycle('monthly')}
                accessibilityRole="button"
                accessibilityState={{ selected: cycle === 'monthly' }}
                disabled={!monthlyPkg}
              >
                <Text style={styles.planLabel}>Mensal</Text>
                {monthlyPkg && <Text style={styles.planPrice}>{monthlyPkg.priceString}</Text>}
              </Pressable>
              <Pressable
                style={[styles.planCard, cycle === 'annual' && styles.planCardSelected]}
                onPress={() => setCycle('annual')}
                accessibilityRole="button"
                accessibilityState={{ selected: cycle === 'annual' }}
                disabled={!annualPkg}
              >
                <Text style={styles.planLabel}>Anual</Text>
                {annualPkg && <Text style={styles.planPrice}>{annualPkg.priceString}</Text>}
                {discount !== null && <Text style={styles.planBadge}>Economize {discount}%</Text>}
              </Pressable>
            </View>

            <View style={styles.cta}>
              <NeonButton
                label={selectedPkg ? `Assinar — ${selectedPkg.priceString}` : 'Assinar'}
                onPress={() => void handlePurchase()}
                loading={purchasing}
                disabled={!selectedPkg || purchasing}
              />
            </View>

            <Pressable onPress={() => void handleRestore()} accessibilityRole="button" disabled={restoring}>
              <Text style={styles.link}>{restoring ? 'Restaurando…' : 'Restaurar compra'}</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={handleTerms} accessibilityRole="button">
          <Text style={styles.link}>Termos</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.sm },
  heroTitle: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('900') },
  heroMessage: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center', paddingHorizontal: spacing.md },
  featureWrap: { position: 'relative', marginBottom: spacing.xl },
  featureList: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  featureListDimmed: { opacity: 0.4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureText: { color: colors.textPrimary, fontSize: fontSizes.body, flexShrink: 1 },
  lockBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  plans: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  planCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  planCardSelected: { borderColor: colors.neon, backgroundColor: colors.cardElevated },
  planLabel: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
  planPrice: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('600') },
  planBadge: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('700') },
  cta: { marginBottom: spacing.lg },
  link: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    ...fontWeight('700'),
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
