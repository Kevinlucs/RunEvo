import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Workout } from '@/domain/entities';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const STATUS_BADGE: Record<Workout['status'], { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  pending: { label: 'Pendente', icon: 'hourglass-outline', color: colors.neon, bg: colors.neonMuted },
  completed: { label: 'Concluído', icon: 'checkmark-circle', color: colors.success, bg: 'rgba(76,175,80,0.15)' },
  skipped: { label: 'Pulado', icon: 'close-circle-outline', color: colors.warning, bg: 'rgba(255,152,0,0.15)' },
};

/** docs/fase-4-brief.md Grupo 2.2 (§27, bloco 5): treinos da semana corrente, pixel-perfect TELA HOME 1-2. */
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
              <View style={styles.dateSquare}>
                <Text style={styles.dateDay}>{day}</Text>
                <Text style={styles.dateMonth}>{month}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{workout.title ?? 'Treino'}</Text>
                <Text style={styles.subtitle}>
                  {workout.day_label ?? '-'} - {capitalize(workout.phase ?? 'Base')}
                </Text>
                <View style={[styles.badgeRow, { backgroundColor: badge.bg }]}>
                  <Ionicons name={badge.icon} size={12} color={badge.color} />
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
  sectionTitle: { color: colors.textPrimary, fontSize: 20, ...fontWeight('800'), marginBottom: spacing.md },
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
  dateSquare: {
    width: 44,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  dateDay: { color: colors.bg, fontSize: 18, ...fontWeight('800'), lineHeight: 22 },
  dateMonth: { color: colors.bg, fontSize: 11, ...fontWeight('600'), lineHeight: 13 },
  info: { flex: 1, marginRight: spacing.sm },
  title: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('800') },
  subtitle: { color: colors.textSecondary, fontSize: 13, ...fontWeight('400'), marginTop: 2 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  badgeText: { fontSize: 11, ...fontWeight('600') },
  km: { color: colors.neon, fontSize: 18, ...fontWeight('800') },
  empty: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('400') },
});
