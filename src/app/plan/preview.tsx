import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CircleHelp } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { NeonButton } from '@/components/ui/NeonButton';
import { usePlanGenerationStore } from '@/store/plan-generation.store';
import { useAuthStore } from '@/store/auth.store';
import { useEntitlement } from '@/hooks/useEntitlement';
import { adoptPlan } from '@/services/plan/adopt-plan.service';
import { isIdenticalToActivePlan } from '@/services/plan/plan-identity.service';
import { QualityGauge } from '@/components/plan/QualityGauge';
import { QualityInfoModal } from '@/components/plan/QualityInfoModal';
import { PremiumGate } from '@/components/premium';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Zone } from '@/domain/motor-evo/types';
import { VIABILITY_LEVEL_LABELS, type ViabilityLevel } from '@/services/viability/goal-viability';

const FREE_WEEKS = 8;
const TEASER_WEEKS = 2;

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
  const [expanded, setExpanded] = useState(false);
  const [qualityInfoVisible, setQualityInfoVisible] = useState(false);

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

      // Trial feedback — mostra toast antes de navegar.
      const { trialWeeks } = result.value;
      clear();
      if (trialWeeks) {
        Alert.alert(
          'Planilha adotada!',
          `Você tem ${trialWeeks} semanas de acesso completo. Aproveite seu treinamento!`,
          [{ text: 'Bora!', onPress: () => router.replace('/(tabs)') }],
        );
      } else {
        router.replace('/(tabs)');
      }
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
  const totalKm = plan.weeks.reduce((sum, w) => sum + w.workouts.reduce((s, wo) => s + wo.km, 0), 0);

  // Quebra visual do título: "Plano Maratona (42.2 km) - intermediário"
  // → linha 1: "Plano Maratona", linha 2: "(42.2 km)", linha 3: "INTERMEDIÁRIO"
  const { titleTop, titleParen, titleLevel } = (() => {
    const parts = plan.planName.split(' - ');
    const main = parts[0] ?? plan.planName;
    const level = (parts[1] ?? '').toUpperCase();
    const m = main.match(/^(.*?)\s*(\(.*\))\s*$/);
    return m
      ? { titleTop: m[1]!, titleParen: m[2]!, titleLevel: level }
      : { titleTop: main, titleParen: '', titleLevel: level };
  })();

  const freeWeeks = plan.weeks.slice(0, FREE_WEEKS);
  const teaserWeeks = plan.weeks.slice(FREE_WEEKS, FREE_WEEKS + TEASER_WEEKS);
  const lockedCount = Math.max(0, plan.weeks.length - FREE_WEEKS);

  const renderWeek = (week: (typeof plan.weeks)[number]): JSX.Element => (
    <View key={week.week} style={styles.weekBlock}>
      <Text style={styles.weekTitle}>
        {week.week} — {week.phase}
        {week.off ? ' (recuperação)' : ''}
      </Text>
      {week.workouts.map((workout, i) => {
        const paceClean = String(workout.pace).replace(/\/km/g, '');
        return (
          <View key={i} style={styles.workoutRow}>
            <Text style={styles.workoutDay}>{workout.dayOfWeek}</Text>
            <Text style={styles.workoutTitle} numberOfLines={1}>
              {workout.title}
            </Text>
            <Text style={styles.workoutMeta}>
              {workout.km} km · {paceClean}/km
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.titleMain}>{titleTop}</Text>
        {titleParen ? <Text style={styles.titleMain}>{titleParen}</Text> : null}
        {titleLevel ? <Text style={styles.titleLevel}>{titleLevel}</Text> : null}
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

        <Card title="Resumo do plano">
          <InfoRow label="Semanas totais" value={`${plan.totalWeeks}`} strong />
          <InfoRow label="Dias por semana" value={`${plan.daysPerWeek}`} strong />
          <InfoRow label="Volume total" value={`${totalKm.toFixed(0)} km`} strong />
        </Card>

        <Card title="Análise do atleta">
          <AnalysisBlock label="Nível informado" value={blueprint.athleteAnalysis.detectedLevel} />
          <AnalysisBlock label="Ponto forte" value={blueprint.athleteAnalysis.mainStrength} />
          <AnalysisBlock label="Ponto de atenção" value={blueprint.athleteAnalysis.mainWeakness} />
          <AnalysisBlock label="Foco" value={blueprint.athleteAnalysis.focus} />
          <View style={styles.analysisDivider} />
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
          <Card title="Zonas de treino (Z1–Z5)">
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

        <Card>
          <View style={styles.titleRowCenter}>
            <Text style={styles.cardTitle}>Qualidade técnica</Text>
            <Pressable
              onPress={() => setQualityInfoVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="O que é Quality Score e Risco técnico?"
            >
              <CircleHelp style={{ marginTop: -5 }} size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <QualityGauge
            score={validation?.summary.qualityScore ?? 0}
            status={validation?.summary.qualityStatus ?? '-'}
            riskLevel={validation?.summary.riskLevel ?? '-'}
          />
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

        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandToggle} accessibilityRole="button">
          <Text style={styles.expandLabel}>
            {expanded ? 'Ocultar detalhes' : 'Detalhar planilha semana a semana'}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.neon} />
        </Pressable>

        {expanded ? (
          <Card title={`Plano completo (${plan.weeks.length} semanas)`}>
            {isPlus ? (
              plan.weeks.map((week) => renderWeek(week))
            ) : (
              <>
                {freeWeeks.map((week) => renderWeek(week))}
                {teaserWeeks.length > 0 ? (
                  <PremiumGate
                    locked
                    title="Plano completo no RunEvo+"
                    description={`Desbloqueie as ${lockedCount} semanas restantes do seu ciclo completo.`}
                    cta="Conhecer o RunEvo+"
                    onUnlock={() => router.push('/runevo-plus')}
                    overlayOpacity={0.95}
                  >
                    {teaserWeeks.map((week) => renderWeek(week))}
                  </PremiumGate>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        {adoptError ? <Text style={styles.error}>{adoptError}</Text> : null}

        <View style={styles.actions}>
          <NeonButton label="Adotar planilha" variant="primary" onPress={() => void onAdopt()} loading={adopting} />
          <Pressable
            style={styles.secondaryBtn}
            onPress={onGenerateAnother}
            disabled={adopting}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Gerar outra planilha</Text>
          </Pressable>
        </View>
      </ScrollView>

      <QualityInfoModal visible={qualityInfoVisible} onClose={() => setQualityInfoVisible(false)} />
    </Screen>
  );
}

function AnalysisBlock({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.analysisBlock}>
      <Text style={styles.analysisLabel}>{label}</Text>
      <Text style={styles.analysisValue}>{value}</Text>
    </View>
  );
}

/** Cores suaves, nunca alarmantes (docs/fase-8-brief.md Grupo 2) — nada de vermelho/erro aqui. */
function viabilityColor(level: ViabilityLevel): string {
  if (level === 'realista') return colors.success;
  if (level === 'ambicioso') return colors.neon;
  return colors.textSecondary;
}

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }): JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={strong ? styles.infoValueStrong : styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  identicalTitle: { color: colors.neon, fontSize: fontSizes.lg, ...fontWeight('800'), textAlign: 'center' },
  identicalHint: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center' },
  scrollContent: { paddingBottom: spacing.xxxl },
  titleMain: { color: colors.textPrimary, fontSize: 28, ...fontWeight('800'), textAlign: 'center', marginTop: spacing.xs },
  titleLevel: { color: colors.textSecondary, fontSize: 15, ...fontWeight('700'), textAlign: 'center', letterSpacing: 1, marginTop: 2, marginBottom: spacing.xs },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center', marginBottom: spacing.xl },
  paragraph: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm, lineHeight: 20, textAlign: 'left' },
  titleRowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { color: colors.neon, fontSize: fontSizes.lg, ...fontWeight('800') },
  analysisBlock: { marginBottom: spacing.md },
  analysisLabel: { color: colors.textSecondary, fontSize: 13, ...fontWeight('600'), marginBottom: 2 },
  analysisValue: { color: colors.textPrimary, fontSize: 14, ...fontWeight('500'), lineHeight: 20 },
  analysisDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: spacing.xs, paddingTop: spacing.sm },
  secondaryBtn: { height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  secondaryBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
  viabilityCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  viabilityLabel: { fontSize: fontSizes.lg, ...fontWeight('800'), textAlign: 'center' },
  viabilityText: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 21, textAlign: 'center' },
  viabilityAnchor: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('700'), textAlign: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.md },
  infoLabel: { color: colors.textSecondary, fontSize: fontSizes.body, flexShrink: 0 },
  infoValue: { color: colors.textPrimary, fontSize: fontSizes.body, flexShrink: 1, textAlign: 'right' },
  infoValueStrong: { color: colors.neon, fontSize: 16, ...fontWeight('800'), flexShrink: 1, textAlign: 'right' },
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
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  expandLabel: { color: colors.neon, fontSize: fontSizes.body, ...fontWeight('700') },
  weekBlock: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekTitle: { color: colors.neon, ...fontWeight('800'), fontSize: fontSizes.body, marginBottom: spacing.sm },
  workoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, gap: spacing.sm },
  workoutDay: { color: colors.neon, fontSize: 12, ...fontWeight('700'), width: 64 },
  workoutTitle: { color: colors.textPrimary, fontSize: 13, ...fontWeight('500'), flex: 1 },
  workoutMeta: { color: colors.textSecondary, fontSize: 12, ...fontWeight('600'), textAlign: 'right' },
  error: { color: colors.error, fontSize: fontSizes.body, textAlign: 'center', marginBottom: spacing.md },
  actions: { gap: spacing.md },
});
