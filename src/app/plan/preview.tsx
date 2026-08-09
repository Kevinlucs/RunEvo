import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { NeonButton } from '@/components/ui/NeonButton';
import { usePlanGenerationStore } from '@/store/plan-generation.store';
import { useAuthStore } from '@/store/auth.store';
import { useEntitlement } from '@/hooks/useEntitlement';
import { adoptPlan } from '@/services/plan/adopt-plan.service';
import { isIdenticalToActivePlan } from '@/services/plan/plan-identity.service';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Zone } from '@/domain/motor-evo/types';
import { VIABILITY_LEVEL_LABELS, type ViabilityLevel } from '@/services/viability/goal-viability';

/**
 * Prévia da planilha (docs/fase-3-brief.md §4.2/§4.3). Se a planilha nova é
 * idêntica à ativa (checado em `generating.tsx`, revalidado aqui antes de
 * adotar), mostra só a mensagem fixa do legado — não cria cópia, não abre
 * revisão genérica.
 */
export default function PlanPreview(): JSX.Element {
  const plan = usePlanGenerationStore((s) => s.generatedPlan);
  const viability = usePlanGenerationStore((s) => s.viability);
  const viabilityExplanation = usePlanGenerationStore((s) => s.viabilityExplanation);
  const identicalToActive = usePlanGenerationStore((s) => s.identicalToActive);
  const clear = usePlanGenerationStore((s) => s.clear);
  const userId = useAuthStore((s) => s.userId);
  const { isPlus } = useEntitlement();
  const [adopting, setAdopting] = useState(false);
  const [adoptError, setAdoptError] = useState<string | null>(null);

  if (!plan) {
    router.replace('/(tabs)/ai-evo');
    return <Screen />;
  }

  const onGenerateAnother = (): void => {
    clear();
    router.replace('/(tabs)/ai-evo');
  };

  const onAdopt = async (): Promise<void> => {
    if (!userId) return;
    setAdoptError(null);
    setAdopting(true);
    try {
      // Revalida plano idêntico bem antes de adotar (§4.3) — o plano ativo
      // pode ter mudado entre a geração e o clique em "Adotar".
      const stillIdentical = await isIdenticalToActivePlan(userId, plan);
      if (stillIdentical) {
        setAdopting(false);
        return;
      }
      const result = await adoptPlan(plan, userId, isPlus);
      if (!result.ok) {
        if (result.error.code === 'entitlement') {
          setAdopting(false);
          router.push({ pathname: '/runevo-plus', params: { reason: 'new-plan' } });
          return;
        }
        setAdoptError(result.error.message);
        setAdopting(false);
        return;
      }
      clear();
      router.replace('/(tabs)');
    } catch (e) {
      setAdoptError(e instanceof Error ? e.message : 'Não foi possível adotar a planilha.');
      setAdopting(false);
    }
  };

  if (identicalToActive) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.identicalTitle}>A nova planilha é idêntica à atual.</Text>
          <Text style={styles.identicalHint}>
            Não faz sentido substituir ou adotar uma cópia. Altere objetivo, prazo, frequência, terreno ou métricas
            para gerar uma versão realmente diferente.
          </Text>
          <NeonButton label="Ajustar dados e gerar outra" onPress={onGenerateAnother} />
        </View>
      </Screen>
    );
  }

  const { blueprint, validation } = plan;
  const trainingZones = blueprint.paceZones.trainingZones;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{plan.planName}</Text>
        <Text style={styles.subtitle}>
          {plan.raceName} · {plan.totalWeeks} semanas · {plan.daysPerWeek}x/semana
        </Text>

        {viability && viabilityExplanation ? (
          <View style={[styles.viabilityCard, { borderColor: viabilityColor(viability.level) }]}>
            <Text style={[styles.viabilityLabel, { color: viabilityColor(viability.level) }]}>
              {VIABILITY_LEVEL_LABELS[viability.level]}
            </Text>
            <Text style={styles.viabilityText}>{viabilityExplanation}</Text>
            {viability.level === 'fora_de_alcance' && viability.anchoredTarget ? (
              <Text style={styles.viabilityAnchor}>
                Alvo intermediário deste plano: ~{viability.anchoredTarget.projectedTimeLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Card title="Análise do atleta">
          <InfoRow label="Nível detectado" value={blueprint.athleteAnalysis.detectedLevel} />
          <InfoRow label="Viabilidade" value={blueprint.athleteAnalysis.goalFeasibility} />
          <InfoRow label="Ponto forte" value={blueprint.athleteAnalysis.mainStrength} />
          <InfoRow label="Ponto de atenção" value={blueprint.athleteAnalysis.mainWeakness} />
          <InfoRow label="Foco" value={blueprint.athleteAnalysis.focus} />
          <Text style={styles.paragraph}>{blueprint.athleteAnalysis.coachSummary}</Text>
        </Card>

        <Card title="Estratégia">
          <InfoRow label="Volume inicial" value={`${blueprint.strategy.initialWeeklyKm} km/semana`} />
          <InfoRow label="Volume no pico" value={`${blueprint.strategy.peakWeeklyKm} km/semana`} />
          <InfoRow label="Longão inicial" value={`${blueprint.strategy.initialLongRunKm} km`} />
          <InfoRow label="Longão no pico" value={`${blueprint.strategy.peakLongRunKm} km`} />
          <InfoRow label="Recuperação" value={`a cada ${blueprint.strategy.recoveryEveryWeeks} semanas`} />
          <InfoRow label="Polimento (taper)" value={`${blueprint.strategy.taperWeeks} semanas`} />
        </Card>

        {trainingZones ? (
          <Card title={`Zonas de treino (Z1-Z5) — ${trainingZones.anchor.method === 'goal_anchored' ? 'ancorado no objetivo' : 'ancorado no teste de 3km'}`}>
            {(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const).map((key) => {
              const zone: Zone = trainingZones[key];
              return (
                <View key={key} style={styles.zoneRow}>
                  <Text style={styles.zoneLabel}>{zone.label}</Text>
                  <Text style={styles.zoneRange}>
                    {zone.name} · {zone.from} a {zone.to}
                  </Text>
                </View>
              );
            })}
          </Card>
        ) : null}

        <Card title="Fases">
          {blueprint.phaseDistribution.map((phase) => (
            <InfoRow key={`${phase.phase}-${phase.startWeek}`} label={phase.phase} value={`Semanas ${phase.startWeek}-${phase.endWeek}`} />
          ))}
        </Card>

        {blueprint.warnings.length > 0 ? (
          <Card title="Alertas">
            {blueprint.warnings.map((w, i) => (
              <Text key={i} style={styles.warning}>
                • {w}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card title="Qualidade técnica">
          <InfoRow label="Quality Score" value={`${validation?.summary.qualityScore ?? '-'}/10 (${validation?.summary.qualityStatus ?? '-'})`} />
          <InfoRow label="Risco técnico" value={validation?.summary.riskLevel ?? '-'} />
          {(validation?.summary.riskReasons ?? []).length > 0 ? (
            <View style={styles.riskReasons}>
              {(validation?.summary.riskReasons ?? []).map((reason, i) => (
                <Text key={i} style={styles.riskReason}>
                  • {reason}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={styles.disclaimer}>Indicador técnico de planejamento — não é diagnóstico médico.</Text>
        </Card>

        <Card title={`Plano semana a semana (${plan.weeks.length} semanas)`}>
          {plan.weeks.map((week) => (
            <View key={week.week} style={styles.weekBlock}>
              <Text style={styles.weekTitle}>
                {week.week} — {week.phase}
                {week.off ? ' (recuperação)' : ''}
              </Text>
              {week.workouts.map((workout, i) => (
                <Text key={i} style={styles.workoutLine}>
                  {workout.dayOfWeek}: {workout.title} — {workout.km}km @ {workout.pace}
                </Text>
              ))}
            </View>
          ))}
        </Card>

        {adoptError ? <Text style={styles.error}>{adoptError}</Text> : null}

        <NeonButton label="Adotar planilha" onPress={() => void onAdopt()} loading={adopting} />
        <View style={styles.row}>
          <NeonButton label="Gerar outra" variant="secondary" onPress={onGenerateAnother} disabled={adopting} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Cores suaves, nunca alarmantes (docs/fase-8-brief.md Grupo 2) — nada de vermelho/erro aqui. */
function viabilityColor(level: ViabilityLevel): string {
  if (level === 'realista') return colors.success;
  if (level === 'ambicioso') return colors.neon;
  return colors.textSecondary;
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  identicalTitle: { color: colors.neon, fontSize: fontSizes.lg, ...fontWeight('800'), textAlign: 'center' },
  identicalHint: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center' },
  scrollContent: { paddingBottom: spacing.xxxl },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), marginTop: spacing.xl },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, marginBottom: spacing.xl },
  paragraph: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm, lineHeight: 20 },
  viabilityCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  viabilityLabel: { fontSize: fontSizes.lg, ...fontWeight('800') },
  viabilityText: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 21 },
  viabilityAnchor: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('700') },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.md },
  infoLabel: { color: colors.textSecondary, fontSize: fontSizes.body, flexShrink: 0 },
  infoValue: { color: colors.textPrimary, fontSize: fontSizes.body, flexShrink: 1, textAlign: 'right' },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zoneLabel: { color: colors.neon, ...fontWeight('800'), fontSize: fontSizes.body },
  zoneRange: { color: colors.textSecondary, fontSize: fontSizes.caption, flexShrink: 1, textAlign: 'right' },
  warning: { color: colors.textSecondary, fontSize: fontSizes.body, marginBottom: spacing.xs },
  riskReasons: { marginTop: spacing.sm },
  riskReason: { color: colors.textSecondary, fontSize: fontSizes.caption, marginBottom: spacing.xs },
  disclaimer: { color: colors.textMuted, fontSize: fontSizes.caption, marginTop: spacing.md, fontStyle: 'italic' },
  weekBlock: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekTitle: { color: colors.textPrimary, ...fontWeight('700'), fontSize: fontSizes.body, marginBottom: spacing.xs },
  workoutLine: { color: colors.textSecondary, fontSize: fontSizes.caption, marginBottom: 2 },
  error: { color: colors.error, fontSize: fontSizes.body, textAlign: 'center', marginBottom: spacing.md },
  row: { marginTop: spacing.md },
});
