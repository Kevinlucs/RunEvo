import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { NeonButton } from '@/components/ui/NeonButton';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useCheckinAvailability } from '@/hooks/useCheckinAvailability';
import { useAuthStore } from '@/store/auth.store';
import { submitCheckin, isWeightRequiredForWeek, type SubmitCheckinResult } from '@/services/checkin/submit-checkin.service';
import type { Feeling } from '@/domain/motor-evo/adaptive-training';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

const FEELING_OPTIONS: { value: Feeling; label: string }[] = [
  { value: 'leve', label: 'Leve' },
  { value: 'normal', label: 'Normal' },
  { value: 'pesado', label: 'Pesado' },
  { value: 'muito_pesado', label: 'Muito pesado' },
];

const PAIN_OPTIONS = [
  { value: false, label: 'Não' },
  { value: true, label: 'Sim' },
];

const ACTION_TITLE: Record<string, string> = {
  maintain: 'Plano mantido',
  reduce: 'Plano ajustado',
  recovery: 'Semana de recuperação',
  slight_increase: 'Carga levemente ampliada',
};

/**
 * Check-in semanal como popup/modal transparente.
 * presentation: 'transparentModal' no _layout.tsx.
 */
export default function CheckinScreen(): JSX.Element {
  const { week } = useLocalSearchParams<{ week: string }>();
  const weekNumber = Number(week);
  const userId = useAuthStore((s) => s.userId);
  const { plan } = useActivePlan();
  const availability = useCheckinAvailability(Number.isFinite(weekNumber) ? weekNumber : null);

  const summary = availability.summary;
  const initialEffort = summary?.averageEffort ? Math.round(summary.averageEffort) : 5;

  const [effort, setEffort] = useState(initialEffort);
  const [feeling, setFeeling] = useState<Feeling>('normal');
  const [feelingOpen, setFeelingOpen] = useState(false);
  const [pain, setPain] = useState(false);
  const [painOpen, setPainOpen] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitCheckinResult | null>(null);

  const weightRequired = isWeightRequiredForWeek(weekNumber);

  const close = (): void => router.back();

  if (availability.isLoading) {
    return (
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.muted}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (!plan || !userId || !Number.isFinite(weekNumber)) {
    return (
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.muted}>Não foi possível abrir o check-in.</Text>
          <View style={styles.backButtonWrap}>
            <NeonButton label="Voltar" variant="secondary" onPress={close} />
          </View>
        </View>
      </View>
    );
  }

  if (!result && availability.status === 'done') {
    return (
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.muted}>Você já enviou o check-in desta semana.</Text>
          <View style={styles.backButtonWrap}>
            <NeonButton label="Voltar" variant="secondary" onPress={close} />
          </View>
        </View>
      </View>
    );
  }

  if (!result && availability.status === 'waiting') {
    return (
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.muted}>Conclua os treinos da semana para liberar o check-in.</Text>
          <View style={styles.backButtonWrap}>
            <NeonButton label="Voltar" variant="secondary" onPress={close} />
          </View>
        </View>
      </View>
    );
  }

  const handleSubmit = async (): Promise<void> => {
    if (!notes.trim()) {
      setNotesError('Preencha suas observações da semana.');
      return;
    }
    setNotesError(null);

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
        notes: notes.trim(),
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
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
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
            <NeonButton label="Concluir" onPress={close} />
          </ScrollView>
        </View>
      </View>
    );
  }

  const feelingLabel = FEELING_OPTIONS.find((o) => o.value === feeling)?.label ?? 'Normal';

  return (
    <Pressable style={styles.overlay} onPress={close}>
      <Pressable style={styles.sheet} onPress={() => { /* impede fechar ao clicar dentro */ }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Check-in S{weekNumber}</Text>
            {summary ? (
              <Text style={styles.headerMeta}>
                {summary.resolved}/{summary.total} treinos registrados • {summary.completedKm}/{summary.plannedKm} km
              </Text>
            ) : null}
          </View>

          {/* Sensação */}
          <Text style={styles.label}>Como a semana pareceu?</Text>
          <Pressable style={styles.dropdown} onPress={() => setFeelingOpen(!feelingOpen)} accessibilityRole="button">
            <Text style={styles.dropdownText}>{feelingLabel}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
          {feelingOpen ? (
            <View style={styles.dropdownList}>
              {FEELING_OPTIONS.map((o) => (
                <Pressable key={o.value} onPress={() => { setFeeling(o.value); setFeelingOpen(false); }} style={styles.dropdownItem}>
                  <Text style={[styles.dropdownItemText, feeling === o.value && styles.dropdownItemActive]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Esforço */}
          <Text style={styles.label}>Esforço geral da semana</Text>
          <Slider
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={effort}
            onValueChange={(v) => setEffort(Math.round(v))}
            minimumTrackTintColor={colors.neon}
            maximumTrackTintColor="#2A2A2A"
            thumbTintColor={colors.neon}
            style={styles.slider}
          />
          <Text style={styles.effortLabel}>Esforço: {effort}/10</Text>

          {/* Dor */}
          <Text style={styles.label}>Sentiu dor/incômodo?</Text>
          <Pressable style={styles.dropdown} onPress={() => setPainOpen(!painOpen)} accessibilityRole="button">
            <Text style={styles.dropdownText}>{pain ? 'Sim' : 'Não'}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
          {painOpen ? (
            <View style={styles.dropdownList}>
              {PAIN_OPTIONS.map((o) => (
                <Pressable key={String(o.value)} onPress={() => { setPain(o.value); setPainOpen(false); }} style={styles.dropdownItem}>
                  <Text style={[styles.dropdownItemText, pain === o.value && styles.dropdownItemActive]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Card peso (condicional) */}
          {weightRequired ? (
            <View style={styles.weightCard}>
              <Text style={styles.weightCardTitle}>Atualização obrigatória de peso</Text>
              <Text style={styles.weightCardText}>
                A cada 4 semanas, informe seu peso atual para recalcular o IMC e ajudar o IA Evo na análise.
              </Text>
              <Text style={styles.weightLabel}>Peso atual (kg)</Text>
              <TextInput
                style={[styles.input, weightError ? styles.inputError : null]}
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="Ex.: 68.5"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              {weightError ? <Text style={styles.errorText}>{weightError}</Text> : null}
            </View>
          ) : null}

          {/* Observações (obrigatório) */}
          <Text style={styles.label}>Observações</Text>
          <TextInput
            style={[styles.input, styles.textArea, notesError ? styles.inputError : null]}
            value={notes}
            onChangeText={(v) => { setNotes(v); if (v.trim()) setNotesError(null); }}
            multiline
            numberOfLines={5}
            placeholder="Sono, cansaço, dores, rotina, dificuldade dos treinos..."
            placeholderTextColor={colors.textMuted}
            textAlignVertical="top"
          />
          {notesError ? <Text style={styles.errorText}>{notesError}</Text> : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Botões */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={close} disabled={submitting} accessibilityRole="button">
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <View style={styles.confirmBtnWrap}>
              <NeonButton label="Confirmar" onPress={() => void handleSubmit()} loading={submitting} />
            </View>
          </View>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    maxHeight: '90%',
  },
  muted: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('400'), textAlign: 'center' },
  backButtonWrap: { marginTop: spacing.lg, minWidth: 160, alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  headerTitle: { color: colors.textPrimary, fontSize: 24, ...fontWeight('800') },
  headerMeta: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginTop: spacing.xs },
  label: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.sm, marginTop: spacing.lg },
  dropdown: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('400') },
  dropdownList: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  dropdownItemText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('400') },
  dropdownItemActive: { color: colors.neon, ...fontWeight('700') },
  slider: { marginTop: spacing.sm, height: 40 },
  effortLabel: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('500'), textAlign: 'center', marginTop: spacing.xs },
  weightCard: {
    backgroundColor: 'rgba(204,255,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  weightCardTitle: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.sm },
  weightCardText: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginBottom: spacing.md, lineHeight: 20 },
  weightLabel: { color: colors.neon, fontSize: 14, ...fontWeight('600'), marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    color: colors.textPrimary,
    fontSize: fontSizes.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: { borderColor: colors.error },
  textArea: { minHeight: 120 },
  errorText: { color: colors.error, fontSize: fontSizes.caption, ...fontWeight('500'), marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#2A2A2A',
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
  confirmBtnWrap: { flex: 1 },
  sourceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardElevated,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  sourceBadgeText: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('700') },
  resultMessage: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('400'), marginBottom: spacing.md },
  resultNote: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('400'), marginBottom: spacing.md },
  disclaimer: { color: colors.textMuted, fontSize: fontSizes.caption, ...fontWeight('400') },
});
