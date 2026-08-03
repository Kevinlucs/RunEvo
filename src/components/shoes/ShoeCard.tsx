import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { classifyShoeWear } from '@/services/shoes/shoes.service';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Shoe } from '@/domain/entities';

const WEAR_COLOR = { ok: colors.neon, warning: '#FFB020', danger: colors.error } as const;

function shoeTitle(shoe: Shoe): string {
  return shoe.nickname ?? ([shoe.brand, shoe.model].filter(Boolean).join(' ') || shoe.model);
}

interface Props {
  shoe: Shoe;
  onPress: () => void;
}

/** Lista de tênis (docs/fase-6-brief.md §33) — barra de desgaste âmbar/vermelha perto do limite. */
export function ShoeCard({ shoe, onPress }: Props): JSX.Element {
  const wear = classifyShoeWear(shoe.current_km, shoe.max_km);
  const ratio = shoe.max_km > 0 ? Math.min(shoe.current_km / shoe.max_km, 1) : 0;

  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{shoeTitle(shoe)}</Text>
          {!shoe.is_active && <Text style={styles.retiredBadge}>Aposentado</Text>}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>

      <Text style={styles.km}>
        {shoe.current_km.toFixed(0)} km <Text style={styles.kmMax}>/ {shoe.max_km.toFixed(0)} km</Text>
      </Text>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: WEAR_COLOR[wear] }]} />
      </View>

      {wear !== 'ok' && shoe.is_active && (
        <Text style={[styles.warning, { color: WEAR_COLOR[wear] }]}>
          {wear === 'danger' ? 'Limite atingido — considere trocar' : 'Aproximando do limite'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  title: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700'), flexShrink: 1 },
  retiredBadge: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  km: { color: colors.textSecondary, fontSize: fontSizes.body, marginBottom: spacing.sm },
  kmMax: { color: colors.textMuted },
  barTrack: { height: 6, borderRadius: radii.pill, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radii.pill },
  warning: { fontSize: fontSizes.caption, marginTop: spacing.sm, ...fontWeight('700') },
});
