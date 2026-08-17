import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, fontSizes, MIN_TOUCH_TARGET, fontWeight } from '@/theme';
import { formatShortDate } from '@/utils/time';
import type { Workout } from '@/domain/entities';

/** Pace numérico = contém ":" seguido de dígitos (ex: "7:26/km", "5:30"). */
function getNumericPace(workout: Workout): string | null {
  const pace = workout.planned_pace;
  if (!pace) return null;
  if (/\d+:\d+/.test(pace)) return pace;
  return null;
}

/**
 * Card do próximo treino — compacto (~130px).
 * Pixel-perfect com mockup TELA HOME 1.
 */
export function NextWorkoutCard({ workout, onPress }: { workout: Workout; onPress: () => void }): JSX.Element {
  const pace = getNumericPace(workout);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir treino: ${workout.title ?? 'treino'}`}
      onPress={onPress}
      style={styles.pressable}
    >
      <LinearGradient
        colors={['rgba(204,255,0,0.18)', 'rgba(204,255,0,0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.metaText}>
              {workout.phase ?? 'Base'} • S{workout.week_number}
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {workout.title ?? 'Treino'}
            </Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.subtitle}>
                {workout.day_label ?? '-'}, {formatShortDate(workout.workout_date)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.neon} />
        </View>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Ionicons name="footsteps-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.chipText}>{workout.planned_km ?? 0} km</Text>
          </View>
          {pace ? (
            <View style={styles.chip}>
              <Ionicons name="timer-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.chipText}>{pace}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { marginBottom: spacing.md },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.3)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    minHeight: MIN_TOUCH_TARGET,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  info: { flex: 1, marginRight: spacing.md },
  metaText: { color: colors.neon, fontSize: 13, ...fontWeight('600'), textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: colors.textPrimary, fontSize: 22, ...fontWeight('800'), marginTop: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('400') },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('600') },
});
