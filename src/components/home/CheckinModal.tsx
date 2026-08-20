import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
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

interface Props {
  visible: boolean;
  weekNumber: number;
  onClose: () => void;
}

/**
 * Modal nativo de check-in semanal — renderiza sobre a Home.
 * Mesmo padrão visual de Concluir/Pular treino (bottom sheet, overlay semi-transparente).
 */
export function CheckinModal({ visible, weekNumber, onClose }: Props): JSX.Element {
  const userId = useAuthStore((s) => s.userId);
  const { plan } = useActivePlan();
  const availability = useCheckinAvailability(visible && Number.isFinite(weekNumber) ? weekNumber : null);

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

  // Reset state ao abrir
  useEffect(() => {
    if (!visible) return;
    setEffort(initialEffort);
    setFeeling('normal');
    setFeelingOpen(false);
    setPain(false);
    setPainOpen(false);
    setWeightKg('');
    setNotes('');
    setNotesError(null);
    setWeightError(null);
    setError(null);
    setResult(null);
  }, [visible, initialEffort]);

  const handleSubmit = async (): Promise<void> => {
    if (!plan || !userId) return;
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
      feedback: { effort, feeling, pain, notes: notes.trim(), currentWeightKg: parsedWeight },
    });

    setSubmitting(false);
    if (!res.ok) { setError(res.error.message); return; }
    setResult(res.value);
  };

  const feelingLabel = FEELING_OPTIONS.find((o) => o.value === feeling)?.label ?? 'Normal';

  // Conteúdo interno do modal
  const renderContent = (): JSX.Element => {
    if (availability.isLoading) {
      return <Text style={styles.muted}>Carregando...</Text>;
    }
    if (!plan || !userId) {
      return (
        <>
          <Text style={styles.muted}>Não foi possível abrir o check-in.</Text>
          <View style={styles.backWrap}><NeonButton label="Fechar" variant="secondary" onPress={onClose} /></View>
        </>
      );
    }
    if (!result && availability.status === 'done') {
      return (
        <>
          <Text style={styles.muted}>Você já enviou o check-in desta semana.</Text>
          <View style={styles.backWrap}><NeonButton label="Fechar" variant="secondary" onPress={onClose} /></View>
        </>
      );
    }
    if (!result && availability.status === 'waiting') {
      return (
        <>
          <Text style={styles.muted}>Conclua os treinos da semana para liberar o check-in.</Text>
          <View style={styles.backWrap}><NeonButton label="Fechar" variant="secondary" onPress={onClose} /></View>
        </>
      );
    }

    if (result) {
      const isAi = result.recommendation.source === 'ai';
      return (
        <>
          <Card title={ACTION_TITLE[result.recommendation.action] ?? 'Plano ajustado'}>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>{isAi ? '🧠 IA Evo' : '⚙️ Ajuste local'}</Text>
            </View>
            <Text style={styles.resultMessage}>{result.recommendation.message}</Text>
            {result.redistribution.applied ? <Text style={styles.resultNote}>{result.redistribution.note}</Text> : null}
            <Text style={styles.disclaimer}>Esta recomendação é gerada automaticamente e não substitui orientação médica.</Text>
          </Card>
          <NeonButton label="Concluir" onPress={onClose} />
        </>
      );
    }

    return (
      <>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Check-in S{weekNumber}</Text>
          {summary ? (
            <Text style={styles.headerMeta}>{summary.resolved}/{summary.total} treinos • {summary.completedKm}/{summary.plannedKm} km</Text>
          ) : null}
        </View>

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

        <Text style={styles.label}>Esforço geral da semana</Text>
        <Slider
          minimumValue={1} maximumValue={10} step={1} value={effort}
          onValueChange={(v) => setEffort(Math.round(v))}
          minimumTrackTintColor={colors.neon} maximumTrackTintColor="#2A2A2A" thumbTintColor={colors.neon}
          style={styles.slider}
        />
        <Text style={styles.effortLabel}>Esforço: {effort}/10</Text>

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

        {weightRequired ? (
          <View style={styles.weightCard}>
            <Text style={styles.weightCardTitle}>Atualização obrigatória de peso</Text>
            <Text style={styles.weightCardText}>A cada 4 semanas, informe seu peso atual para recalcular o IMC.</Text>
            <Text style={styles.weightLabel}>Peso atual (kg)</Text>
            <TextInput style={[styles.input, weightError ? styles.inputError : null]} value={weightKg} onChangeText={setWeightKg} placeholder="Ex.: 68.5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
            {weightError ? <Text style={styles.errorText}>{weightError}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.label}>Observações</Text>
        <TextInput
          style={[styles.input, styles.textArea, notesError ? styles.inputError : null]}
          value={notes} onChangeText={(v) => { setNotes(v); if (v.trim()) setNotesError(null); }}
          multiline numberOfLines={4} placeholder="Sono, cansaço, dores, rotina..."
          placeholderTextColor={colors.textMuted} textAlignVertical="top"
        />
        {notesError ? <Text style={styles.errorText}>{notesError}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting} accessibilityRole="button">
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </Pressable>
          <View style={styles.confirmBtnWrap}>
            <NeonButton label="Confirmar" onPress={() => void handleSubmit()} loading={submitting} />
          </View>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {renderContent()}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  muted: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('400'), textAlign: 'center', paddingVertical: spacing.xl },
  backWrap: { marginTop: spacing.md, alignSelf: 'center', minWidth: 160 },
  header: { alignItems: 'center', marginBottom: spacing.md },
  headerTitle: { color: colors.textPrimary, fontSize: 24, ...fontWeight('800') },
  headerMeta: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginTop: spacing.xs },
  label: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.sm, marginTop: spacing.lg },
  dropdown: {
    backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('400') },
  dropdownList: { backgroundColor: colors.cardElevated, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', marginTop: spacing.xs, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  dropdownItemText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('400') },
  dropdownItemActive: { color: colors.neon, ...fontWeight('700') },
  slider: { marginTop: spacing.sm, height: 40 },
  effortLabel: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('500'), textAlign: 'center', marginTop: spacing.xs },
  weightCard: { backgroundColor: 'rgba(204,255,0,0.06)', borderWidth: 1, borderColor: 'rgba(204,255,0,0.2)', borderRadius: 12, padding: spacing.lg, marginTop: spacing.lg },
  weightCardTitle: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.sm },
  weightCardText: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginBottom: spacing.md, lineHeight: 20 },
  weightLabel: { color: colors.neon, fontSize: 14, ...fontWeight('600'), marginBottom: spacing.sm },
  input: { backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, color: colors.textPrimary, fontSize: fontSizes.base, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  inputError: { borderColor: colors.error },
  textArea: { minHeight: 100 },
  errorText: { color: colors.error, fontSize: fontSizes.caption, ...fontWeight('500'), marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelBtn: { flex: 1, height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
  confirmBtnWrap: { flex: 1 },
  sourceBadge: { alignSelf: 'flex-start', backgroundColor: colors.cardElevated, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginBottom: spacing.md },
  sourceBadgeText: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('700') },
  resultMessage: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('400'), marginBottom: spacing.md },
  resultNote: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('400'), marginBottom: spacing.md },
  disclaimer: { color: colors.textMuted, fontSize: fontSizes.caption, ...fontWeight('400') },
});
