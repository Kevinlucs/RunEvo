import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors, radii, spacing, fontSizes, fontWeight, MIN_TOUCH_TARGET } from '@/theme';
import type { WeeklyStatPoint } from '@/services/stats/stats.service';

type Period = 'week' | 'month' | 'year' | 'all';

interface Props {
  /** weeklyStats (já agregado por semana). Para período "tudo" usamos o total. */
  weeklyStats: readonly WeeklyStatPoint[];
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
  { value: 'all', label: 'Tudo' },
];

const PERIOD_TITLES: Record<Period, string> = {
  week: 'Nesta semana',
  month: 'Neste mês',
  year: 'Neste ano',
  all: 'Todo o período',
};

/**
 * TODO refino no service: `weeklyStats` hoje é agregado por `week_number`, sem
 * datas reais, então "Mês/Ano" são aproximações pelo nº de semanas do plano.
 * Quando o workout ganhar `date` real, trocar para agregação por calendário.
 */
function aggregateKmForPeriod(weekly: readonly WeeklyStatPoint[], period: Period): number {
  switch (period) {
    case 'week':
      return weekly[0]?.completedKm ?? 0;
    case 'month':
      // Aprox: 4 primeiras semanas.
      return weekly.slice(0, 4).reduce((sum, w) => sum + w.completedKm, 0);
    case 'year':
      // Aprox: 12 primeiras semanas (≈ um trimestre).
      return weekly.slice(0, 12).reduce((sum, w) => sum + w.completedKm, 0);
    case 'all':
      return weekly.reduce((sum, w) => sum + w.completedKm, 0);
  }
}

function aggregateWorkoutsForPeriod(weekly: readonly WeeklyStatPoint[], period: Period): number {
  switch (period) {
    case 'all':
      return weekly.reduce((sum, w) => sum + w.resolved, 0);
    case 'week':
      return weekly[0]?.resolved ?? 0;
    default: {
      // Aprox: nº de semanas cobertas (month=4, year=12).
      const weeks = period === 'month' ? 4 : 12;
      return weekly.slice(0, weeks).reduce((sum, w) => sum + w.resolved, 0);
    }
  }
}

function formatKm(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

export function PeriodSummary({ weeklyStats }: Props): JSX.Element {
  const [period, setPeriod] = useState<Period>('week');
  const periodKm = useMemo(() => aggregateKmForPeriod(weeklyStats, period), [weeklyStats, period]);
  const periodWorkouts = useMemo(
    () => aggregateWorkoutsForPeriod(weeklyStats, period),
    [weeklyStats, period],
  );

  return (
    <Card>
      <Text style={styles.title}>Resumo do período</Text>

      <View accessibilityRole="tablist" style={styles.segmentedControl}>
        {PERIODS.map((opt) => {
          const selected = opt.value === period;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setPeriod(opt.value)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.periodTitle}>{PERIOD_TITLES[period]}</Text>
      <View style={styles.kmBlock}>
        <Text style={styles.kmValue}>{formatKm(periodKm)} km</Text>
        <Text style={styles.kmLabel}>quilômetros corridos</Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCell}>
          <Text style={styles.metricValue}>{periodWorkouts}</Text>
          <Text style={styles.metricLabel}>Corridas</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricValue}>—</Text>
          <Text style={styles.metricLabel}>Pace médio</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricValue}>—</Text>
          <Text style={styles.metricLabel}>Duração</Text>
        </View>
      </View>

      <Text style={styles.integrationHint}>
        Pace e duração serão preenchidos quando a integração com Strava estiver disponível.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.neon,
    fontSize: fontSizes.lg,
    ...fontWeight('800'),
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: spacing.xl,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.neon },
  segmentLabel: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('600') },
  segmentLabelSelected: { color: colors.bg, ...fontWeight('800') },
  periodTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    ...fontWeight('700'),
    textAlign: 'center',
  },
  kmBlock: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  kmValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    ...fontWeight('800'),
    lineHeight: fontSizes.display + 8,
  },
  kmLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    ...fontWeight('400'),
    marginTop: spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    ...fontWeight('800'),
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    ...fontWeight('400'),
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  integrationHint: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    ...fontWeight('400'),
    lineHeight: fontSizes.caption * 1.4,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
