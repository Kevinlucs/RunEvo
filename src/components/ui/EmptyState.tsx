import { View, Text, StyleSheet } from 'react-native';
import { NeonButton } from './NeonButton';
import { colors, spacing, fontSizes } from '@/theme';

interface Props {
  title: string;
  message: string;
  ctaLabel: string;
  onPressCta: () => void;
}

/**
 * Estado vazio compacto (docs/fase-3-brief.md §Grupo 5, enunciado §27) — nunca
 * uma área preta grande e vazia. Usado nas abas quando o atleta ainda não tem
 * planilha ativa.
 */
export function EmptyState({ title, message, ctaLabel, onPressCta }: Props): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <NeonButton label={ctaLabel} onPress={onPressCta} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: fontSizes.lg, fontWeight: '800' },
  message: { color: colors.textSecondary, fontSize: fontSizes.body },
});
