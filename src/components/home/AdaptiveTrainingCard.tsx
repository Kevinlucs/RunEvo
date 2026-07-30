import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { StatBox, StatBoxRow } from '@/components/ui/StatBox';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { WeekSummary, WeekStatus } from '@/domain/motor-evo/adaptive-training';

const STATUS_LABEL: Record<WeekStatus, string> = {
  pending: 'Aguardando treinos',
  in_progress: 'Em andamento',
  done: 'Liberado para check-in',
};

const GUIDANCE: Record<WeekStatus, string> = {
  pending: 'Complete os treinos da semana para liberar o check-in.',
  in_progress: 'Continue completando os treinos desta semana.',
  done: 'Semana resolvida — o check-in ainda não está disponível nesta fase.',
};

/**
 * docs/fase-4-brief.md Grupo 2.2 (§27, bloco 6) — só leitura nesta fase. O
 * check-in de verdade é da Fase 5: o CTA fica sempre desabilitado com rótulo
 * honesto, nunca escondido nem fingindo abrir algo.
 */
export function AdaptiveTrainingCard({
  weekNumber,
  summary,
}: {
  weekNumber: number;
  summary: WeekSummary;
}): JSX.Element {
  return (
    <Card title="Adaptive Training">
      <Text style={styles.week}>Semana S{weekNumber}</Text>
      <Text style={styles.status}>{STATUS_LABEL[summary.status]}</Text>

      <View style={styles.statsWrap}>
        <StatBoxRow>
          <StatBox value={`${summary.resolved}/${summary.total}`} label="Treinos" emphasis />
          <StatBox value={`${summary.completedKm}/${summary.plannedKm}`} label="Km" emphasis />
          <StatBox value={summary.averageEffort ? `${summary.averageEffort}` : '-'} label="Esforço" emphasis />
        </StatBoxRow>
      </View>

      <Text style={styles.guidance}>{GUIDANCE[summary.status]}</Text>

      <View style={styles.ctaDisabled} accessibilityRole="button" accessibilityState={{ disabled: true }}>
        <Text style={styles.ctaText}>Disponível em breve</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  week: { color: colors.textSecondary, fontSize: fontSizes.caption, textTransform: 'uppercase' },
  status: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('700'), marginTop: spacing.xs },
  statsWrap: { marginTop: spacing.md },
  guidance: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.md },
  ctaDisabled: {
    marginTop: spacing.lg,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  ctaText: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('700') },
});
