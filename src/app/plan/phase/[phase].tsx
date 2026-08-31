import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Mountain, Dumbbell, Zap, Flag } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { useActivePlan } from '@/hooks/useActivePlan';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { useCurrentWeek } from '@/hooks/useCurrentWeek';
import { buildWeekMeta } from '@/services/plan/plan-cycle.service';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Workout } from '@/domain/entities';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PHASE_ICONS: Record<string, React.ComponentType<any>> = {
  base: Mountain,
  resistência: Dumbbell,
  resistencia: Dumbbell,
  pico: Zap,
  polimento: Flag,
};
const PHASE_SUBTITLE: Record<string, string> = {
  base: 'Fundação aeróbica',
  resistência: 'Volume e constância',
  pico: 'Semanas mais fortes',
  polimento: 'Redução até a prova',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: 'rgba(204,255,0,0.12)', color: colors.neon, label: 'Concluído' },
  skipped: { bg: 'rgba(255,68,68,0.1)', color: colors.error, label: 'Pulado' },
  pending: { bg: 'rgba(255,255,255,0.06)', color: colors.textSecondary, label: 'Pendente' },
};

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

  const PhaseIcon = PHASE_ICONS[(phase ?? '').toLowerCase()] ?? Mountain;
  const subtitle = PHASE_SUBTITLE[(phase ?? '').toLowerCase()] ?? '';
  const phaseWorkouts = workouts.filter((w) => weeksMeta.some((wm) => wm.weekNumber === w.week_number));
  const totalKm = Math.round(phaseWorkouts.reduce((s, w) => s + Number(w.planned_km ?? 0), 0) * 10) / 10;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <AppHeader />

          <View style={styles.headerCard}>
            <View style={styles.phaseIconCircle}>
              <PhaseIcon size={32} color={colors.neon} strokeWidth={2} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{phase}</Text>
              {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
              <Text style={styles.headerSummary}>
                {weeksMeta.length} {weeksMeta.length === 1 ? 'semana' : 'semanas'} · {phaseWorkouts.length} treinos · {totalKm} km
              </Text>
            </View>
          </View>

          {weeksMeta.length === 0 ? (
            <Text style={styles.empty}>Nenhum treino nesta fase.</Text>
          ) : (
            weeksMeta.map((week) => {
              const weekWorkouts = workouts
                .filter((w) => w.week_number === week.weekNumber)
                .sort((a, b) => a.week_index - b.week_index);
              const completedCount = weekWorkouts.filter((w) => w.status === 'completed').length;
              const skippedCount = weekWorkouts.filter((w) => w.status === 'skipped').length;

              let badge: { bg: string; color: string; label: string };
              if (completedCount === weekWorkouts.length && weekWorkouts.length > 0) {
                badge = { bg: 'rgba(204,255,0,0.12)', color: colors.neon, label: 'Concluída' };
              } else if (completedCount > 0 || skippedCount > 0) {
                badge = { bg: 'rgba(255,193,7,0.12)', color: '#FFC107', label: 'Em andamento' };
              } else {
                badge = { bg: 'rgba(255,255,255,0.06)', color: colors.textSecondary, label: 'Pendente' };
              }

              return (
                <View key={week.weekNumber} style={styles.weekCard}>
                  <View style={styles.weekHeader}>
                    <Text style={styles.weekTitle}>Semana {week.weekNumber}</Text>
                    <View style={[styles.weekBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.weekBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>

                  {weekWorkouts.map((workout: Workout, idx) => {
                    const status = STATUS_STYLE[workout.status ?? 'pending'] ?? STATUS_STYLE.pending;
                    const isLast = idx === weekWorkouts.length - 1;
                    return (
                      <Pressable
                        key={workout.id}
                        style={[styles.workoutRow, isLast && styles.workoutRowLast]}
                        onPress={() => router.push(`/workout/${workout.id}` as never)}
                        accessibilityRole="button"
                      >
                        <View style={styles.workoutInfo}>
                          <Text style={styles.workoutTitle} numberOfLines={1}>{workout.title ?? 'Treino'}</Text>
                          <Text style={styles.workoutSubtitle} numberOfLines={1}>
                            {workout.day_label ?? '-'} · {workout.day_type ?? workout.phase}
                          </Text>
                        </View>
                        <Text style={styles.workoutKm}>{workout.planned_km ?? 0} km</Text>
                        <View style={[styles.workoutStatusBadge, { backgroundColor: status?.bg }]}>
                          <Text style={[styles.workoutStatusText, { color: status?.color }]}>{status?.label}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })
          )}
        </ScrollView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.15)',
    padding: spacing.xl,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(204,255,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  headerInfo: { flex: 1 },
  headerTitle: { color: colors.textPrimary, fontSize: 22, ...fontWeight('800') },
  headerSubtitle: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginTop: 2 },
  headerSummary: { color: colors.neon, fontSize: 13, ...fontWeight('600'), marginTop: spacing.xs },
  weekCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekTitle: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700') },
  weekBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm },
  weekBadgeText: { fontSize: 11, ...fontWeight('600') },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  workoutRowLast: { borderBottomWidth: 0 },
  workoutInfo: { flex: 1, marginRight: spacing.md },
  workoutTitle: { color: colors.textPrimary, fontSize: 14, ...fontWeight('600') },
  workoutSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  workoutKm: { color: colors.neon, fontSize: 14, ...fontWeight('700'), marginRight: spacing.md },
  workoutStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  workoutStatusText: { fontSize: 11, ...fontWeight('600') },
  empty: { color: colors.textMuted, fontSize: fontSizes.body, textAlign: 'center', marginTop: spacing.xxl },
});
