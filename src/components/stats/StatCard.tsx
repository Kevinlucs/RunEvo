import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  /** Card cheio (ex.: "Distância total") em vez do tamanho compacto da grade 2x2. */
  large?: boolean;
  /** Cor do rótulo — default cinza secundário; usado para destacar (ex.: classificação de IMC). */
  labelColor?: string;
}

/**
 * docs/fase-6-brief.md Grupo 2 (§31, mockup 13) — ícone + valor + rótulo.
 * `StatBox` (ui/) não tem ícone e é usado em 3+ telas com esse contrato
 * visual fixo; em vez de mexer nele, um componente próprio para a grade de
 * Estatísticas.
 */
export function StatCard({ icon, value, label, large = false, labelColor }: Props): JSX.Element {
  return (
    <View style={[styles.card, large && styles.cardLarge]}>
      <Ionicons name={icon} size={large ? 26 : 20} color={colors.textSecondary} />
      <Text style={[styles.value, large && styles.valueLarge]}>{value}</Text>
      <Text style={[styles.label, labelColor && { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardLarge: { paddingVertical: spacing.xl },
  value: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800'), marginTop: spacing.xs },
  valueLarge: { fontSize: fontSizes.display },
  label: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    ...fontWeight('700'),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
