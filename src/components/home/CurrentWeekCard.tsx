import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Workout } from '@/domain/entities';

const STATUS_BADGE: Record<Workout['status'], { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  pending: { label: 'Pendente', icon: 'hourglass-outline', color: colors.warning },
  completed: { label: 'Concluído', icon: 'checkmark-circle', color: colors.success },
  skipped: { label: 'Pulado', icon: 'close-circle-outline', color: colors.textMuted },
};

/** docs/fase-4-brief.md Grupo 2.2 (§27, bloco 5): treinos da semana corrente como cards individuais. */
export function CurrentWeekCard({ weekNumber, workouts }: { weekNumber: number; workouts: Workout[] }): JSX.Element {
  const sorted = [...workouts].sort((a, b) => a.week_index - b.week_index);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Semana Atual</Text>

      {sorted.length === 0 ? (
        <Text style={styles.empty}>Nenhum treino cadastrado nesta semana.</Text>
      ) : (
        sorted.map((workout) => {
          const badge = STATUS_BADGE[workout.status];
          const dateObj = workout.workout_date ? new Date(workout.workout_date) : null;
          const day = dateObj ? dateObj.getDate().toString().padStart(2, '0') : '--';
          const month = dateObj
            ? dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
            : '---';

          return (
            <View key={workout.id} style={styles.card}>
              <View style={styles.dateCircle}>
                <Text style={styles.dateDay}>{day}</Text>
                <Text style={styles.dateMonth}>{month}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{workout.title ?? 'Treino'}</Text>
                <Text style={styles.subtitle}>
                  {workout.day_label ?? '-'} - {workout.day_type ?? 'Base'}
                </Text>
                <View style={styles.badgeRow}>
                  <Ionicons name={badge.icon} size={14} color={badge.color} />
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>
              <Text style={styles.km}>{workout.planned_km ?? 0}km</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.lg },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800'), marginBottom: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  dateCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neonMuted,
    borderWidth: 1,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  dateDay: { color: colors.neon, fontSize: fontSizes.base, ...fontWeight('800'), lineHeight: 18 },
  dateMonth: { color: colors.neon, fontSize: 10, ...fontWeight('600'), lineHeight: 12 },
  info: { flex: 1, marginRight: spacing.sm },
  title: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 2 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    backgroundColor: colors.cardElevated,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeText: { fontSize: fontSizes.caption, ...fontWeight('600') },
  km: { color: colors.neon, fontSize: fontSizes.lg, ...fontWeight('800') },
  empty: { color: colors.textMuted, fontSize: fontSizes.body },
});
