import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { NeonButton } from '@/components/ui/NeonButton';
import { TextField } from '@/components/ui/TextField';
import { StatBox, StatBoxRow } from '@/components/ui/StatBox';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useCheckinAvailability } from '@/hooks/useCheckinAvailability';
import { useAuthStore } from '@/store/auth.store';
import { submitCheckin, isWeightRequiredForWeek, type SubmitCheckinResult } from '@/services/checkin/submit-checkin.service';
import type { Feeling } from '@/domain/motor-evo/adaptive-training';
import { colors, radii, spacing, fontSizes, fontWeight, MIN_TOUCH_TARGET } from '@/theme';

const FEELING_OPTIONS: { value: Feeling; label: string }[] = [
  { value: 'leve', label: 'Leve' },
  { value: 'normal', label: 'Normal' },
  { value: 'pesado', label: 'Pesado' },
  { value: 'muito_pesado', label: 'Muito pesado' },
];

const ACTION_TITLE: Record<string, string> = {
  maintain: 'Plano mantido',
  reduce: 'Plano ajustado',
  recovery: 'Semana de recuperação',
  slight_increase: 'Carga levemente ampliada',
};

/**
 * docs/fase-5-brief.md Grupo 3/§21 — sem mockup, layout a partir do brief.
 * Guarda de acesso: só permite enviar quando `useCheckinAvailability`
 * confirma `available` (resolved === total e ainda não enviado) — protege
 * contra navegação direta pela URL para uma semana inválida.
 */
export default function CheckinScreen(): JSX.Element {
  const { week } = useLocalSearchParams<{ week: string }>();
  const weekNumber = Number(week);
  const userId = useAuthStore((s) => s.userId);
  const { plan } = useActivePlan();
  const availability = useCheckinAvailability(Number.isFinite(weekNumber) ? weekNumber : null);

  const [effort, setEffort] = useState(5);
  const [feeling, setFeeling] = useState<Feeling>('normal');
  const [pain, setPain] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitCheckinResult | null>(null);

  const weightRequired = isWeightRequiredForWeek(weekNumber);

  if (availability.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Carregando...</Text>
      </View>
    );
  }

  if (!plan || !userId || !Number.isFinite(weekNumber)) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Não foi possível abrir o check-in.</Text>
      </View>
    );
  }

  if (!result && availability.status === 'done') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: `Check-in — Semana ${weekNumber}` }} />
        <Text style={styles.muted}>Você já enviou o check-in desta semana.</Text>
        <View style={styles.backButtonWrap}>
          <NeonButton label="Voltar" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (!result && availability.status === 'waiting') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: `Check-in — Semana ${weekNumber}` }} />
        <Text style={styles.muted}>Conclua os treinos da semana para liberar o check-in.</Text>
        <View style={styles.backButtonWrap}>
          <NeonButton label="Voltar" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const summary = availability.summary;

  const handleSubmit = async (): Promise<void> => {
    if (weightRequired && !weightKg.trim()) {
      setWeightError('Peso obrigatório nesta semana.');
      return;
    }
    setWeightError(null);
    setError(null);
    setSubmitting(true);

    const parsedWeight = weightKg.trim() ? Number(weightKg.replace(',', '.')) : null;
    const res = await submitCheckin({
      planId: plan.id,
      userId,
      weekNumber,
      feedback: {
        effort,
        feeling,
        pain,
        notes: notes.trim() || null,
        currentWeightKg: parsedWeight,
      },
    });

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setResult(res.value);
  };

  if (result) {
    const isAi = result.recommendation.source === 'ai';
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: `Check-in — Semana ${weekNumber}` }} />
        <Card title={ACTION_TITLE[result.recommendation.action] ?? 'Plano ajustado'}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{isAi ? '🧠 IA Evo' : '⚙️ Ajuste local'}</Text>
          </View>
          <Text style={styles.resultMessage}>{result.recommendation.message}</Text>
          {result.redistribution.applied ? (
            <Text style={styles.resultNote}>{result.redistribution.note}</Text>
          ) : null}
          <Text style={styles.disclaimer}>
            Esta recomendação é gerada automaticamente e não substitui orientação médica ou de um profissional de
            educação física.
          </Text>
        </Card>
        <NeonButton label="Concluir" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `Check-in — Semana ${weekNumber}` }} />

      {summary ? (
        <Card title="Resumo da semana">
          <StatBoxRow>
            <StatBox value={`${summary.resolved}/${summary.total}`} label="Treinos" emphasis />
            <StatBox value={`${summary.completedKm}/${summary.plannedKm}`} label="Km" emphasis />
            <StatBox value={summary.averageEffort ? `${summary.averageEffort}` : '-'} label="Esforço médio" emphasis />
          </StatBoxRow>
        </Card>
      ) : null}

      <Card title="Como foi a semana?">
        <Text style={styles.fieldLabel}>Esforço percebido</Text>
        <View style={styles.effortRow}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: effort === value }}
              onPress={() => setEffort(value)}
              style={[styles.effortPill, effort === value && styles.effortPillSelected]}
            >
              <Text style={[styles.effortPillText, effort === value && styles.effortPillTextSelected]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Sensação</Text>
        <View style={styles.pillRow}>
          {FEELING_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: feeling === option.value }}
              onPress={() => setFeeling(option.value)}
              style={[styles.pill, feeling === option.value && styles.pillSelected]}
            >
              <Text style={[styles.pillText, feeling === option.value && styles.pillTextSelected]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Sentiu dor ou incômodo?</Text>
        <View style={styles.pillRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !pain }}
            onPress={() => setPain(false)}
            style={[styles.pill, !pain && styles.pillSelected]}
          >
            <Text style={[styles.pillText, !pain && styles.pillTextSelected]}>Não</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: pain }}
            onPress={() => setPain(true)}
            style={[styles.pill, pain && styles.pillSelected]}
          >
            <Text style={[styles.pillText, pain && styles.pillTextSelected]}>Sim</Text>
          </Pressable>
        </View>

        <TextField
          label={weightRequired ? 'Peso atual (kg) — obrigatório nesta semana' : 'Peso atual (kg) — opcional'}
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="Ex.: 68.5"
          keyboardType="decimal-pad"
          error={weightError ?? undefined}
        />

        <TextField label="Observações (opcional)" value={notes} onChangeText={setNotes} multiline />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <NeonButton label="Analisar semana" onPress={() => void handleSubmit()} loading={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: fontSizes.body, textAlign: 'center' },
  backButtonWrap: { marginTop: spacing.lg, minWidth: 160 },
  fieldLabel: { color: colors.textSecondary, fontSize: fontSizes.body, marginBottom: spacing.sm, marginTop: spacing.sm },
  effortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  effortPill: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effortPillSelected: { backgroundColor: colors.neon, borderColor: colors.neon },
  effortPillText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
  effortPillTextSelected: { color: colors.bg },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  pill: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: { backgroundColor: colors.neon, borderColor: colors.neon },
  pillText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('600') },
  pillTextSelected: { color: colors.bg },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md },
  sourceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardElevated,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  sourceBadgeText: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('700') },
  resultMessage: { color: colors.textPrimary, fontSize: fontSizes.base, marginBottom: spacing.md },
  resultNote: { color: colors.textSecondary, fontSize: fontSizes.body, marginBottom: spacing.md },
  disclaimer: { color: colors.textMuted, fontSize: fontSizes.caption },
});
