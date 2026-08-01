import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { StatBox, StatBoxRow } from '@/components/ui/StatBox';
import { colors, radii, spacing, fontSizes, fontWeight, MIN_TOUCH_TARGET } from '@/theme';
import type { WeekSummary } from '@/domain/motor-evo/adaptive-training';
import type { CheckinAvailabilityStatus } from '@/hooks/useCheckinAvailability';

const CHECKIN_LABEL: Record<CheckinAvailabilityStatus, string> = {
  waiting: 'Aguardando treinos',
  available: 'Liberado para check-in',
  done: 'Check-in enviado',
};

const CHECKIN_GUIDANCE: Record<CheckinAvailabilityStatus, string> = {
  waiting: 'Complete os treinos da semana para liberar o check-in.',
  available: 'Semana resolvida — analise a semana e ajuste o plano.',
  done: 'Você já enviou o check-in desta semana.',
};

/**
 * docs/fase-5-brief.md Grupo 3 (§21) — CTA fica ativo quando `canCheckin`
 * (débito da Fase 4, docs/fase-4-brief.md Grupo 2.2, resolvido aqui).
 */
export function AdaptiveTrainingCard({
  weekNumber,
  summary,
  checkinStatus,
}: {
  weekNumber: number;
  summary: WeekSummary;
  checkinStatus: CheckinAvailabilityStatus;
}): JSX.Element {
  const isAvailable = checkinStatus === 'available';

  return (
    <Card title="Adaptive Training">
      <Text style={styles.week}>Semana S{weekNumber}</Text>
      <Text style={styles.status}>{CHECKIN_LABEL[checkinStatus]}</Text>

      <View style={styles.statsWrap}>
        <StatBoxRow>
          <StatBox value={`${summary.resolved}/${summary.total}`} label="Treinos" emphasis />
          <StatBox value={`${summary.completedKm}/${summary.plannedKm}`} label="Km" emphasis />
          <StatBox value={summary.averageEffort ? `${summary.averageEffort}` : '-'} label="Esforço" emphasis />
        </StatBoxRow>
      </View>

      <Text style={styles.guidance}>{CHECKIN_GUIDANCE[checkinStatus]}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !isAvailable }}
        disabled={!isAvailable}
        onPress={() => router.push(`/plan/checkin/${weekNumber}`)}
        style={[styles.cta, !isAvailable && styles.ctaDisabled]}
      >
        <Text style={[styles.ctaText, isAvailable && styles.ctaTextActive]}>
          {isAvailable ? 'Fazer check-in' : checkinStatus === 'done' ? 'Check-in enviado' : 'Disponível em breve'}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  week: { color: colors.textSecondary, fontSize: fontSizes.caption, textTransform: 'uppercase' },
  status: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('700'), marginTop: spacing.xs },
  statsWrap: { marginTop: spacing.md },
  guidance: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.md },
  cta: {
    marginTop: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.neon,
    backgroundColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: 'transparent', borderColor: colors.border, opacity: 0.5 },
  ctaText: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('700') },
  ctaTextActive: { color: colors.bg },
});
