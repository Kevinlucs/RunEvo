import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { StatBox, StatBoxRow } from '@/components/ui/StatBox';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { PlanProgress } from '@/services/plan/plan-progress.service';
import type { TrainingPlan } from '@/domain/entities';

/**
 * docs/fase-4-brief.md Grupo 2.2 (§27, bloco 4): bandeira · nome da prova ·
 * distância · dias restantes · km feitos · km total · barra de progresso —
 * nessa ordem (km antes da barra, como o mockup de design-reference/ também
 * mostra). Distância/dias em destaque (StatBox) para dar a mesma ênfase
 * visual do mockup; nome da prova mantido como cabeçalho — o mockup não o
 * exibe, mas o §27 exige o campo, então spec vence.
 */
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

      <StatBoxRow>
        <StatBox value={plan.race_distance_km ? `${plan.race_distance_km} km` : '-'} label="Distância" />
        <StatBox
          value={days !== null ? (days >= 0 ? `${days}` : '0') : '-'}
          label={days !== null && days < 0 ? 'Prova concluída' : 'Dias restantes'}
          emphasis
        />
      </StatBoxRow>

      <Text style={styles.progressLabel}>
        {progress.completedKm} km feitos / {progress.plannedKm} km no total
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  raceName: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('700'), flexShrink: 1 },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.neon, borderRadius: radii.pill },
});
