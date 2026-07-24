import { Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors, spacing, fontSizes } from '@/theme';

/** docs/fase-4-brief.md Grupo 4 (§28): "Como executar" — prescrição do motor, formatada linha a linha. */
export function WorkoutDescriptionCard({ lines }: { lines: string[] }): JSX.Element {
  return (
    <Card title="Como executar">
      {lines.length ? (
        lines.map((line, index) => (
          <Text key={index} style={styles.line}>
            {line}
          </Text>
        ))
      ) : (
        <Text style={styles.empty}>Descrição ainda não preenchida para este treino.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  line: { color: colors.textPrimary, fontSize: fontSizes.body, marginBottom: spacing.xs, lineHeight: 20 },
  empty: { color: colors.textMuted, fontSize: fontSizes.body },
});
