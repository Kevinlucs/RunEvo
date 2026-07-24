import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, radii, spacing, fontSizes, MIN_TOUCH_TARGET } from '@/theme';
import type { PhaseGroup } from '@/services/plan/plan-cycle.service';

/** Ciclo completo por fase (§29) — toque abre o detalhe da fase (Grupo 3). */
export function PhaseSummaryPills({ groups }: { groups: PhaseGroup[] }): JSX.Element {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {groups.map((group, index) => (
        <Pressable
          key={`${group.phase}-${index}`}
          accessibilityRole="button"
          accessibilityLabel={`Ver fase ${group.phase}`}
          onPress={() => router.push(`/plan/phase/${encodeURIComponent(group.phase)}`)}
          style={styles.pill}
        >
          <Text style={styles.phase}>{group.phase}</Text>
          <Text style={styles.weeks}>
            {group.weeks.length} {group.weeks.length === 1 ? 'semana' : 'semanas'}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingBottom: spacing.md },
  pill: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: 96,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  phase: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '800' },
  weeks: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 2 },
});
