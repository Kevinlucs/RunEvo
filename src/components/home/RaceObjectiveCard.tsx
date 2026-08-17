import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { PlanProgress } from '@/services/plan/plan-progress.service';
import type { TrainingPlan } from '@/domain/entities';

/**
 * docs/fase-4-brief.md Grupo 2.2 (§27, bloco 4): bandeira · nome da prova ·
 * 3 colunas (dias restantes / km feitos / km total) com divisores verticais ·
 * barra de progresso neon. Layout alinhado ao mockup TELA HOME 1.
 */
export function RaceObjectiveCard({ plan, progress }: { plan: TrainingPlan; progress: PlanProgress }): JSX.Element {
  const ratio = progress.plannedKm > 0 ? Math.min(1, progress.completedKm / progress.plannedKm) : 0;
  const days = progress.daysRemaining;
  const raceName = plan.race_name ?? plan.plan_name;
  const distanceKm = plan.race_distance_km;
  // Evita redundância: "5 km (5 KM)". Se o nome já contém a distância, não repete.
  const nameContainsDistance = distanceKm && raceName.toLowerCase().includes(`${distanceKm}`);
  const headerLabel = nameContainsDistance
    ? raceName.toUpperCase()
    : distanceKm
      ? `${raceName} (${distanceKm} KM)`.toUpperCase()
      : raceName.toUpperCase();

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🏁</Text>
        <Text style={styles.raceName} numberOfLines={1}>{headerLabel}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{days !== null ? (days >= 0 ? `${days}` : '0') : '-'}</Text>
          <Text style={styles.statLabel}>DIAS</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{progress.completedKm}</Text>
          <Text style={styles.statLabel}>KM FEITOS</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{progress.plannedKm}</Text>
          <Text style={styles.statLabel}>KM TOTAL</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={styles.progressDot} />
        <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  headerIcon: { fontSize: 16 },
  raceName: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('700'), flexShrink: 1, letterSpacing: 0.5, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 28, ...fontWeight('900') },
  statLabel: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('500'), marginTop: spacing.xs, textTransform: 'uppercase' },
  divider: { width: 1, height: 40, backgroundColor: colors.border },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: { height: '100%', backgroundColor: colors.neon, borderRadius: radii.pill },
  progressDot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neon,
    zIndex: 1,
  },
});
