import { Text, StyleSheet } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, fontSizes } from '@/theme';

export default function Stats(): JSX.Element {
  return (
    <Screen>
      <Text style={styles.h1}>Estatísticas</Text>
      <Text style={styles.note}>Cards e gráficos entram na Fase 6.</Text>
    </Screen>
  );
}
const styles = StyleSheet.create({
  h1: { color: colors.textPrimary, fontSize: fontSizes.title, fontWeight: '800', marginTop: spacing.xl },
  note: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm },
});
