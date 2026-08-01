import { useState } from 'react';
import { ScrollView, View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { useEntitlement } from '@/hooks/useEntitlement';
import { PLUS_FEATURES } from '@/services/subscription/plus-features';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

const CONVERSION_MESSAGES: Record<string, string> = {
  'first-cycle': 'Você concluiu seu primeiro ciclo. Acompanhe sua evolução, compare estratégias e leve seu histórico — RunEvo+.',
  history: 'Desbloqueie o histórico completo entre ciclos, comparação de planilhas e auditoria avançada da IA.',
};
const DEFAULT_MESSAGE = 'Leve sua evolução além de uma prova: histórico entre ciclos, comparação de planilhas e exportação em Excel.';

type PlanCycle = 'monthly' | 'yearly';

function comingSoon(feature: string): void {
  Alert.alert('Em breve', `${feature} chega com o pagamento real na Fase 7.`);
}

/**
 * docs/fase-6-brief.md §34 — oferta RunEvo+. Regras estritas do enunciado:
 * conteúdo Plus visível porém escurecido, UM CTA só (nunca um botão por
 * card — problema explícito no legado), botão "Assinar" desabilitado
 * ("Em breve") porque o pagamento real é a Fase 7 — não simulamos compra
 * aqui. `isPlus` só decide o que ESTA tela mostra; a decisão em si vive no
 * SubscriptionService via useEntitlement(), nunca na UI.
 */
export default function RunEvoPlusOffer(): JSX.Element {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { isPlus } = useEntitlement();
  const [cycle, setCycle] = useState<PlanCycle>('yearly');

  const message = (reason && CONVERSION_MESSAGES[reason]) || DEFAULT_MESSAGE;

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
            <View style={styles.plans}>
              <Pressable
                style={[styles.planCard, cycle === 'monthly' && styles.planCardSelected]}
                onPress={() => setCycle('monthly')}
                accessibilityRole="button"
                accessibilityState={{ selected: cycle === 'monthly' }}
              >
                <Text style={styles.planLabel}>Mensal</Text>
              </Pressable>
              <Pressable
                style={[styles.planCard, cycle === 'yearly' && styles.planCardSelected]}
                onPress={() => setCycle('yearly')}
                accessibilityRole="button"
                accessibilityState={{ selected: cycle === 'yearly' }}
              >
                <Text style={styles.planLabel}>Anual</Text>
                <Text style={styles.planBadge}>Economize 30%</Text>
              </Pressable>
            </View>

            <View style={styles.cta}>
              <NeonButton label="Assinar — Em breve" onPress={() => {}} disabled />
            </View>

            <Pressable onPress={() => comingSoon('Restaurar compra')} accessibilityRole="button">
              <Text style={styles.link}>Restaurar compra</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => comingSoon('Termos')} accessibilityRole="button">
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
