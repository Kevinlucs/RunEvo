import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Workout } from '@/domain/entities';

interface EditWorkoutModalProps {
  visible: boolean;
  workout: Workout;
  submitting: boolean;
  checkinDoneForWeek: boolean;
  onCancel: () => void;
  onConfirm: (input: { plannedKm?: number }) => void;
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
  const [km, setKm] = useState(String(workout.planned_km ?? 0));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setKm(String(workout.planned_km ?? 0));
    setError(null);
  }, [visible, workout]);

  const handleConfirm = (): void => {
    const parsedKm = Number(km.replace(',', '.'));
    if (!Number.isFinite(parsedKm) || parsedKm <= 0) {
      setError('Km deve ser um número maior que zero.');
      return;
    }
    setError(null);
    onConfirm({ plannedKm: parsedKm });
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
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md },
  statusSection: { marginTop: spacing.sm, marginBottom: spacing.lg },
  statusLabel: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginBottom: spacing.sm },
  statusBlocked: { color: colors.error, fontSize: 13, ...fontWeight('400'), lineHeight: 18 },
  revertBtn: { height: 44, backgroundColor: 'rgba(255,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  revertBtnText: { color: colors.error, fontSize: fontSizes.body, ...fontWeight('600') },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { flex: 1, height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
});
