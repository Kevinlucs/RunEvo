import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, fontSizes, MIN_TOUCH_TARGET } from '@/theme';
import { formatShortDate } from '@/utils/time';
import type { Workout } from '@/domain/entities';

/**
 * docs/fase-4-brief.md Grupo 2.2 (§27, bloco 3): degradê verde muito sutil,
 * sem círculo verde sólido. Toque abre o detalhe do treino (Grupo 4).
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
        colors={['rgba(204,255,0,0.10)', colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {workout.phase ?? 'Base'} · Semana {workout.week_number}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {workout.title ?? 'Treino'}
            </Text>
            <Text style={styles.subtitle}>
              {workout.day_label ?? '-'} · {formatShortDate(workout.workout_date)}
            </Text>
            <Text style={styles.stats}>
              {workout.planned_km ?? 0} km · {workout.planned_pace ?? '-'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.neon} />
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
  meta: { marginBottom: spacing.sm },
  metaText: { color: colors.textSecondary, fontSize: fontSizes.caption, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flex: 1, marginRight: spacing.md },
  title: { color: colors.textPrimary, fontSize: fontSizes.xl, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs },
  stats: { color: colors.neon, fontSize: fontSizes.body, fontWeight: '700', marginTop: spacing.xs },
});
