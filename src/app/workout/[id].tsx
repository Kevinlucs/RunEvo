import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { NeonButton } from '@/components/ui/NeonButton';
import { StatBox, StatBoxRow } from '@/components/ui/StatBox';
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
 * docs/fase-4-brief.md Grupo 4 (§28) — detalhe do treino. Concluir/Pular só
 * ficam disponíveis para treinos `pending`; o treino da prova (§ motor:
 * título fixo "Prova alvo") é completável como qualquer outro, mas não tem
 * edição/remoção nesta fase (nenhum treino tem — Editor manual é Fase 5).
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
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCompleteVisible(false);
    router.back();
  };

  const handleSkip = async (reason: string | null): Promise<void> => {
    setSubmitting(true);
    setError(null);
    const result = await skipWorkout({ workoutId: workout.id, reason });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
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
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
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
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: workout.title ?? 'Treino' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {workout.phase ?? 'Base'} · Semana {workout.week_number}
            </Text>
            {isRace ? (
              <View style={styles.raceBadge}>
                <Text style={styles.raceBadgeText}>Prova</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title}>{workout.title ?? 'Treino'}</Text>
          <Text style={styles.date}>{formatShortDate(workout.workout_date)}</Text>
        </View>

        <View style={styles.statsWrap}>
          <StatBoxRow>
            <StatBox value={`${workout.planned_km ?? 0} km`} label="Distância" />
            <StatBox value={workout.planned_pace ?? '-'} label="Pace planejado" />
          </StatBoxRow>
        </View>

        <TrainingZonesCard zones={zones} />
        <WorkoutDescriptionCard lines={descriptionLines} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isPending ? (
          <>
            <View style={styles.actions}>
              <View style={styles.actionButton}>
                <NeonButton label="Pular" variant="secondary" onPress={() => setSkipVisible(true)} />
              </View>
              <View style={styles.actionButton}>
                <NeonButton label="Concluir" onPress={() => setCompleteVisible(true)} />
              </View>
            </View>

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
          </>
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
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { color: colors.textMuted, fontSize: fontSizes.body },
  header: { marginBottom: spacing.lg },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { color: colors.textSecondary, fontSize: fontSizes.caption, textTransform: 'uppercase' },
  raceBadge: { backgroundColor: colors.glow, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  raceBadgeText: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('700') },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), marginTop: spacing.xs },
  date: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs },
  statsWrap: { marginBottom: spacing.lg },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { flex: 1 },
  statusLine: { color: colors.textPrimary, fontSize: fontSizes.body, marginBottom: spacing.xs },
  editRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.lg },
  editAction: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: spacing.sm },
  editActionText: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('600') },
  removeActionText: { color: colors.error, fontSize: fontSizes.body, ...fontWeight('600') },
});
