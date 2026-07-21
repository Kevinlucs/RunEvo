import { Text, StyleSheet } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, fontSizes } from '@/theme';

export default function Home(): JSX.Element {
  return (
    <Screen>
      <Text style={styles.h1}>Início</Text>
      <Text style={styles.note}>Home completa entra na Fase 4 (próximo treino, objetivo, semana, Adaptive Training).</Text>
    </Screen>
  );
}
const styles = StyleSheet.create({
  h1: { color: colors.textPrimary, fontSize: fontSizes.title, fontWeight: '800', marginTop: spacing.xl },
  note: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm },
});
