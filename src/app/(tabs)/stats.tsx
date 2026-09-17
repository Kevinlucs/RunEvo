import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/stats/StatCard';
import { BarChart } from '@/components/stats/BarChart';
import { PeriodSummary } from '@/components/stats/PeriodSummary';
import { PerformanceCenter } from '@/components/stats/PerformanceCenter';
import { CycleEvolutionCard } from '@/components/stats/CycleEvolutionCard';
import { PremiumGate } from '@/components/premium';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useAthleteStats } from '@/hooks/useAthleteStats';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useCycleHistory } from '@/hooks/useCycleHistory';
import { classifyImc } from '@/services/stats/stats.service';
import { colors, radii, spacing, fontSizes, fontWeight, MIN_TOUCH_TARGET } from '@/theme';

type ChartMetric = 'volume' | 'planReal' | 'adherence';

const CHART_METRICS: { value: ChartMetric; label: string }[] = [
  { value: 'volume', label: 'Volume' },
  { value: 'planReal', label: 'Plano × real' },
  { value: 'adherence', label: 'Aderência' },
];

/**
 * docs/fase-6-brief.md Grupo 2 (§31, mockup 13). §31 pede "sem vão preto
 * abaixo do header" — por isso o header vive dentro do ScrollView, igual à
 * Home (docs/fase-4-brief.md §27), nunca numa área fixa separada do conteúdo.
 */
export default function Stats(): JSX.Element {
  const { plan, isLoading: planLoading } = useActivePlan();
  const { stats, isLoading: statsLoading } = useAthleteStats();
  const { isPlus } = useEntitlement();
  const { cycles } = useCycleHistory();

  const [chartMetric, setChartMetric] = useState<ChartMetric>('volume');

  const chartData = useMemo(() => {
    const ws = stats?.weeklyStats ?? [];
    switch (chartMetric) {
      case 'volume':
        return ws.map((w) => ({ label: w.label, value: w.completedKm }));
      case 'planReal':
        return ws.map((w) => ({
          label: w.label,
          value: w.completedKm,
          secondaryValue: w.plannedKm,
        }));
      case 'adherence':
        return ws.map((w) => ({ label: w.label, value: Math.round(w.completionRate * 100) }));
    }
  }, [stats?.weeklyStats, chartMetric]);

  const chartConfig = useMemo(() => {
    switch (chartMetric) {
      case 'volume':
        return { unit: 'km' as const, primaryLabel: undefined, secondaryLabel: undefined };
      case 'planReal':
        return { unit: 'km' as const, primaryLabel: 'Realizado', secondaryLabel: 'Planejado' };
      case 'adherence':
        return { unit: '%' as const, primaryLabel: undefined, secondaryLabel: undefined };
    }
  }, [chartMetric]);

  const plannedWorkouts = useMemo(
    () => stats?.weeklyStats.reduce((total, week) => total + week.total, 0) ?? 0,
    [stats?.weeklyStats],
  );

  if (!planLoading && !plan) {
    return (
      <Screen>
        <AppHeader />
        <EmptyState
          title="Nada para mostrar ainda"
          message="Suas estatísticas aparecem aqui assim que você tiver uma planilha ativa."
          ctaLabel="Criar minha planilha"
          onPressCta={() => router.push('/(tabs)/ai-evo')}
        />
      </Screen>
    );
  }

  if (statsLoading || !stats) {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader />
          <Text style={styles.h1}>Estatísticas</Text>
        </ScrollView>
      </Screen>
    );
  }

  const imcLabel = classifyImc(stats.imc);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AppHeader />
        <Text style={styles.h1}>Estatísticas</Text>

        <Text style={styles.dashboardTitle}>Dashboard de evolução</Text>
        <PerformanceCenter
          completedWorkouts={stats.completedWorkouts}
          plannedWorkouts={plannedWorkouts}
        />

        <PeriodSummary weeklyStats={stats.weeklyStats} />

        <View style={styles.statsRow}>
          <StatCard value={`${stats.completedWorkouts}`} label="Concluídos" />
          <StatCard value={`${stats.remainingWorkouts}`} label="Restantes" />
          <StatCard value={`${stats.weeksStreak}`} label="Semanas seguidas" />
        </View>

        <View style={styles.imcCard}>
          <View>
            <Text style={styles.imcEyebrow}>IMC atual</Text>
            <Text style={styles.imcDescription}>Índice de massa corporal</Text>
          </View>
          <View style={styles.imcValueWrap}>
            <Text style={styles.imcValue}>{stats.imc ? stats.imc.toFixed(1) : '-'}</Text>
            <Text style={styles.imcLabel}>{imcLabel}</Text>
          </View>
        </View>

        <Card title="Desempenho semanal">
          <View accessibilityRole="tablist" style={styles.chartSegmentedControl}>
            {CHART_METRICS.map((opt) => {
              const selected = opt.value === chartMetric;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setChartMetric(opt.value)}
                  style={[styles.chartSegment, selected && styles.chartSegmentSelected]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.chartSegmentLabel, selected && styles.chartSegmentLabelSelected]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <BarChart
            data={chartData}
            unit={chartConfig.unit}
            primaryLabel={chartConfig.primaryLabel}
            secondaryLabel={chartConfig.secondaryLabel}
          />
        </Card>

        <PremiumGate
          locked={!isPlus}
          title="Evolução entre ciclos no RunEvo+"
          description="Compare suas preparações e acompanhe o que evoluiu a cada novo ciclo."
          cta="Conhecer o RunEvo+"
          onUnlock={() =>
            router.push({ pathname: '/runevo-plus', params: { reason: 'cycles-evolution' } })
          }
        >
          <CycleEvolutionCard
            cycleCount={cycles.length}
            onCompare={() => router.push('/history/compare')}
            onViewEvolution={() => router.push('/history/evolution')}
          />
        </PremiumGate>

        <Text style={styles.sectionLabel}>Histórico de ciclos</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/history')}
          style={({ pressed }) => [
            styles.historyShortcut,
            pressed && styles.historyShortcutPressed,
          ]}
        >
          <View>
            <Text style={styles.historyShortcutTitle}>Ver ciclos concluídos</Text>
            <Text style={styles.historyShortcutDescription}>
              {cycles.length === 0
                ? 'Sua primeira preparação aparecerá aqui.'
                : `${cycles.length} ${cycles.length === 1 ? 'ciclo salvo' : 'ciclos salvos'}.`}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xxxl },
  h1: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    ...fontWeight('800'),
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  imcCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imcEyebrow: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    ...fontWeight('800'),
  },
  imcDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    marginTop: 2,
  },
  imcValueWrap: { alignItems: 'flex-end' },
  imcValue: {
    color: colors.neon,
    fontSize: fontSizes.xl,
    ...fontWeight('800'),
  },
  imcLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    ...fontWeight('600'),
    marginTop: 2,
  },
  chartSegmentedControl: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: spacing.lg,
  },
  chartSegment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartSegmentSelected: { backgroundColor: colors.neon },
  chartSegmentLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    ...fontWeight('600'),
  },
  chartSegmentLabelSelected: { color: colors.bg, ...fontWeight('800') },
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    ...fontWeight('800'),
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  historyShortcut: {
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  historyShortcutPressed: { opacity: 0.72 },
  historyShortcutTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    ...fontWeight('700'),
  },
  historyShortcutDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    marginTop: 2,
  },
});
