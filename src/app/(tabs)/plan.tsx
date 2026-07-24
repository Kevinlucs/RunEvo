import { useMemo, useCallback } from 'react';
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PhaseSummaryPills } from '@/components/plan/PhaseSummaryPills';
import { WeekSectionHeader } from '@/components/plan/WeekSectionHeader';
import { WorkoutListRow } from '@/components/plan/WorkoutListRow';
import { useActivePlan } from '@/hooks/useActivePlan';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { useCurrentWeek } from '@/hooks/useCurrentWeek';
import { usePlanProgress } from '@/hooks/usePlanProgress';
import { buildWeekMeta, groupWeeksByPhase, type WeekMeta } from '@/services/plan/plan-cycle.service';
import { colors, radii, spacing, fontSizes } from '@/theme';
import type { Workout } from '@/domain/entities';

interface WeekSection {
  title: WeekMeta;
  data: Workout[];
}

/**
 * Treinos / Ciclo (docs/fase-4-brief.md Grupo 3, §29) — só leitura nesta
 * fase. SectionList (não ScrollView+map): um plano pode ter ~300 treinos.
 */
export default function Plan(): JSX.Element {
  const { plan, isLoading } = useActivePlan();
  const { workouts } = usePlanWorkouts(plan?.id);
  const { weekNumber: currentWeekNumber } = useCurrentWeek();
  const { progress } = usePlanProgress();

  const weeksMeta = useMemo(
    () => (plan ? buildWeekMeta(plan, workouts, currentWeekNumber) : []),
    [plan, workouts, currentWeekNumber],
  );
  const phaseGroups = useMemo(() => groupWeeksByPhase(weeksMeta), [weeksMeta]);
  const sections = useMemo<WeekSection[]>(
    () =>
      weeksMeta.map((week) => ({
        title: week,
        data: workouts
          .filter((w) => w.week_number === week.weekNumber)
          .sort((a, b) => a.week_index - b.week_index),
      })),
    [weeksMeta, workouts],
  );

  const renderItem = useCallback(
    ({ item }: { item: Workout }) => (
      <WorkoutListRow workout={item} onPress={() => router.push(`/workout/${item.id}` as never)} />
    ),
    [],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: WeekSection }) => <WeekSectionHeader week={section.title} />,
    [],
  );
  const keyExtractor = useCallback((item: Workout) => item.id, []);

  if (!isLoading && !plan) {
    return (
      <Screen>
        <AppHeader />
        <EmptyState
          title="Nenhuma planilha ativa"
          message="Gere sua planilha com a IA Evo para ver seus treinos aqui."
          ctaLabel="Criar minha planilha"
          onPressCta={() => router.push('/(tabs)/ai-evo')}
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppHeader />
            <Text style={styles.title}>Treinos</Text>
            {progress && (
              <Text style={styles.progress}>
                {progress.completedWorkouts}/{progress.totalWorkouts} treinos · {progress.completedKm}/
                {progress.plannedKm} km
              </Text>
            )}
            <PhaseSummaryPills groups={phaseGroups} />
            <View style={styles.disabledSection}>
              <DisabledRow label="Editor manual" note="Disponível na Fase 5" />
              <DisabledRow label="Exportar (PDF/Excel)" note="Disponível na Fase 7" />
              <DisabledRow label="Histórico completo (RunEvo+)" note="Disponível na Fase 6" />
            </View>
          </View>
        }
      />
    </Screen>
  );
}

function DisabledRow({ label, note }: { label: string; note: string }): JSX.Element {
  return (
    <View style={styles.disabledRow} accessibilityRole="button" accessibilityState={{ disabled: true }}>
      <Text style={styles.disabledLabel}>{label}</Text>
      <Text style={styles.disabledNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  listContent: { paddingBottom: spacing.xxxl },
  header: { paddingHorizontal: spacing.xl },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, fontWeight: '800', marginTop: spacing.sm },
  progress: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.lg },
  disabledSection: { marginTop: spacing.lg, marginBottom: spacing.sm, gap: spacing.sm },
  disabledRow: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    opacity: 0.5,
  },
  disabledLabel: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '600' },
  disabledNote: { color: colors.textMuted, fontSize: fontSizes.caption },
});
