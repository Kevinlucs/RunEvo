import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { NeonButton } from '@/components/ui/NeonButton';
import { AlertModal } from '@/components/ui/AlertModal';
import { TrainingZonesCard } from '@/components/workout/TrainingZonesCard';
import { WorkoutDescriptionCard } from '@/components/workout/WorkoutDescriptionCard';
import { CompleteWorkoutModal, type CompleteWorkoutFormInput } from '@/components/workout/CompleteWorkoutModal';
import { SkipWorkoutModal } from '@/components/workout/SkipWorkoutModal';
import { useWorkout } from '@/hooks/useWorkout';
import { usePlan } from '@/hooks/usePlan';
import { useShoes } from '@/hooks/useShoes';
import { useAuthStore } from '@/store/auth.store';
import { readTrainingZones, splitWorkoutDescription } from '@/services/workout/workout-detail.service';
import { completeWorkout, skipWorkout } from '@/services/workout/complete-workout.service';
import { formatShortDate } from '@/utils/time';
import { sendWorkoutToGarmin, getGarminStatus } from '@/services/integrations/connected-accounts.service';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

export default function WorkoutDetail(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.userId);
  const { workout, isLoading: workoutLoading } = useWorkout(id);
  const { plan } = usePlan(workout?.plan_id);
  const { shoes } = useShoes(userId);

  const [completeVisible, setCompleteVisible] = useState(false);
  const [skipVisible, setSkipVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
    primaryActionLabel: 'OK',
    primaryAction: () => {},
    secondaryActionLabel: undefined as string | undefined,
    secondaryAction: undefined as (() => void) | undefined,
  });
  const [garminSyncing, setGarminSyncing] = useState(false);
  const [garminConnected, setGarminConnected] = useState<boolean | null>(null);
  const [garminDevices, setGarminDevices] = useState<any[]>([]);

  const checkGarminStatus = async () => {
    const result = await getGarminStatus();
    if (result.ok) {
      setGarminConnected(result.value.connected);
      setGarminDevices(result.value.devices || []);
    } else {
      setGarminConnected(false);
      setGarminDevices([]);
    }
  };

  const handleSendToGarmin = async () => {
    if (!workout) return;
    
    const statusResult = await getGarminStatus();
    let isConnected = false;
    if (statusResult.ok) {
      isConnected = statusResult.value.connected;
      setGarminConnected(isConnected);
      setGarminDevices(statusResult.value.devices || []);
    } else {
      setGarminConnected(false);
      setGarminDevices([]);
    }
    if (!isConnected) {
      setAlertConfig({
        visible: true,
        title: 'Relógio Desconectado',
        message: 'Para enviar os treinos, você precisa conectar sua conta de Relógio primeiro.',
        type: 'info',
        primaryActionLabel: 'Conectar',
        primaryAction: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          router.push('/profile/watches/garmin');
        },
        secondaryActionLabel: 'Agora não',
        secondaryAction: () => setAlertConfig(prev => ({ ...prev, visible: false }))
      });
      return;
    }

    setGarminSyncing(true);
    setError(null);

    const scheduledDate = (workout.workout_date ?? new Date().toISOString()).split('T')[0];

    if (!workout.id) {
      setGarminSyncing(false);
      setAlertConfig({
        visible: true,
        title: "Erro",
        message: "ID do treino inválido.",
        type: "error",
        primaryActionLabel: "OK",
        primaryAction: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        secondaryActionLabel: undefined,
        secondaryAction: undefined,
      });
      return;
    }
    const result = await sendWorkoutToGarmin(workout.id, scheduledDate);
    setGarminSyncing(false);

    if (result.ok && result.value.success) {
      setAlertConfig({
        visible: true,
        title: 'Sincronizado!',
        message: 'Treino enviado para o relógio com sucesso.',
        type: 'success',
        primaryActionLabel: 'OK',
        primaryAction: () => setAlertConfig(prev => ({ ...prev, visible: false })),
        secondaryActionLabel: undefined,
        secondaryAction: undefined
      });
    } else {
      setAlertConfig({
        visible: true,
        title: 'Erro na Sincronização',
        message: result.ok ? (result.value.error || 'Não foi possível enviar o treino para o relógio.') : result.error.message,
        type: 'error',
        primaryActionLabel: 'OK',
        primaryAction: () => setAlertConfig(prev => ({ ...prev, visible: false })),
        secondaryActionLabel: undefined,
        secondaryAction: undefined
      });
    }
  };

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

  const phase = workout.phase ?? 'Base';
  const phaseCap = phase.charAt(0).toUpperCase() + phase.slice(1).toLowerCase();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <AppHeader />

          <View style={styles.header}>
            <Text style={styles.meta}>{phaseCap} • S{workout.week_number}</Text>
            <Text style={styles.title}>{workout.title ?? 'Treino'}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.date}>{workout.day_label ?? '-'}, {formatShortDate(workout.workout_date)}</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{workout.planned_km ?? 0} km</Text>
            <Text style={styles.metricLabel}>DISTÂNCIA</Text>
          </View>

          {workout.planned_pace && /\d+:\d+/.test(workout.planned_pace) ? (
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{workout.planned_pace}</Text>
              <Text style={styles.metricLabel}>PACE PLANEJADO</Text>
            </View>
          ) : null}

          <TrainingZonesCard zones={zones} />
          <WorkoutDescriptionCard lines={descriptionLines} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {isPending ? (
            <View style={styles.actions}>
              <NeonButton 
                label={garminSyncing ? 'Sincronizando...' : 'Enviar para relógio'} 
                onPress={handleSendToGarmin}
                disabled={garminSyncing}
                variant="garmin"
                icon={<Ionicons name="watch-outline" size={20} color={colors.bg} style={{ marginRight: 4 }} />}
              />
              <View style={styles.actionGap} />
              <NeonButton label="Concluir treino" onPress={() => setCompleteVisible(true)} />
              <View style={styles.actionGap} />
              <NeonButton label="Pular treino" variant="secondary" onPress={() => setSkipVisible(true)} />
            </View>
          ) : (
            <View style={styles.statusCardWrap}>
              <Text style={styles.statusCardTitle}>
                {workout.status === 'completed' ? 'Concluído' : 'Pulado'}
              </Text>
              <View style={{ alignItems: 'center' }}>
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
                {workout.feedback ? <Text style={[styles.statusLine, { marginTop: spacing.sm }]}>{workout.feedback}</Text> : null}
              </View>
            </View>
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
      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        primaryActionLabel={alertConfig.primaryActionLabel}
        primaryAction={alertConfig.primaryAction}
        secondaryActionLabel={alertConfig.secondaryActionLabel}
        secondaryAction={alertConfig.secondaryAction}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('400') },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  meta: { color: colors.neon, fontSize: 14, ...fontWeight('600'), letterSpacing: 1, marginBottom: -spacing.md },
  title: { color: colors.textPrimary, fontSize: 28, ...fontWeight('900'), marginBottom: -spacing.md, textAlign: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4},
  dateEmoji: { fontSize: 14 },
  date: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400') },
  metricCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  metricEmoji: { fontSize: 28, marginBottom: spacing.sm },
  metricValue: { color: colors.textPrimary, fontSize: 25, ...fontWeight('800'), letterSpacing: 1, marginBottom: -spacing.md},
  metricLabel: { color: colors.textSecondary, fontSize: 12, ...fontWeight('500'), letterSpacing: 1, marginTop: spacing.xs },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md, textAlign: 'center' },
  actions: { marginTop: spacing.lg },
  actionGap: { height: spacing.md },
  statusCardWrap: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  statusCardTitle: {
    color: colors.neon,
    fontSize: fontSizes.lg,
    ...fontWeight('800'),
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  statusLine: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('600'), marginBottom: spacing.xs, textAlign: 'center' },
});







