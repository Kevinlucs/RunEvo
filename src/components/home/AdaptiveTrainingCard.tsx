import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, radii, spacing, fontSizes, fontWeight, MIN_TOUCH_TARGET } from '@/theme';
import type { WeekSummary } from '@/domain/motor-evo/adaptive-training';
import type { CheckinAvailabilityStatus } from '@/hooks/useCheckinAvailability';

const CHECKIN_BADGE: Record<CheckinAvailabilityStatus, { label: string; color: string }> = {
  waiting: { label: 'Aguardando', color: colors.textMuted },
  available: { label: 'Liberado', color: colors.neon },
  done: { label: 'Enviado', color: colors.success },
};

/**
 * docs/fase-5-brief.md Grupo 3 (§21) — card com gradiente verde sutil,
 * "ADAPTIVE TRAINING" uppercase, badge de status, stats em 3 colunas.
 * Layout alinhado ao mockup TELA HOME 2.
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
  const badge = CHECKIN_BADGE[checkinStatus];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(204,255,0,0.06)', colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>ADAPTIVE TRAINING</Text>
          <View style={[styles.badge, { borderColor: badge.color }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.title}>Check-in da S{weekNumber}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Treinos</Text>
            <Text style={styles.statValue}>{summary.resolved}/{summary.total}</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Km realizado</Text>
            <Text style={styles.statValue}>{summary.completedKm}/{summary.plannedKm} km</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Esforço médio</Text>
            <Text style={styles.statValue}>{summary.averageEffort ?? '-'}/10</Text>
          </View>
        </View>

        <Text style={styles.guidance}>
          Registre todos os treinos da semana como concluído ou pulado para liberar o check-in.
        </Text>

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
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.xl },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerLabel: { color: colors.neon, fontSize: fontSizes.body, ...fontWeight('800'), letterSpacing: 1.5, textTransform: 'uppercase' },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: fontSizes.caption, ...fontWeight('700') },
  title: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700'), marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', marginBottom: spacing.md },
  statCol: { flex: 1 },
  statLabel: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('500'), marginBottom: spacing.xs },
  statValue: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('900') },
  guidance: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('400'), marginBottom: spacing.lg, lineHeight: 20 },
  cta: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    backgroundColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, opacity: 0.5 },
  ctaText: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('700') },
  ctaTextActive: { color: colors.bg },
});
