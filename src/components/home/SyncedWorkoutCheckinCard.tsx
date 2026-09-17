import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Workout } from '@/domain/entities';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';

interface Props {
  workout: Workout;
  pendingCount: number;
  onPress: () => void;
}

/** Lembrete não bloqueante para uma corrida que o RunEvo já confirmou. */
export function SyncedWorkoutCheckinCard({ workout, pendingCount, onPress }: Props): JSX.Element {
  const distance = workout.completed_km ?? workout.planned_km ?? 0;
  const provider = 'Strava';
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="checkmark" size={22} color={colors.bg} />
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>TREINO SINCRONIZADO</Text>
        <Text style={styles.title}>Seu treino foi concluído</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {workout.title ?? 'Corrida'}
        </Text>
        <Text style={styles.meta}>
          {distance.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km • Via {provider}
        </Text>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Fazer check-in</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.bg} />
        </Pressable>
        {pendingCount > 1 ? (
          <Text style={styles.remaining}>
            Mais {pendingCount - 1}{' '}
            {pendingCount - 1 === 1 ? 'check-in pendente' : 'check-ins pendentes'}.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: 'rgba(204,255,0,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.38)',
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: { flex: 1 },
  eyebrow: { color: colors.neon, fontSize: 10, ...fontWeight('800'), letterSpacing: 0.9 },
  title: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800'), marginTop: 3 },
  subtitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    ...fontWeight('600'),
    marginTop: spacing.sm,
  },
  meta: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 2 },
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neon,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  buttonText: { color: colors.bg, fontSize: fontSizes.caption, ...fontWeight('800') },
  remaining: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm },
  pressed: { opacity: 0.8 },
});
