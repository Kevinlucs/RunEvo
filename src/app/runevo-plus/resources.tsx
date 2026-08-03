import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { LockedSection } from '@/components/paywall/LockedSection';
import { useEntitlement } from '@/hooks/useEntitlement';
import { PLUS_FEATURES, FREE_FEATURES } from '@/services/subscription/plus-features';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

function FeatureRow({ icon, label }: { icon: IconName; label: string }): JSX.Element {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.neon} />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
  );
}

/**
 * docs/fase-6-brief.md §34 — "Meus recursos": lista o que o plano atual
 * libera; para Free, mostra também o que o Plus adicionaria (escurecido,
 * um só CTA via LockedSection). `isPlus` só decide o que a UI exibe —
 * quem decide Free/Plus é sempre o SubscriptionService via useEntitlement().
 */
export default function RunEvoResources(): JSX.Element {
  const { isPlus } = useEntitlement();

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Seu plano atual — {isPlus ? 'RunEvo+' : 'Livre'}</Text>
        <View style={styles.group}>
          {FREE_FEATURES.map((f) => (
            <FeatureRow key={f.label} icon={f.icon} label={f.label} />
          ))}
          {isPlus && PLUS_FEATURES.map((f) => <FeatureRow key={f.label} icon={f.icon} label={f.label} />)}
        </View>

        {!isPlus && (
          <>
            <Text style={styles.sectionLabel}>Com RunEvo+ você também tem</Text>
            <LockedSection
              title="Desbloqueie recursos avançados"
              ctaLabel="Assinar RunEvo+"
              onPressCta={() => router.push({ pathname: '/runevo-plus', params: { reason: 'history' } })}
            >
              <View style={styles.group}>
                {PLUS_FEATURES.map((f) => (
                  <FeatureRow key={f.label} icon={f.icon} label={f.label} />
                ))}
              </View>
            </LockedSection>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  sectionLabel: {
    color: colors.neon,
    fontSize: fontSizes.caption,
    ...fontWeight('800'),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowLabel: { color: colors.textPrimary, fontSize: fontSizes.body, flexShrink: 1 },
});
