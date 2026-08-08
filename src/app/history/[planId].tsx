import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { StatBox, StatBoxRow } from '@/components/ui/StatBox';
import { useCycleDetail } from '@/hooks/useCycleDetail';
import { formatCycleDate, formatGoalPace, formatKm, formatPercent, formatRaceCompleted } from '@/services/history/cycle-format';
import type { Zone } from '@/domain/motor-evo/types';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * docs/fase-7-5-brief.md Grupo 2 — resumo read-only de um ciclo arquivado.
 * Free: qualquer atleta pode abrir o detalhe do próprio ciclo (só a
 * comparação/evolução entre ciclos é Plus). Reaproveita o layout de cards de
 * `plan/preview.tsx` (Qualidade técnica, Zonas de treino) para a mesma
 * linguagem visual — nada aqui recalcula: tudo vem de `CycleSummary`.
 */
export default function CycleDetail(): JSX.Element {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { data, isLoading } = useCycleDetail(planId);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Carregando ciclo...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Ciclo não encontrado.</Text>
      </View>
    );
  }

  const { plan, summary } = data;
  const trainingZones = summary.paceZones?.trainingZones ?? null;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{summary.raceName ?? plan.plan_name}</Text>
      <Text style={styles.subtitle}>
        {formatCycleDate(summary.raceDate)} · {formatKm(summary.raceDistanceKm)} · {summary.totalWeeks ?? '-'} semanas ·{' '}
        {summary.daysPerWeek ?? '-'}x/semana
      </Text>

      <StatBoxRow>
        <StatBox value={formatRaceCompleted(summary)} label="Prova" emphasis={summary.raceCompleted === true} />
        <StatBox value={formatPercent(summary.adherence.completionRate)} label="Aderência" />
      </StatBoxRow>

      <Card title="Volume do ciclo">
        <InfoRow label="Volume de pico" value={formatKm(summary.peakWeeklyKm)} />
        <InfoRow label="Maior longão" value={formatKm(summary.longestRunKm)} />
      </Card>

      <Card title="Qualidade técnica">
        <InfoRow label="Quality Score" value={summary.qualityScore !== null ? `${summary.qualityScore}/10 (${summary.qualityStatus ?? '-'})` : '-'} />
        <InfoRow label="Risco técnico" value={summary.riskLevel ?? '-'} />
        {summary.riskReasons.length > 0 ? (
          <View style={styles.riskReasons}>
            {summary.riskReasons.map((reason, i) => (
              <Text key={i} style={styles.riskReason}>
                • {reason}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <Card title="Pace-alvo e zonas">
        <InfoRow label="Pace-alvo" value={formatGoalPace(summary)} />
        {trainingZones ? (
          (['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const).map((key) => {
            const zone: Zone = trainingZones[key];
            return (
              <View key={key} style={styles.zoneRow}>
                <Text style={styles.zoneLabel}>{zone.label}</Text>
                <Text style={styles.zoneRange}>
                  {zone.name} · {zone.from} a {zone.to}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.muted}>Zonas de treino não salvas neste ciclo.</Text>
        )}
      </Card>

      <Card title="Aderência real">
        <InfoRow label="Treinos concluídos" value={`${summary.adherence.completedWorkouts}/${summary.adherence.totalWorkouts}`} />
        <InfoRow label="Km realizado" value={`${formatKm(summary.adherence.completedKm)} / ${formatKm(summary.adherence.plannedKm)}`} />
        <InfoRow label="Taxa de km" value={formatPercent(summary.adherence.kmRate)} />
      </Card>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { color: colors.textSecondary, fontSize: fontSizes.body },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxxl, backgroundColor: colors.bg },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800') },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.lg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.md },
  infoLabel: { color: colors.textSecondary, fontSize: fontSizes.body, flexShrink: 0 },
  infoValue: { color: colors.textPrimary, fontSize: fontSizes.body, flexShrink: 1, textAlign: 'right' },
  riskReasons: { marginTop: spacing.sm },
  riskReason: { color: colors.textSecondary, fontSize: fontSizes.caption, marginBottom: spacing.xs },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zoneLabel: { color: colors.neon, ...fontWeight('800'), fontSize: fontSizes.body },
  zoneRange: { color: colors.textSecondary, fontSize: fontSizes.caption, flexShrink: 1, textAlign: 'right' },
});
