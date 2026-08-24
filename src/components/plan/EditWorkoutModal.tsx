import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { NeonButton } from '@/components/ui/NeonButton';
import { useShoes } from '@/hooks/useShoes';
import { useAuthStore } from '@/store/auth.store';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Workout } from '@/domain/entities';

interface EditWorkoutModalProps {
  visible: boolean;
  workout: Workout;
  submitting: boolean;
  checkinDoneForWeek: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    plannedKm?: number;
    completedKm?: number;
    shoeId?: string | null;
    perceivedEffort?: number;
    feedback?: string | null;
  }) => void;
  onRevertStatus: () => void;
}

/** Modal popup para editar km planejado e reverter o status de um treino. */
export function EditWorkoutModal({
  visible,
  workout,
  submitting,
  checkinDoneForWeek,
  onCancel,
  onConfirm,
  onRevertStatus,
}: EditWorkoutModalProps): JSX.Element {
  const userId = useAuthStore((s) => s.userId);
  const { shoes } = useShoes(userId);
  const [km, setKm] = useState(String(workout.planned_km ?? 0));
  const [completedKm, setCompletedKm] = useState(String(workout.completed_km ?? workout.planned_km ?? 0));
  const [shoeId, setShoeId] = useState(workout.shoe_id ?? '');
  const [effort, setEffort] = useState(workout.perceived_effort ?? 6);
  const [feedback, setFeedback] = useState(workout.feedback ?? '');
  const [shoeDropdownOpen, setShoeDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setKm(String(workout.planned_km ?? 0));
    setCompletedKm(String(workout.completed_km ?? workout.planned_km ?? 0));
    setShoeId(workout.shoe_id ?? '');
    setEffort(workout.perceived_effort ?? 6);
    setFeedback(workout.feedback ?? '');
    setError(null);
    setShoeDropdownOpen(false);
  }, [visible, workout]);

  const handleConfirm = (): void => {
    const parsedPlannedKm = Number(km.replace(',', '.'));
    const parsedCompletedKm = Number(completedKm.replace(',', '.'));
    if (!Number.isFinite(parsedPlannedKm) || parsedPlannedKm <= 0) {
      setError('Km planejado deve ser maior que zero.');
      return;
    }

    const input: {
      plannedKm: number;
      completedKm?: number;
      shoeId?: string | null;
      perceivedEffort?: number;
      feedback?: string | null;
    } = { plannedKm: parsedPlannedKm };
    if (workout.status !== 'pending') {
      input.completedKm = Number.isFinite(parsedCompletedKm) ? parsedCompletedKm : parsedPlannedKm;
      input.shoeId = shoeId || null;
      input.perceivedEffort = effort;
      input.feedback = feedback.trim() || null;
    }

    setError(null);
    onConfirm(input);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Editar treino</Text>

          <Text style={styles.label}>Km planejado</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={km}
            onChangeText={setKm}
            placeholder="Ex.: 10"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {workout.status !== 'pending' ? (
            <>
              <Text style={styles.label}>Km realizado</Text>
              <TextInput
                style={styles.input}
                value={completedKm}
                onChangeText={setCompletedKm}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Tênis usado</Text>
              {shoes.length > 0 ? (
                <>
                  <Pressable style={styles.dropdown} onPress={() => setShoeDropdownOpen(!shoeDropdownOpen)} accessibilityRole="button">
                    <Text style={[styles.dropdownText, !shoeId && styles.dropdownPlaceholder]}>
                      {shoes.find((s) => s.id === shoeId)?.nickname ?? shoes.find((s) => s.id === shoeId)?.model ?? 'Não informar'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                  </Pressable>
                  {shoeDropdownOpen ? (
                    <View style={styles.dropdownList}>
                      <Pressable onPress={() => { setShoeId(''); setShoeDropdownOpen(false); }} style={styles.dropdownItem}>
                        <Text style={styles.dropdownItemText}>Não informar</Text>
                      </Pressable>
                      {shoes.map((s) => (
                        <Pressable key={s.id} onPress={() => { setShoeId(s.id); setShoeDropdownOpen(false); }} style={styles.dropdownItem}>
                          <Text style={styles.dropdownItemText}>{s.nickname ?? s.model}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={[styles.dropdown, styles.dropdownDisabled]}>
                  <Text style={styles.dropdownPlaceholder}>Sem tênis cadastrado</Text>
                </View>
              )}

              <Text style={styles.label}>
                Esforço percebido <Text style={styles.labelHint}>(1 leve • 10 máximo)</Text>
              </Text>
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

              <Text style={styles.label}>
                Observação <Text style={styles.labelHint}>(opcional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={feedback}
                onChangeText={setFeedback}
                multiline
                numberOfLines={3}
                placeholder="Como foi o treino?"
                placeholderTextColor={colors.textMuted}
                textAlignVertical="top"
              />

              <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>
                Status atual: {workout.status === 'completed' ? 'Concluído' : 'Pulado'}
              </Text>
              {checkinDoneForWeek ? (
                <Text style={styles.statusBlocked}>
                  Este treino não pode ser desmarcado porque o check-in da semana já foi preenchido.
                </Text>
              ) : (
                <Pressable
                  style={styles.revertBtn}
                  onPress={onRevertStatus}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.revertBtnText}>Desmarcar conclusão</Text>
                </Pressable>
              )}
              </View>
            </>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={submitting} accessibilityRole="button">
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <NeonButton label="Salvar" onPress={handleConfirm} loading={submitting} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  sheet: { width: '100%', maxHeight: '90%', backgroundColor: colors.card, borderRadius: 20, padding: spacing.xl },
  title: { color: colors.textPrimary, fontSize: 20, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.xl },
  label: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.sm },
  labelHint: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400') },
  input: {
    height: 52,
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    fontSize: fontSizes.base,
    marginBottom: spacing.lg,
  },
  inputError: { borderColor: colors.error },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md },
  dropdown: { backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  dropdownDisabled: { opacity: 0.5 },
  dropdownText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('400') },
  dropdownPlaceholder: { color: colors.textMuted, fontSize: fontSizes.base, ...fontWeight('400') },
  dropdownList: { backgroundColor: colors.cardElevated, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', marginTop: -spacing.md, marginBottom: spacing.lg, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  dropdownItemText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('400') },
  slider: { marginBottom: spacing.sm, height: 40 },
  effortLabel: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('500'), textAlign: 'center', marginBottom: spacing.lg },
  statusSection: { marginTop: spacing.sm, marginBottom: spacing.lg },
  statusLabel: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginBottom: spacing.sm },
  statusBlocked: { color: colors.error, fontSize: 13, ...fontWeight('400'), lineHeight: 18 },
  revertBtn: { height: 44, backgroundColor: 'rgba(255,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  revertBtnText: { color: colors.error, fontSize: fontSizes.body, ...fontWeight('600') },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { flex: 1, height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
});
