import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { colors, radii, spacing, fontSizes } from '@/theme';
import type { PlanProgress } from '@/services/plan/plan-progress.service';
import type { TrainingPlan } from '@/domain/entities';

/** docs/fase-4-brief.md Grupo 2.2 (§27, bloco 4). */
export function RaceObjectiveCard({ plan, progress }: { plan: TrainingPlan; progress: PlanProgress }): JSX.Element {
  const ratio = progress.plannedKm > 0 ? Math.min(1, progress.completedKm / progress.plannedKm) : 0;
  const days = progress.daysRemaining;

  return (
    <Card title="Objetivo da prova">
      <View style={styles.header}>
        <Ionicons name="flag-outline" size={18} color={colors.neon} />
        <Text style={styles.raceName} numberOfLines={1}>
          {plan.race_name ?? plan.plan_name}
        </Text>
      </View>
      <Text style={styles.detail}>
        {plan.race_distance_km ? `${plan.race_distance_km} km` : ''}
        {days !== null ? (days >= 0 ? ` · ${days} dias restantes` : ' · prova concluída') : ''}
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {progress.completedKm} km / {progress.plannedKm} km
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  raceName: { color: colors.textPrimary, fontSize: fontSizes.lg, fontWeight: '700', flexShrink: 1 },
  detail: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.md },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.neon, borderRadius: radii.pill },
  progressLabel: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: spacing.xs },
});
