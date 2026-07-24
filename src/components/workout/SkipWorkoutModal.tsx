import { useEffect, useState } from 'react';
import { Modal, View, Text, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { TextField } from '@/components/ui/TextField';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes } from '@/theme';
import type { Workout } from '@/domain/entities';

interface Props {
  visible: boolean;
  workout: Workout;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
}

/**
 * docs/fase-4-brief.md Grupo 4 (§28): confirmação + motivo opcional.
 * Nunca abre o formulário de conclusão.
 */
export function SkipWorkoutModal({ visible, workout, submitting, onCancel, onConfirm }: Props): JSX.Element {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Pular treino</Text>
          <Text style={styles.message}>
            {workout.title ?? 'Este treino'} será marcado como pulado. O check-in semanal vai considerar essa
            informação.
          </Text>

          <TextField
            label="Motivo (opcional)"
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Dor, agenda, cansaço, clima..."
          />

          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <NeonButton label="Cancelar" variant="secondary" onPress={onCancel} disabled={submitting} />
            </View>
            <View style={styles.actionButton}>
              <NeonButton label="Pular treino" onPress={() => onConfirm(reason.trim() || null)} loading={submitting} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.xl },
  sheet: {
    width: '100%',
    backgroundColor: colors.bg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  title: { color: colors.textPrimary, fontSize: fontSizes.xl, fontWeight: '800' },
  message: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});
