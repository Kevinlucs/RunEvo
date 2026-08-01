import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * Placeholder pré-Grupo 4 (docs/fase-6-brief.md §32 reconstrói esta tela por
 * completo com mockup 14). "Meus tênis" (§33) já entra aqui para não ficar
 * inalcançável até o Grupo 4 fechar.
 */
export default function Profile(): JSX.Element {
  const { session, signOut } = useAuth();
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.name}>{session?.user.email ?? 'Atleta'}</Text>
        <Text style={styles.note}>Dados completos e RunEvo+ entram no Grupo 4.</Text>
      </View>
      <View style={styles.action}>
        <NeonButton label="Meus tênis" variant="secondary" onPress={() => router.push('/profile/shoes')} />
      </View>
      <NeonButton label="Sair" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  name: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('700') },
  note: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm },
  action: { marginBottom: spacing.md },
});
