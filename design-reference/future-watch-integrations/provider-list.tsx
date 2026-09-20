import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';

const PROVIDERS = [
  {
    name: 'Garmin Connect',
    description: 'Integração oficial em preparação.',
    icon: require('../../assets/icons app/garmin-connect.png'),
  },
  {
    name: 'COROS',
    description: 'Integração oficial em preparação.',
    icon: require('../../assets/icons app/coros.png'),
  },
  {
    name: 'Polar',
    description: 'Integração oficial em preparação.',
    icon: require('../../assets/icons app/polar.png'),
  },
  {
    name: 'Amazfit',
    description: 'Integração oficial em preparação.',
    icon: require('../../assets/icons app/amazifit.png'),
  },
] as const;

/** Referência visual; não é uma rota nem uma funcionalidade do app. */
export default function WatchProviderListReference(): JSX.Element {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroIcon}>
          <Ionicons name="watch-outline" size={32} color={colors.neon} />
        </View>
        <Text style={styles.title}>Conecte seu relógio</Text>
        <Text style={styles.subtitle}>
          Escolha a plataforma do seu dispositivo para integrar suas corridas ao RunEvo.
        </Text>
        <Text style={styles.sectionLabel}>Plataformas futuras</Text>
        <View style={styles.list}>
          {PROVIDERS.map((provider) => (
            <View key={provider.name} style={styles.providerCard}>
              <View style={styles.brandIcon}>
                <Image source={provider.icon} style={styles.brandImage} contentFit="contain" />
              </View>
              <View style={styles.providerCopy}>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerDescription}>{provider.description}</Text>
              </View>
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>EM BREVE</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  heroIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neonMuted,
    borderRadius: radii.xl,
    alignSelf: 'center',
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
    marginBottom: spacing.xxxl,
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
