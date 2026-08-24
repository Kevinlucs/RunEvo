import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';
import type { Workout } from '@/domain/entities';

interface EditWorkoutModalProps {
  visible: boolean;
  workout: Workout;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (input: { plannedKm?: number; plannedPace?: string }) => void;
}

/** Modal popup para editar km e pace planejados de um treino. */
export function EditWorkoutModal({ visible, workout, submitting, onCancel, onConfirm }: EditWorkoutModalProps): JSX.Element {
  const [km, setKm] = useState(String(workout.planned_km ?? 0));
  const [pace, setPace] = useState(workout.planned_pace ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setKm(String(workout.planned_km ?? 0));
    setPace(workout.planned_pace ?? '');
    setError(null);
  }, [visible, workout]);

  const handleConfirm = (): void => {
    const parsedKm = Number(km.replace(',', '.'));
    if (!Number.isFinite(parsedKm) || parsedKm <= 0) {
      setError('Km deve ser um número maior que zero.');
      return;
    }
    setError(null);
    onConfirm({ plannedKm: parsedKm, plannedPace: pace.trim() });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <Ionicons name="create-outline" size={32} color={colors.neon} style={styles.icon} />
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
          <Text style={styles.label}>Pace planejado</Text>
          <TextInput
            style={styles.input}
            value={pace}
            onChangeText={setPace}
            placeholder="Ex.: 6:00/km"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <NeonButton label="Cancelar" variant="secondary" onPress={onCancel} disabled={submitting} />
            </View>
            <View style={styles.actionButton}>
              <NeonButton label="Salvar" onPress={handleConfirm} loading={submitting} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: spacing.xl },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.xl,
  },
  icon: { alignSelf: 'center', marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: 20, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.xl },
  label: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('500'), marginBottom: spacing.xs },
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
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});
