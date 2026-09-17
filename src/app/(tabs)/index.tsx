import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { NextWorkoutCard } from '@/components/home/NextWorkoutCard';
import { RaceObjectiveCard } from '@/components/home/RaceObjectiveCard';
import { CurrentWeekCard } from '@/components/home/CurrentWeekCard';
import { AdaptiveTrainingCard } from '@/components/home/AdaptiveTrainingCard';
import { CheckinModal } from '@/components/home/CheckinModal';
import { PostWorkoutCheckinModal } from '@/components/home/PostWorkoutCheckinModal';
import { SyncedWorkoutCheckinCard } from '@/components/home/SyncedWorkoutCheckinCard';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useNextWorkout } from '@/hooks/useNextWorkout';
import { usePlanProgress } from '@/hooks/usePlanProgress';
import { useCurrentWeek } from '@/hooks/useCurrentWeek';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { useAdaptiveTrainingSummary } from '@/hooks/useAdaptiveTrainingSummary';
import { usePendingPostWorkoutCheckin } from '@/hooks/usePendingPostWorkoutCheckin';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * Home (docs/fase-4-brief.md Grupo 2.2, §27) — ordem exata dos blocos:
 * header · cápsula "próximo treino" · card do próximo treino · objetivo da
 * prova · semana atual · Adaptive Training (só leitura). Estado vazio
 * (sem plano ativo) fica compacto, com CTA único — nunca uma área preta grande.
 */
export default function Home(): JSX.Element {
  const { plan, isLoading: planLoading } = useActivePlan();
  const { workout: nextWorkout } = useNextWorkout();
  const { progress } = usePlanProgress();
  const { weekNumber: currentWeekNumber } = useCurrentWeek();
  const { workouts } = usePlanWorkouts(plan?.id);
  const adaptive = useAdaptiveTrainingSummary();
  const [checkinVisible, setCheckinVisible] = useState(false);
  const [postWorkoutCheckinVisible, setPostWorkoutCheckinVisible] = useState(false);
  const pendingPostWorkoutCheckin = usePendingPostWorkoutCheckin();
  const autoPresentedCheckin = useRef<string | null>(null);

  useEffect(() => {
    const pending = pendingPostWorkoutCheckin.workout;
    if (
      !pending ||
      pendingPostWorkoutCheckin.isLoading ||
      autoPresentedCheckin.current === pending.id
    )
      return;
    autoPresentedCheckin.current = pending.id;
    setPostWorkoutCheckinVisible(true);
  }, [pendingPostWorkoutCheckin.isLoading, pendingPostWorkoutCheckin.workout]);

  if (!planLoading && !plan) {
    return (
      <Screen>
        <AppHeader />
        <EmptyState
          title="Crie sua primeira planilha"
          message="Preencha seus dados na aba IA Evo e gere seu plano personalizado."
          ctaLabel="Ir para IA Evo"
          onPressCta={() => router.push('/(tabs)/ai-evo')}
        />
      </Screen>
    );
  }

  // Guard: plano existe mas sem workouts reais — trata como estado vazio
  // (pode acontecer com dados residuais de sync sem treinos populados).
  if (!planLoading && plan && workouts.length === 0 && !nextWorkout) {
    return (
      <Screen>
        <AppHeader />
        <EmptyState
          title="Crie sua primeira planilha"
          message="Preencha seus dados na aba IA Evo e gere seu plano personalizado."
          ctaLabel="Ir para IA Evo"
          onPressCta={() => router.push('/(tabs)/ai-evo')}
        />
      </Screen>
    );
  }

  const currentWeekWorkouts = workouts.filter((w) => w.week_number === currentWeekNumber);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <AppHeader />

        {pendingPostWorkoutCheckin.workout ? (
          <SyncedWorkoutCheckinCard
            workout={pendingPostWorkoutCheckin.workout}
            pendingCount={pendingPostWorkoutCheckin.pendingCount}
            onPress={() => setPostWorkoutCheckinVisible(true)}
          />
        ) : null}

        {nextWorkout && (
          <>
            <View style={styles.capsule}>
              <Text style={styles.capsuleText}>PRÓXIMO TREINO</Text>
            </View>
            <NextWorkoutCard
              workout={nextWorkout}
              // Rota criada no Grupo 4 (docs/fase-4-brief.md) — typed routes do
              // expo-router ainda não a conhece neste ponto da sequência.
              onPress={() => router.push(`/workout/${nextWorkout.id}` as never)}
            />
          </>
        )}

        {plan && progress && <RaceObjectiveCard plan={plan} progress={progress} />}

        {currentWeekNumber !== null && (
          <CurrentWeekCard weekNumber={currentWeekNumber} workouts={currentWeekWorkouts} />
        )}

        {adaptive.weekNumber !== null && adaptive.summary && adaptive.checkinStatus && (
          <AdaptiveTrainingCard
            weekNumber={adaptive.weekNumber}
            summary={adaptive.summary}
            checkinStatus={adaptive.checkinStatus}
            onCheckin={() => setCheckinVisible(true)}
          />
        )}
      </ScrollView>

      {adaptive.weekNumber !== null ? (
        <CheckinModal
          visible={checkinVisible}
          weekNumber={adaptive.weekNumber}
          onClose={() => setCheckinVisible(false)}
        />
      ) : null}
      <PostWorkoutCheckinModal
        visible={postWorkoutCheckinVisible}
        workout={pendingPostWorkoutCheckin.workout}
        onClose={() => setPostWorkoutCheckinVisible(false)}
        onCompleted={() => setPostWorkoutCheckinVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xxxl },
  capsule: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(204, 255, 0, 0.05)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.neon,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginTop: 0,
  },
  capsuleText: {
    color: colors.neon,
    fontSize: fontSizes.base,
    ...fontWeight('800'),
    letterSpacing: 1,
  },
});
