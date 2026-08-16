import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, fontSizes, MIN_TOUCH_TARGET, fontWeight } from '@/theme';
import { formatShortDate } from '@/utils/time';
import type { Workout } from '@/domain/entities';

/**
 * docs/fase-4-brief.md Grupo 2.2 (§27, bloco 3): degradê verde sutil, chips
 * compactos (distância + pace) inline embaixo, chevron neon à direita.
 * Layout alinhado pixel-perfect com mockup TELA HOME 1.
 */
export function NextWorkoutCard({ workout, onPress }: { workout: Workout; onPress: () => void }): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir treino: ${workout.title ?? 'treino'}`}
      onPress={onPress}
      style={styles.pressable}
    >
      <LinearGradient
        colors={['rgba(204,255,0,0.08)', colors.card]}
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
          <Ionicons name="chevron-forward" size={22} color={colors.neon} />
        </View>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Ionicons name="footsteps-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.chipText}>{workout.planned_km ?? 0} km</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="timer-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.chipText}>{workout.planned_pace ?? '-'}</Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { marginBottom: spacing.lg },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  info: { flex: 1, marginRight: spacing.md },
  metaText: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('700'), textTransform: 'uppercase' },
  title: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800'), marginTop: spacing.xs },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardElevated,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('600') },
});
