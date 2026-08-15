import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatBox, StatBoxRow } from '@/components/ui/StatBox';
import { colors, radii, spacing, fontSizes, MIN_TOUCH_TARGET, fontWeight } from '@/theme';
import { formatShortDate } from '@/utils/time';
import type { Workout } from '@/domain/entities';

/**
 * docs/fase-4-brief.md Grupo 2.2 (§27, bloco 3): degradê verde muito sutil,
 * sem círculo verde sólido. Toque abre o detalhe do treino (Grupo 4). Só
 * seta — nunca um botão "Iniciar treino" (o mockup de design-reference/
 * sugere um CTA, mas o §27 pede seta; divergência registrada, spec vence).
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
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.metaText}>
              {workout.phase ?? 'Base'} · S{workout.week_number}
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
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </View>
        <StatBoxRow>
          <StatBox icon="footsteps-outline" value={`${workout.planned_km ?? 0} km`} label="Distância" />
          <StatBox icon="timer-outline" value={workout.planned_pace ?? '-'} label="Pace alvo" />
        </StatBoxRow>
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
    marginBottom: spacing.lg,
  },
  info: { flex: 1, marginRight: spacing.md },
  metaText: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('700'), textTransform: 'uppercase' },
  title: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800'), marginTop: spacing.xs },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body },
});
