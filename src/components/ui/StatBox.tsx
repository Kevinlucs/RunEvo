import type { PropsWithChildren } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

interface Props {
  value: string;
  label: string;
  /** Destaque neon no valor (ex.: dias restantes, km da meta) — default branco. */
  emphasis?: boolean;
}

/**
 * Caixa de estatística compacta (valor grande + rótulo), usada em pares/trios
 * dentro de cards da Home e do detalhe do treino — calibração visual em cima
 * dos mockups de design-reference/ (docs/fase-4-brief.md §27/§28).
 */
export function StatBox({ value, label, emphasis = false }: Props): JSX.Element {
  return (
    <View style={styles.box}>
      <Text style={[styles.value, emphasis && styles.valueEmphasis]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function StatBoxRow({ children }: PropsWithChildren): JSX.Element {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  box: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  value: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800') },
  valueEmphasis: { color: colors.neon },
  label: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: spacing.xs },
});
