import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { NeonButton } from '@/components/ui/NeonButton';
import { TrainingZonesCard } from '@/components/workout/TrainingZonesCard';
import { WorkoutDescriptionCard } from '@/components/workout/WorkoutDescriptionCard';
import { CompleteWorkoutModal, type CompleteWorkoutFormInput } from '@/components/workout/CompleteWorkoutModal';
import { SkipWorkoutModal } from '@/components/workout/SkipWorkoutModal';
import { EditWorkoutModal, type EditWorkoutFormInput } from '@/components/workout/EditWorkoutModal';
import { useWorkout } from '@/hooks/useWorkout';
import { usePlan } from '@/hooks/usePlan';
import { useShoes } from '@/hooks/useShoes';
import { useAuthStore } from '@/store/auth.store';
import { readTrainingZones, splitWorkoutDescription, isRaceWorkout } from '@/services/workout/workout-detail.service';
import { completeWorkout, skipWorkout } from '@/services/workout/complete-workout.service';
import { updateWorkout, removeWorkout } from '@/services/plan/edit-workout.service';
import { formatShortDate } from '@/utils/time';
import { colors, radii, spacing, fontSizes, fontWeight, MIN_TOUCH_TARGET } from '@/theme';

/**
 * docs/fase-4-brief.md Grupo 4 (§28) — detalhe do treino.
 * Layout pixel-perfect com mockups DESCRICAO TREINO 1-2.
 */
