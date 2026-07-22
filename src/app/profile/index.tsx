import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, fontSizes } from '@/theme';

export default function Profile(): JSX.Element {
  const { session, signOut } = useAuth();
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.name}>{session?.user.email ?? 'Atleta'}</Text>
        <Text style={styles.note}>Dados, tênis, RunEvo+ e configurações entram na Fase 6.</Text>
      </View>
      <NeonButton label="Sair" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  name: { color: colors.textPrimary, fontSize: fontSizes.xl, fontWeight: '700' },
  note: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm },
});
