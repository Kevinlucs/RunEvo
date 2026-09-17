import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { usePlanGenerationStore } from '@/store/plan-generation.store';
import { useAuthStore } from '@/store/auth.store';
import { generatePlanWithProgress } from '@/services/plan/generate-plan.service';
import { isIdenticalToActivePlan } from '@/services/plan/plan-identity.service';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

/** Mensagens cosméticas que rotacionam durante a geração (não refletem o step real do pipeline). */
const LOADING_MESSAGES = [
  'Analisando atleta...',
  'Interpretando seu objetivo...',
  'Analisando o terreno...',
  'Calculando suas zonas de treino...',
  'Montando a estratégia do ciclo...',
  'Distribuindo os treinos da semana...',
  'Validando o plano e o quality score...',
];

/**
 * Loading (docs/fase-3-brief.md §4.1). O pipeline real roda em
 * `generatePlanWithProgress`; o texto exibido rotaciona por timer (cosmético)
 * para dar sensação de progresso, sem depender do step real.
 */
export default function PlanGenerating(): JSX.Element {
  const pendingInput = usePlanGenerationStore((s) => s.pendingInput);
  const setGeneratedPlan = usePlanGenerationStore((s) => s.setGeneratedPlan);
  const userId = useAuthStore((s) => s.userId);
  const [error, setError] = useState<string | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);
  const started = useRef(false);

  // Rotação cosmética das mensagens a cada ~2.2s.
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  // Fade do texto a cada troca de mensagem.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [msgIndex, fadeAnim]);

  useEffect(() => {
    if (started.current) return;
    if (!pendingInput) {
      router.replace('/(tabs)/ai-evo');
      return;
    }
    started.current = true;

    (async () => {
      try {
        const { plan, viability, viabilityExplanation } = await generatePlanWithProgress(pendingInput, () => {});
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
        <Text style={styles.heading}>Gerando sua planilha</Text>
        <ActivityIndicator size="large" color={colors.neon} />
        <Animated.Text
          style={[
            styles.label,
            { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
          ]}
        >
          {LOADING_MESSAGES[msgIndex]}
        </Animated.Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  heading: { color: colors.textPrimary, fontSize: 18, ...fontWeight('800'), textAlign: 'center' },
  label: { color: colors.textSecondary, fontSize: fontSizes.base, textAlign: 'center', paddingHorizontal: spacing.xl },
  errorTitle: { color: colors.error, fontSize: fontSizes.lg, ...fontWeight('800') },
  errorMessage: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center', paddingHorizontal: spacing.xl },
});