export default function WorkoutDetail(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.userId);
  const { workout, isLoading: workoutLoading } = useWorkout(id);
  const { plan } = usePlan(workout?.plan_id);
  const { shoes } = useShoes(userId);

  const [completeVisible, setCompleteVisible] = useState(false);
  const [skipVisible, setSkipVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (workoutLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Carregando treino...</Text>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Treino não encontrado.</Text>
      </View>
    );
  }

  const zones = plan ? readTrainingZones(plan) : null;
  const descriptionLines = splitWorkoutDescription(workout.description);
  const isRace = isRaceWorkout(workout);
  const isPending = workout.status === 'pending';

  const handleComplete = async (input: CompleteWorkoutFormInput): Promise<void> => {
    setSubmitting(true);
    setError(null);
    const result = await completeWorkout({ workoutId: workout.id, ...input });
    setSubmitting(false);
    if (!result.ok) { setError(result.error.message); return; }
    setCompleteVisible(false);
    router.back();
  };

  const handleSkip = async (reason: string | null): Promise<void> => {
    setSubmitting(true);
    setError(null);
    const result = await skipWorkout({ workoutId: workout.id, reason });
    setSubmitting(false);
    if (!result.ok) { setError(result.error.message); return; }
    setSkipVisible(false);
    router.back();
  };

  const handleEdit = async (input: EditWorkoutFormInput): Promise<void> => {
    setSubmitting(true);
    setError(null);
    const result = await updateWorkout({
      workoutId: workout.id,
      title: input.title,
      description: input.description,
      plannedKm: input.plannedKm,
      plannedPace: input.plannedPace,
      workoutDate: input.workoutDate,
    });
    setSubmitting(false);
    if (!result.ok) { setError(result.error.message); return; }
    setEditVisible(false);
  };

  const handleRemove = (): void => {
    Alert.alert('Remover treino', 'Este treino será removido do plano. Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          setError(null);
          const result = await removeWorkout(workout.id);
          setSubmitting(false);
          if (!result.ok) { setError(result.error.message); return; }
          router.back();
        },
      },
    ]);
  };

  const phase = workout.phase ?? 'Base';
  const phaseCap = phase.charAt(0).toUpperCase() + phase.slice(1).toLowerCase();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <AppHeader />

          {/* Header centralizado como no mockup */}
          <View style={styles.header}>
            <Text style={styles.meta}>{phaseCap} • S{workout.week_number}</Text>
            <Text style={styles.title}>{workout.title ?? 'Treino'}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateEmoji}>📅</Text>
              <Text style={styles.date}>{workout.day_label ?? '-'}, {formatShortDate(workout.workout_date)}</Text>
            </View>
          </View>

          {/* Cards de métricas empilhados verticalmente */}
          <View style={styles.metricCard}>
            <Text style={styles.metricEmoji}>👟</Text>
            <Text style={styles.metricValue}>{workout.planned_km ?? 0} km</Text>
            <Text style={styles.metricLabel}>DISTÂNCIA</Text>
          </View>

          {workout.planned_pace && /\d+:\d+/.test(workout.planned_pace) ? (
            <View style={styles.metricCard}>
              <Text style={styles.metricEmoji}>⏱️</Text>
              <Text style={styles.metricValue}>{workout.planned_pace}</Text>
              <Text style={styles.metricLabel}>PACE PLANEJADO</Text>
            </View>
          ) : null}

          <TrainingZonesCard zones={zones} />
          <WorkoutDescriptionCard lines={descriptionLines} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {isPending ? (
            <View style={styles.actions}>
              <NeonButton label="✅ Concluir treino" onPress={() => setCompleteVisible(true)} />
              <View style={styles.actionGap} />
              <NeonButton label="Pular treino" variant="secondary" onPress={() => setSkipVisible(true)} />

              {!isRace ? (
                <View style={styles.editRow}>
                  <Pressable accessibilityRole="button" onPress={() => setEditVisible(true)} style={styles.editAction}>
                    <Text style={styles.editActionText}>Editar treino</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={handleRemove} style={styles.editAction}>
                    <Text style={styles.removeActionText}>Remover treino</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <Card title={workout.status === 'completed' ? 'Concluído' : 'Pulado'}>
              {workout.status === 'completed' ? (
                <>
                  <Text style={styles.statusLine}>{workout.completed_km ?? workout.planned_km ?? 0} km realizados</Text>
                  {workout.perceived_effort ? (
                    <Text style={styles.statusLine}>Esforço: {workout.perceived_effort}/10</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.statusLine}>Este treino foi marcado como pulado.</Text>
              )}
              {workout.feedback ? <Text style={styles.statusLine}>{workout.feedback}</Text> : null}
            </Card>
          )}
        </ScrollView>
      </Screen>

      <CompleteWorkoutModal
        visible={completeVisible}
        workout={workout}
        shoes={shoes}
        submitting={submitting}
        onCancel={() => setCompleteVisible(false)}
        onConfirm={handleComplete}
      />
      <SkipWorkoutModal
        visible={skipVisible}
        workout={workout}
        submitting={submitting}
        onCancel={() => setSkipVisible(false)}
        onConfirm={handleSkip}
      />
      <EditWorkoutModal
        visible={editVisible}
        workout={workout}
        submitting={submitting}
        onCancel={() => setEditVisible(false)}
        onConfirm={handleEdit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('400') },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  meta: { color: colors.neon, fontSize: 14, ...fontWeight('600'), letterSpacing: 1 },
  title: { color: colors.textPrimary, fontSize: 32, ...fontWeight('900'), marginTop: spacing.xs, textAlign: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  dateEmoji: { fontSize: 14 },
  date: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400') },
  metricCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginBottom: spacing.md,
  },
  metricEmoji: { fontSize: 28, marginBottom: spacing.sm },
  metricValue: { color: colors.textPrimary, fontSize: 28, ...fontWeight('900') },
  metricLabel: { color: colors.textSecondary, fontSize: 12, ...fontWeight('500'), letterSpacing: 1, marginTop: spacing.xs },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md, textAlign: 'center' },
  actions: { marginTop: spacing.lg },
  actionGap: { height: spacing.md },
  statusLine: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('400'), marginBottom: spacing.xs },
  editRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.lg },
  editAction: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: spacing.sm },
  editActionText: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('600') },
  removeActionText: { color: colors.error, fontSize: fontSizes.body, ...fontWeight('600') },
});
