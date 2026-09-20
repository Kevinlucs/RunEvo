import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Screen } from '@/components/ui/Screen';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';

const PROVIDERS = [
  { name: 'Garmin Connect', logo: require('../../assets/icons app/garmin-connect.png') },
  { name: 'COROS', logo: require('../../assets/icons app/coros.png') },
  { name: 'Polar', logo: require('../../assets/icons app/polar.png') },
  { name: 'Amazfit', logo: require('../../assets/icons app/amazifit.png') },
] as const;

/** Referência visual; não é uma rota do aplicativo. */
export default function FutureWatchIntegrationsReference(): JSX.Element {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroIcon}>
          <Ionicons name="watch-outline" size={32} color={colors.neon} />
        </View>
        <Text style={styles.title}>Integrações com relógios</Text>
        <Text style={styles.subtitle}>
          Em breve, o RunEvo oferecerá conexões oficiais para seus dispositivos.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Em desenvolvimento</Text>
          <Text style={styles.cardText}>
            Garmin, COROS, Polar e Amazfit serão disponibilizados quando as integrações oficiais
            estiverem prontas.
          </Text>
        </View>
        <View style={styles.providers}>
          {PROVIDERS.map((provider) => (
            <View key={provider.name} style={styles.provider}>
              <Image source={provider.logo} style={styles.providerLogo} contentFit="contain" />
              <Text style={styles.providerName}>{provider.name}</Text>
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
    borderRadius: radii.xl,
    backgroundColor: colors.neonMuted,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800') },
  cardText: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 22 },
  providers: { gap: spacing.md, marginTop: spacing.xl },
  provider: {
    minHeight: 68,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  providerLogo: { width: 38, height: 38, borderRadius: radii.sm },
  providerName: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
});
