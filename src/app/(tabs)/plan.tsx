import { Text, StyleSheet } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, fontSizes } from '@/theme';

export default function Plan(): JSX.Element {
  return (
    <Screen>
      <Text style={styles.h1}>Treinos</Text>
      <Text style={styles.note}>Ciclo, fases, editor manual e exportação entram nas Fases 4–7.</Text>
    </Screen>
  );
}
const styles = StyleSheet.create({
  h1: { color: colors.textPrimary, fontSize: fontSizes.title, fontWeight: '800', marginTop: spacing.xl },
  note: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm },
});
