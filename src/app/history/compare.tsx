import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { LockedSection } from '@/components/paywall/LockedSection';
import { useCycleHistory } from '@/hooks/useCycleHistory';
import { useEntitlement } from '@/hooks/useEntitlement';
import { compareCycles } from '@/services/history/cycle-compare';
import {
  formatCycleDate,
  formatGoalPace,
  formatKm,
  formatPaceDelta,
  formatPercent,
  formatPointsDelta,
  formatRaceCompleted,
  formatSignedNumber,
  formatSignedPercent,
} from '@/services/history/cycle-format';
import type { CycleSummary } from '@/services/history/cycle-summary';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * docs/fase-7-5-brief.md Grupo 3 — comparação entre dois ciclos arquivados
 * (Plus). Deltas calculados por `compareCycles` (Grupo 3, puro/testado); esta
 * tela só escolhe os dois ciclos e formata para exibição. Free vê o mesmo
 * conteúdo real, dimmed, atrás de um único CTA (`LockedSection`, padrão §34).
 */
export default function CompareCycles(): JSX.Element {
  const { cycles, isLoading } = useCycleHistory();
  const { isPlus } = useEntitlement();
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  useEffect(() => {
    if (cycles.length >= 2 && !aId && !bId) {
      // Mais recente (cycles[0]) como comparação, o anterior como base — a
      // leitura natural é "evoluí do ciclo anterior para o mais recente".
      setAId(cycles[1]?.planId ?? null);
      setBId(cycles[0]?.planId ?? null);
    }
  }, [cycles, aId, bId]);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>Carregando ciclos...</Text>
      </View>
    );
  }

  if (cycles.length < 2) {
    return (
      <View style={styles.screen}>
        <View style={styles.insufficientCard}>
          <Text style={styles.insufficientTitle}>Ainda não dá para comparar</Text>
          <Text style={styles.insufficientMessage}>
            Você precisa de pelo menos 2 ciclos concluídos para comparar. Complete mais um ciclo para desbloquear esta
            visão.
          </Text>
        </View>
      </View>
    );
  }

  const a = cycles.find((c) => c.planId === aId) ?? cycles[1] ?? cycles[0];
  const b = cycles.find((c) => c.planId === bId) ?? cycles[0];
  const comparison = a && b ? compareCycles(a, b) : null;

  const content = a && b && comparison ? (
    <>
      <View style={styles.raceContext}>
        <Text style={styles.raceContextText}>
          {a.raceName ?? 'Ciclo A'} ({formatKm(a.raceDistanceKm)}) vs {b.raceName ?? 'Ciclo B'} ({formatKm(b.raceDistanceKm)})
        </Text>
        {!comparison.sameRaceDistance ? (
          <Text style={styles.raceContextNote}>Distâncias diferentes — compare com esse contexto em mente.</Text>
        ) : null}
      </View>

      <Card title="Volume">
        <MetricRow label="Volume de pico" aValue={formatKm(a.peakWeeklyKm)} bValue={formatKm(b.peakWeeklyKm)} delta={formatSignedPercent(comparison.peakWeeklyKm.percent)} />
        <MetricRow label="Maior longão" aValue={formatKm(a.longestRunKm)} bValue={formatKm(b.longestRunKm)} delta={formatSignedPercent(comparison.longestRunKm.percent)} />
      </Card>

      <Card title="Ritmo e qualidade">
        <MetricRow label="Pace-alvo" aValue={formatGoalPace(a)} bValue={formatGoalPace(b)} delta={formatPaceDelta(comparison.goalPaceSeconds.absolute)} />
        <MetricRow
          label="Quality Score"
          aValue={a.qualityScore !== null ? `${a.qualityScore}/10` : '-'}
          bValue={b.qualityScore !== null ? `${b.qualityScore}/10` : '-'}
          delta={formatSignedNumber(comparison.qualityScore.absolute, 1)}
        />
      </Card>

      <Card title="Consistência">
        <MetricRow
          label="Aderência"
          aValue={formatPercent(a.adherence.completionRate)}
          bValue={formatPercent(b.adherence.completionRate)}
          delta={formatPointsDelta(comparison.completionRate.absolute)}
        />
        <MetricRow label="Dias/semana" aValue={`${a.daysPerWeek ?? '-'}`} bValue={`${b.daysPerWeek ?? '-'}`} delta={formatSignedNumber(comparison.daysPerWeek.absolute)} />
        <MetricRow label="Semanas" aValue={`${a.totalWeeks ?? '-'}`} bValue={`${b.totalWeeks ?? '-'}`} delta={formatSignedNumber(comparison.totalWeeks.absolute)} />
        <MetricRow label="Prova" aValue={formatRaceCompleted(a)} bValue={formatRaceCompleted(b)} delta={null} />
      </Card>
    </>
  ) : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.pickers}>
          <CyclePicker label="Ciclo A" cycles={cycles} selectedId={aId} onSelect={setAId} />
          <CyclePicker label="Ciclo B" cycles={cycles} selectedId={bId} onSelect={setBId} />
        </View>

        {aId && bId && aId === bId ? (
          <Text style={styles.sameCycleWarning}>Escolha dois ciclos diferentes para comparar.</Text>
        ) : isPlus ? (
          content
        ) : (
          <LockedSection
            title="Compare dois ciclos e veja sua evolução"
            ctaLabel="Assinar RunEvo+"
            onPressCta={() => router.push({ pathname: '/runevo-plus', params: { reason: 'history' } })}
          >
            {content}
          </LockedSection>
        )}
      </ScrollView>
    </View>
  );
}

function CyclePicker({
  label,
  cycles,
  selectedId,
  onSelect,
}: {
  label: string;
  cycles: CycleSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <View style={styles.pickerGroup}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {cycles.map((cycle) => {
          const selected = cycle.planId === selectedId;
          return (
            <Pressable
              key={cycle.planId}
              onPress={() => onSelect(cycle.planId)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                {cycle.raceName ?? 'Ciclo'} · {formatCycleDate(cycle.raceDate)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MetricRow({ label, aValue, bValue, delta }: { label: string; aValue: string; bValue: string; delta: string | null }): JSX.Element {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValues}>
        <Text style={styles.metricValue}>{aValue}</Text>
        <Text style={styles.metricArrow}>→</Text>
        <Text style={styles.metricValue}>{bValue}</Text>
        {delta ? <Text style={styles.metricDelta}>{delta}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  muted: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xl, textAlign: 'center' },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  insufficientCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  insufficientTitle: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800') },
  insufficientMessage: { color: colors.textSecondary, fontSize: fontSizes.body },
  pickers: { gap: spacing.md, marginBottom: spacing.lg },
  pickerGroup: { gap: spacing.sm },
  pickerLabel: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('700'), letterSpacing: 0.5, textTransform: 'uppercase' },
  chipRow: { gap: spacing.sm },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    maxWidth: 220,
  },
  chipSelected: { borderColor: colors.neon, backgroundColor: colors.cardElevated },
  chipText: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('600') },
  chipTextSelected: { color: colors.neon },
  sameCycleWarning: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center', marginTop: spacing.xl },
  raceContext: { marginBottom: spacing.lg, gap: spacing.xs },
  raceContextText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
  raceContextNote: { color: colors.textMuted, fontSize: fontSizes.caption },
  metricRow: { marginBottom: spacing.md },
  metricLabel: { color: colors.textSecondary, fontSize: fontSizes.caption, marginBottom: spacing.xs },
  metricValues: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metricValue: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
  metricArrow: { color: colors.textMuted, fontSize: fontSizes.body },
  metricDelta: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('800'), marginLeft: 'auto' },
});
