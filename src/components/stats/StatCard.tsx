import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

interface Props {
  /** Ícone opcional para usos que precisem de reforço visual. */
  icon?: LucideIcon;
  value: string;
  label: string;
  /** Card cheio (ex.: "Distância total") em vez do tamanho compacto da grade 2x2. */
  large?: boolean;
  /** Cor do rótulo — default cinza secundário; usado para destacar (ex.: classificação de IMC). */
  labelColor?: string;
}

/**
 * Card compacto para métricas. O ícone é opcional para que a leitura possa
 * priorizar os números quando a grade já contém rótulos suficientemente claros.
 */
export function StatCard({
  icon: Icon,
  value,
  label,
  large = false,
  labelColor,
}: Props): JSX.Element {
  return (
    <View style={[styles.card, large && styles.cardLarge]}>
      {Icon ? <Icon size={large ? 26 : 20} color={colors.textSecondary} /> : null}
      <Text style={[styles.value, Icon && styles.valueWithIcon, large && styles.valueLarge]}>
        {value}
      </Text>
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
  value: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800') },
  valueWithIcon: { marginTop: spacing.xs },
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
