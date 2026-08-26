import { View, Text, StyleSheet } from 'react-native';
import { Badge } from '@/components/forms/Badge';
import { colors, spacing, fontWeight } from '@/theme';

interface Props {
  emoji?: string;
  title: string;
  description?: string;
  required?: boolean;
  divider?: boolean;
}

/** Título de seção padronizado do formulário IA Evo (emoji + título + badge OBRIGATÓRIO + descrição). */
export function SectionHeader({ emoji, title, description, required = false, divider = false }: Props): JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {required ? (
          <View style={styles.badgeWrap}>
            <Badge label="OBRIGATÓRIO" tone="error" size="sm" />
          </View>
        ) : null}
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {divider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xxl, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  emoji: { fontSize: 18 },
  title: { color: colors.textPrimary, fontSize: 18, ...fontWeight('800') },
  badgeWrap: { marginLeft: spacing.xs },
  description: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginTop: spacing.xs, lineHeight: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: spacing.md },
});
