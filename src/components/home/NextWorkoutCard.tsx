import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, fontSizes, MIN_TOUCH_TARGET, fontWeight } from '@/theme';
import { formatShortDate } from '@/utils/time';
import type { Workout } from '@/domain/entities';

/**
 * Card do próximo treino — compacto (~120-130px).
 * Pixel-perfect com mockup TELA HOME 1.
 */
export function NextWorkoutCard({ workout, onPress }: { workout: Workout; onPress: () => void }): JSX.Element {
  const pace = workout.planned_pace;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir treino: ${workout.title ?? 'treino'}`}
      onPress={onPress}
      style={styles.pressable}
    >
      <LinearGradient
        colors={['rgba(204,255,0,0.22)', 'rgba(204,255,0,0.06)']}
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
          <Ionicons name="chevron-forward" size={20} color={colors.neon} />
        </View>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Ionicons name="footsteps-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.chipText}>{workout.planned_km ?? 0} km</Text>
          </View>
          {pace ? (
            <View style={styles.chip}>
              <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
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
    marginBottom: 2,
  },
  info: { flex: 1, marginRight: spacing.md },
  metaText: { color: colors.neon, fontSize: 13, ...fontWeight('600'), textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: colors.textPrimary, fontSize: 22, ...fontWeight('800'), marginTop: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('400') },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { color: colors.textPrimary, fontSize: 13, ...fontWeight('600') },
});
