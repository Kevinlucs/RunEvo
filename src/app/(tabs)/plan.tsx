import { useMemo, useCallback, useState } from 'react';
import { View, Text, SectionList, Pressable, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LockedSection } from '@/components/paywall/LockedSection';
import { PhaseSummaryPills } from '@/components/plan/PhaseSummaryPills';
import { WeekSectionHeader } from '@/components/plan/WeekSectionHeader';
import { WorkoutListRow } from '@/components/plan/WorkoutListRow';
import { AddWorkoutModal, type AddWorkoutFormInput } from '@/components/plan/AddWorkoutModal';
import { useActivePlan } from '@/hooks/useActivePlan';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { useCurrentWeek } from '@/hooks/useCurrentWeek';
import { usePlanProgress } from '@/hooks/usePlanProgress';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useAuthStore } from '@/store/auth.store';
import { buildWeekMeta, groupWeeksByPhase, type WeekMeta } from '@/services/plan/plan-cycle.service';
import { isWeekAccessible, shouldShowTrialEndingNotice } from '@/services/plan/plan-trial.service';
import { isRaceWorkout } from '@/services/workout/workout-detail.service';
import { addWorkout, removeWorkout, moveWorkout } from '@/services/plan/edit-workout.service';
import { exportPlanAsPdf, exportPlanAsExcel } from '@/services/plan/export-plan';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
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
  const userId = useAuthStore((s) => s.userId);
  const { profile } = useAthleteProfile(userId);
  const { isPlus } = useEntitlement();

  const [editMode, setEditMode] = useState(false);
  const [addModalWeek, setAddModalWeek] = useState<WeekMeta | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const weeksMeta = useMemo(
    () => (plan ? buildWeekMeta(plan, workouts, currentWeekNumber) : []),
    [plan, workouts, currentWeekNumber],
  );
  const phaseGroups = useMemo(() => groupWeeksByPhase(weeksMeta), [weeksMeta]);

  // docs/fase-8-brief.md Grupo 3 — trial de 8 semanas. Gate decidido no
  // serviço (isWeekAccessible); a tela só separa em visível/bloqueado.
  // `currentWeekNumber` só é null antes do plano carregar (sem start_date
  // ainda) — 1 é um fallback seguro nesse instante transitório.
  const totalWeeks = plan?.total_weeks ?? weeksMeta.length;
  const safeCurrentWeekNumber = currentWeekNumber ?? 1;
  const accessibleWeeks = useMemo(
    () =>
      weeksMeta.filter((week) =>
        isWeekAccessible({ weekNumber: week.weekNumber, currentWeekNumber: safeCurrentWeekNumber, totalWeeks, isPlus }),
      ),
    [weeksMeta, safeCurrentWeekNumber, totalWeeks, isPlus],
  );
  const lockedWeeks = useMemo(
    () =>
      weeksMeta.filter(
        (week) => !isWeekAccessible({ weekNumber: week.weekNumber, currentWeekNumber: safeCurrentWeekNumber, totalWeeks, isPlus }),
      ),
    [weeksMeta, safeCurrentWeekNumber, totalWeeks, isPlus],
  );
  const showTrialNotice = shouldShowTrialEndingNotice({ currentWeekNumber: safeCurrentWeekNumber, totalWeeks, isPlus });

  const sections = useMemo<WeekSection[]>(
    () =>
      accessibleWeeks.map((week) => ({
        title: week,
        data: workouts
          .filter((w) => w.week_number === week.weekNumber)
          .sort((a, b) => a.week_index - b.week_index),
      })),
    [accessibleWeeks, workouts],
  );

  const handleRemoveWorkout = useCallback((workout: Workout) => {
    Alert.alert('Remover treino', `"${workout.title ?? 'Treino'}" será removido do plano.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void removeWorkout(workout.id) },
    ]);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Workout }) => {
      const canEdit = editMode && item.status === 'pending' && !isRaceWorkout(item);
      return (
        <WorkoutListRow
          workout={item}
          onPress={editMode ? undefined : () => router.push(`/workout/${item.id}` as never)}
          edit={
            editMode
              ? {
                  canEdit,
                  onMoveUp: () => void moveWorkout(item.id, 'up'),
                  onMoveDown: () => void moveWorkout(item.id, 'down'),
                  onRemove: () => handleRemoveWorkout(item),
                }
              : undefined
          }
        />
      );
    },
    [editMode, handleRemoveWorkout],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: WeekSection }) => <WeekSectionHeader week={section.title} />,
    [],
  );
  const renderSectionFooter = useCallback(
    ({ section }: { section: WeekSection }) =>
      editMode ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAddModalWeek(section.title)}
          style={styles.addWorkoutRow}
        >
          <Text style={styles.addWorkoutText}>+ Adicionar treino</Text>
        </Pressable>
      ) : null,
    [editMode],
  );
  const keyExtractor = useCallback((item: Workout) => item.id, []);

  const handleAddWorkout = async (input: AddWorkoutFormInput): Promise<void> => {
    if (!plan || !userId || !addModalWeek) return;
    setAddSubmitting(true);
    const result = await addWorkout({
      planId: plan.id,
      userId,
      weekNumber: addModalWeek.weekNumber,
      phase: addModalWeek.phase,
      title: input.title,
      description: input.description,
      dayType: input.dayType,
      dayLabel: input.dayLabel,
      workoutDate: input.workoutDate,
      plannedKm: input.plannedKm,
      plannedPace: input.plannedPace,
    });
    setAddSubmitting(false);
    if (result.ok) {
      setAddModalWeek(null);
    } else {
      Alert.alert('Não foi possível adicionar', result.error.message);
    }
  };

  const handleExport = useCallback(
    async (format: 'pdf' | 'excel'): Promise<void> => {
      if (!plan || exporting) return;
      setExporting(true);
      try {
        const input = { plan, workouts, athlete: profile, advanced: isPlus };
        const result = format === 'pdf' ? await exportPlanAsPdf(input) : await exportPlanAsExcel(input);
        if (!result.ok) {
          Alert.alert('Não foi possível exportar', result.error.message);
        }
      } finally {
        setExporting(false);
      }
    },
    [plan, workouts, profile, isPlus, exporting],
  );

  const handleExportPress = useCallback(() => {
    if (!plan || exporting) return;
    Alert.alert('Exportar planilha', 'Escolha o formato', [
      { text: 'PDF', onPress: () => void handleExport('pdf') },
      {
        text: isPlus ? 'Excel' : 'Excel (RunEvo+)',
        onPress: () => {
          if (isPlus) {
            void handleExport('excel');
          } else {
            router.push({ pathname: '/runevo-plus', params: { reason: 'history' } });
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [plan, exporting, isPlus, handleExport]);

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
        renderSectionFooter={renderSectionFooter}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          lockedWeeks.length > 0 ? (
            <View style={styles.header}>
              <LockedSection
                title={`Semanas ${lockedWeeks[0]!.weekNumber} a ${lockedWeeks[lockedWeeks.length - 1]!.weekNumber} — continue com RunEvo+`}
                ctaLabel="Desbloquear com RunEvo+"
                onPressCta={() => router.push({ pathname: '/runevo-plus', params: { reason: 'trial-ended' } })}
              >
                {lockedWeeks.map((week) => (
                  <View key={week.weekNumber} style={styles.lockedWeekRow}>
                    <Text style={styles.lockedWeekLabel}>{week.label}</Text>
                  </View>
                ))}
              </LockedSection>
            </View>
          ) : null
        }
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
            {showTrialNotice ? (
              <Text style={styles.trialNotice}>
                Faltam poucas semanas do seu acesso completo — assine o RunEvo+ para seguir vendo o plano inteiro
                rumo à sua prova.
              </Text>
            ) : null}
            <PhaseSummaryPills groups={phaseGroups} />
            <View style={styles.disabledSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: editMode }}
                onPress={() => setEditMode((v) => !v)}
                style={[styles.editableRow, editMode && styles.editableRowActive]}
              >
                <Text style={[styles.editableLabel, editMode && styles.editableLabelActive]}>Editor manual</Text>
                <Text style={[styles.editableNote, editMode && styles.editableLabelActive]}>
                  {editMode ? 'Ativo — toque para sair' : 'Editar, adicionar, remover'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: exporting }}
                disabled={exporting}
                onPress={handleExportPress}
                style={styles.editableRow}
              >
                <Text style={styles.editableLabel}>Exportar (PDF/Excel)</Text>
                <Text style={styles.editableNote}>{exporting ? 'Gerando…' : isPlus ? 'Versão avançada' : 'Planilha ativa'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/history')}
                style={styles.editableRow}
              >
                <Text style={styles.editableLabel}>Histórico completo</Text>
                <Text style={styles.editableNote}>Ver ciclos anteriores</Text>
              </Pressable>
            </View>
          </View>
        }
      />

      {addModalWeek ? (
        <AddWorkoutModal
          visible
          weekNumber={addModalWeek.weekNumber}
          submitting={addSubmitting}
          onCancel={() => setAddModalWeek(null)}
          onConfirm={handleAddWorkout}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  listContent: { paddingBottom: spacing.xxxl },
  header: { paddingHorizontal: spacing.xl },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), marginTop: spacing.sm },
  progress: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.lg },
  trialNotice: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    ...fontWeight('600'),
    marginBottom: spacing.md,
  },
  lockedWeekRow: { paddingVertical: spacing.xs },
  lockedWeekLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
  disabledSection: { marginTop: spacing.lg, marginBottom: spacing.sm, gap: spacing.sm },
  editableRow: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.neon,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editableRowActive: { backgroundColor: colors.neon },
  editableLabel: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('600') },
  editableLabelActive: { color: colors.bg },
  editableNote: { color: colors.textSecondary, fontSize: fontSizes.caption },
  addWorkoutRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addWorkoutText: { color: colors.neon, fontSize: fontSizes.body, ...fontWeight('700') },
});
