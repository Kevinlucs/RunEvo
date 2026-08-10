import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { usePlanGenerationStore } from '@/store/plan-generation.store';
import { useAuthStore } from '@/store/auth.store';
import { generatePlanWithProgress, GENERATION_STEP_LABELS, type GenerationStep } from '@/services/plan/generate-plan.service';
import { isIdenticalToActivePlan } from '@/services/plan/plan-identity.service';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * Loading com etapas reais (docs/fase-3-brief.md §4.1) — `currentStep` só
 * avança nas fronteiras de verdade do pipeline (resolveBlueprint →
 * assemblePlan → validateAndFixPlan), nunca por timer.
 */
export default function PlanGenerating(): JSX.Element {
  const pendingInput = usePlanGenerationStore((s) => s.pendingInput);
  const setGeneratedPlan = usePlanGenerationStore((s) => s.setGeneratedPlan);
  const userId = useAuthStore((s) => s.userId);
  const [step, setStep] = useState<GenerationStep>('analisando');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!pendingInput) {
      router.replace('/(tabs)/ai-evo');
      return;
    }
    started.current = true;

    (async () => {
      try {
        const { plan, viability, viabilityExplanation } = await generatePlanWithProgress(pendingInput, setStep);
        const identical = userId ? await isIdenticalToActivePlan(userId, plan) : false;
        setGeneratedPlan(plan, identical, viability, viabilityExplanation);
        router.replace('/plan/preview');
      } catch (e) {
        // Fallback local é obrigatório (docs/fase-3-brief.md §0.4) — se mesmo
        // assim chegou erro aqui, é bug de validação/motor, não de IA (a IA
        // já cai pro local dentro de resolveBlueprint). Não deixa o atleta
        // travado: mostra erro com opção de tentar de novo.
        setError(e instanceof Error ? e.message : 'Não foi possível gerar a planilha.');
      }
    })();
  }, [pendingInput, userId, setGeneratedPlan]);

  if (error) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Algo deu errado</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <NeonButton label="Voltar e tentar de novo" onPress={() => router.replace('/(tabs)/ai-evo')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.neon} />
        <Text style={styles.label}>{GENERATION_STEP_LABELS[step]}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  label: { color: colors.textSecondary, fontSize: fontSizes.base, textAlign: 'center', paddingHorizontal: spacing.xl },
  errorTitle: { color: colors.error, fontSize: fontSizes.lg, ...fontWeight('800') },
  errorMessage: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center', paddingHorizontal: spacing.xl },
});
