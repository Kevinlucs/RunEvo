import { useMemo, useCallback } from 'react';
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { WeekSectionHeader } from '@/components/plan/WeekSectionHeader';
import { WorkoutListRow } from '@/components/plan/WorkoutListRow';
import { useActivePlan } from '@/hooks/useActivePlan';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { useCurrentWeek } from '@/hooks/useCurrentWeek';
import { buildWeekMeta, type WeekMeta } from '@/services/plan/plan-cycle.service';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';
import type { Workout } from '@/domain/entities';

interface WeekSection {
  title: WeekMeta;
  data: Workout[];
}

/** Detalhe de fase (docs/fase-4-brief.md Grupo 3, §29) — semanas e treinos daquela fase. */
export default function PhaseDetail(): JSX.Element {
  const { phase } = useLocalSearchParams<{ phase: string }>();
  const { plan } = useActivePlan();
  const { workouts } = usePlanWorkouts(plan?.id);
  const { weekNumber: currentWeekNumber } = useCurrentWeek();

  const weeksMeta = useMemo(
    () => (plan ? buildWeekMeta(plan, workouts, currentWeekNumber).filter((w) => w.phase === phase) : []),
    [plan, workouts, currentWeekNumber, phase],
  );
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

  return (
    <>
      <Stack.Screen options={{ title: phase ?? 'Fase' }} />
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{phase}</Text>
            <Text style={styles.subtitle}>
              {weeksMeta.length} {weeksMeta.length === 1 ? 'semana' : 'semanas'}
            </Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma semana encontrada para esta fase.</Text>}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xxxl, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800') },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.md },
  empty: { color: colors.textMuted, fontSize: fontSizes.body, paddingHorizontal: spacing.xl, marginTop: spacing.xl },
});
