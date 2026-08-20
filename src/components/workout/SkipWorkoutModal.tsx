import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
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
 * Modal popup "Pular treino" — centralizado, fade, visual limpo.
 * Sem ícone, sem esforço. Card informativo + observação + botões.
 */
export function SkipWorkoutModal({ visible, workout, submitting, onCancel, onConfirm }: Props): JSX.Element {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheet} onPress={() => { /* impede fechar ao clicar dentro */ }}>
            <Text style={styles.title}>Pular treino</Text>

            {/* Card resumo */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{workout.title ?? 'Treino'}</Text>
              <Text style={styles.summaryMeta}>
                {workout.planned_km ?? 0} km planejados • {workout.phase ?? 'Base'}
              </Text>
            </View>

            {/* Card informativo */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Oque irá acontecer ?</Text>
              <Text style={styles.infoText}>
                Ao pular o treino, o check-in será liberado. O IA Evo irá considerar o treino como pulado e redistribuirá a carga de forma prudente na próxima semana, somente quando for seguro.
              </Text>
            </View>

            {/* Observação */}
            <Text style={styles.label}>
              Observação <Text style={styles.labelHint}>(opcional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              placeholder="Por que pulou? Dor, agenda, cansaço..."
              placeholderTextColor={colors.textMuted}
              textAlignVertical="center"
            />

            {/* Botões */}
            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={submitting} accessibilityRole="button">
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <View style={styles.confirmBtnWrap}>
                <NeonButton label="Pular" onPress={() => onConfirm(reason.trim() || null)} loading={submitting} />
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
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
  },
  title: { color: colors.textPrimary, fontSize: 22, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.lg },
  summaryCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  summaryTitle: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
  summaryMeta: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('400'), marginTop: 2 },
  infoCard: {
    backgroundColor: 'rgba(204,255,0,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  infoTitle: { color: colors.neon, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.sm },
  infoText: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), textAlign: 'center', lineHeight: 20 },
  label: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.sm },
  labelHint: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400') },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    color: colors.textPrimary,
    fontSize: fontSizes.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 80,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
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
});
