import { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { TextField } from '@/components/ui/TextField';
import { ChoiceField } from '@/components/forms/ChoiceField';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes } from '@/theme';
import type { Workout, Shoe } from '@/domain/entities';

export interface CompleteWorkoutFormInput {
  completedKm: number;
  shoeId: string | null;
  perceivedEffort: number;
  feedback: string | null;
}

interface Props {
  visible: boolean;
  workout: Workout;
  shoes: Shoe[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (input: CompleteWorkoutFormInput) => void;
}

const EFFORT_OPTIONS = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const NO_SHOE_VALUE = '';

function shoeLabel(shoe: Shoe): string {
  return shoe.nickname ?? [shoe.brand, shoe.model].filter(Boolean).join(' ');
}

/**
 * docs/fase-4-brief.md Grupo 4 (§28): km realizado (pré-preenchido), tênis
 * (opcional — CRUD é da Fase 6, sem tênis cadastrado não bloqueia conclusão),
 * esforço 1-10, observação. Cancelar/Concluir.
 */
export function CompleteWorkoutModal({ visible, workout, shoes, submitting, onCancel, onConfirm }: Props): JSX.Element {
  const [completedKm, setCompletedKm] = useState(String(workout.planned_km ?? 0));
  const [shoeId, setShoeId] = useState(NO_SHOE_VALUE);
  const [effort, setEffort] = useState('6');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCompletedKm(String(workout.planned_km ?? 0));
    setShoeId(NO_SHOE_VALUE);
    setEffort('6');
    setFeedback('');
  }, [visible, workout]);

  const handleConfirm = (): void => {
    const parsedKm = Number(completedKm.replace(',', '.'));
    onConfirm({
      completedKm: Number.isFinite(parsedKm) ? parsedKm : (workout.planned_km ?? 0),
      shoeId: shoeId || null,
      perceivedEffort: Number(effort),
      feedback: feedback.trim() || null,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            <Text style={styles.title}>Concluir treino</Text>
            <Text style={styles.subtitle}>
              {workout.title ?? 'Treino'} · {workout.planned_km ?? 0} km planejados
            </Text>

            <TextField
              label="Km realizado"
              value={completedKm}
              onChangeText={setCompletedKm}
              keyboardType="decimal-pad"
            />

            {shoes.length > 0 ? (
              <ChoiceField
                label="Tênis (opcional)"
                value={shoeId}
                onChange={setShoeId}
                options={[{ value: NO_SHOE_VALUE, label: 'Nenhum' }, ...shoes.map((s) => ({ value: s.id, label: shoeLabel(s) }))]}
              />
            ) : (
              <Text style={styles.emptyShoes}>Nenhum tênis cadastrado. Pode concluir sem selecionar.</Text>
            )}

            <ChoiceField
              label="Esforço percebido (1 leve · 10 máximo)"
              value={effort}
              onChange={setEffort}
              options={EFFORT_OPTIONS}
            />

            <TextField
              label="Observação (opcional)"
              value={feedback}
              onChangeText={setFeedback}
              multiline
              placeholder="Como foi o treino? Dor, cansaço, clima..."
            />

            <View style={styles.actions}>
              <View style={styles.actionButton}>
                <NeonButton label="Cancelar" variant="secondary" onPress={onCancel} disabled={submitting} />
              </View>
              <View style={styles.actionButton}>
                <NeonButton label="Concluir" onPress={handleConfirm} loading={submitting} />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  title: { color: colors.textPrimary, fontSize: fontSizes.xl, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.lg },
  emptyShoes: { color: colors.textMuted, fontSize: fontSizes.body, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});
