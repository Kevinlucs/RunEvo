import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { WeekMeta } from '@/services/plan/plan-cycle.service';

function Badge({ label, tone }: { label: string; tone: 'neon' | 'muted' }): JSX.Element {
  return (
    <View style={[styles.badge, tone === 'neon' ? styles.badgeNeon : styles.badgeMuted]}>
      <Text style={[styles.badgeText, tone === 'neon' ? styles.badgeTextNeon : styles.badgeTextMuted]}>{label}</Text>
    </View>
  );
}

/** Cabeçalho de seção da SectionList de Treinos (§29) — uma semana por seção. */
export function WeekSectionHeader({ week }: { week: WeekMeta }): JSX.Element {
  return (
    <View style={[styles.wrap, week.isCurrent && styles.wrapCurrent]}>
      <View style={styles.left}>
        <Text style={styles.label}>
          {week.label} · {week.phase}
        </Text>
        <Text style={styles.stats}>
          {week.totalKm} km · {week.workoutCount} treinos
        </Text>
      </View>
      <View style={styles.badges}>
        {week.isCurrent && <Badge label="Atual" tone="neon" />}
        {week.isRace && <Badge label="Prova" tone="neon" />}
        {week.isTaper && <Badge label="Polimento" tone="muted" />}
        {week.isRecovery && <Badge label="Recuperação" tone="muted" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wrapCurrent: { borderColor: colors.neon, borderWidth: 1, borderTopWidth: 1 },
  left: { flexShrink: 1, marginRight: spacing.sm },
  label: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('800') },
  stats: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'flex-end' },
  badge: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeNeon: { backgroundColor: colors.glow },
  badgeMuted: { backgroundColor: colors.cardElevated },
  badgeText: { fontSize: fontSizes.caption, ...fontWeight('700') },
  badgeTextNeon: { color: colors.neon },
  badgeTextMuted: { color: colors.textSecondary },
});
