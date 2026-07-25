import { useEffect, useState } from 'react';
import { Modal, View, Text, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui/TextField';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
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
          <View style={styles.badge}>
            <Ionicons name="play-skip-forward" size={26} color={colors.bg} />
          </View>
          <Text style={styles.title}>Pular treino</Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{workout.title ?? 'Treino'}</Text>
            <Text style={styles.summaryMeta}>
              {workout.planned_km ?? 0} km planejados · {workout.phase ?? 'Base'}
            </Text>
          </View>

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
  badge: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800'), textAlign: 'center' },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
  summaryMeta: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: spacing.xs },
  message: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});
