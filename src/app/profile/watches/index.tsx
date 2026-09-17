import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { WATCH_PROVIDERS, type WatchProvider } from '@/services/integrations/watch-providers';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';

const WATCH_PROVIDER_ICONS: Record<WatchProvider['id'], number> = {
  garmin: require('../../../../assets/icons app/garmin-connect.png'),
  coros: require('../../../../assets/icons app/coros.png'),
  polar: require('../../../../assets/icons app/polar.png'),
  amazfit: require('../../../../assets/icons app/amazifit.png'),
};

export default function WatchesScreen(): JSX.Element {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="watch-outline" size={32} color={colors.neon} />
          </View>
          <Text style={styles.title}>Conecte seu relógio</Text>
          <Text style={styles.subtitle}>
            Escolha a plataforma do seu dispositivo para integrar suas corridas ao RunEvo.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Plataformas disponíveis</Text>
        <View style={styles.list}>
          {WATCH_PROVIDERS.map((provider) => {
            const isGarmin = provider.id === 'garmin';
            return (
              <Pressable
                key={provider.id}
                onPress={() => isGarmin && router.push('/profile/watches/garmin' as never)}
                disabled={!isGarmin}
                accessibilityRole="button"
                accessibilityLabel={`${provider.name}${isGarmin ? '' : ', em breve'}`}
                style={({ pressed }) => [
                  styles.providerCard,
                  !isGarmin && styles.providerCardDisabled,
                  pressed && isGarmin && styles.providerCardPressed,
                ]}
              >
                <View style={styles.brandIcon}>
                  <Image
                    source={WATCH_PROVIDER_ICONS[provider.id]}
                    style={styles.brandImage}
                    contentFit="contain"
                    accessibilityLabel={`Ícone ${provider.name}`}
                  />
                </View>
                <View style={styles.providerCopy}>
                  <Text style={[styles.providerName, !isGarmin && styles.disabledText]}>
                    {provider.name}
                  </Text>
                  <Text style={styles.providerDescription}>{provider.description}</Text>
                </View>
                {isGarmin ? (
                  <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
                ) : (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>EM BREVE</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.xxxl },
  heroIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neonMuted,
    borderRadius: radii.xl,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    ...fontWeight('800'),
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    ...fontWeight('800'),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.md },
  providerCard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  providerCardPressed: { opacity: 0.68 },
  providerCardDisabled: { opacity: 0.54 },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.cardElevated,
  },
  brandImage: { width: '100%', height: '100%' },
  providerCopy: { flex: 1 },
  providerName: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('800') },
  providerDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: 18,
    marginTop: 2,
  },
  disabledText: { color: colors.textSecondary },
  soonBadge: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  soonBadgeText: {
    color: colors.textMuted,
    fontSize: 10,
    ...fontWeight('800'),
    letterSpacing: 0.5,
  },
});
