import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

interface Props {
  selected: boolean;
  onPress: () => void;
  emoji?: string;
  title: string;
  description?: string;
}

/**
 * Full-width selectable card button (nível, terreno).
 * Neon border when selected, dark background otherwise.
 */
export function SelectableCard({ selected, onPress, emoji, title, description }: Props): JSX.Element {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <View style={styles.content}>
        <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
        {description ? <Text style={[styles.description, selected && styles.descSelected]}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.neon,
    backgroundColor: 'rgba(204,255,0,0.08)',
  },
  emoji: { fontSize: 22, marginRight: spacing.md },
  content: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
  titleSelected: { color: colors.neon },
  description: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('400'), marginTop: 2 },
  descSelected: { color: colors.textSecondary },
});
