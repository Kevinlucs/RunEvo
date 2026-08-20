import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
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

const NO_SHOE_VALUE = '';

function shoeLabel(shoe: Shoe): string {
  return shoe.nickname ?? [shoe.brand, shoe.model].filter(Boolean).join(' ');
}

/**
 * Modal popup "Concluir treino" — centralizado, fade, com Slider neon.
 * Layout pixel-perfect com mockup CONCLUIR TREINO.jpg.
 */
export function CompleteWorkoutModal({ visible, workout, shoes, submitting, onCancel, onConfirm }: Props): JSX.Element {
  const [completedKm, setCompletedKm] = useState(String(workout.planned_km ?? 0));
  const [shoeId, setShoeId] = useState(NO_SHOE_VALUE);
  const [effort, setEffort] = useState(6);
  const [feedback, setFeedback] = useState('');
  const [shoeDropdownOpen, setShoeDropdownOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCompletedKm(String(workout.planned_km ?? 0));
    setShoeId(NO_SHOE_VALUE);
    setEffort(6);
    setFeedback('');
    setShoeDropdownOpen(false);
  }, [visible, workout]);

  const handleConfirm = (): void => {
    const parsedKm = Number(completedKm.replace(',', '.'));
    onConfirm({
      completedKm: Number.isFinite(parsedKm) ? parsedKm : (workout.planned_km ?? 0),
      shoeId: shoeId || null,
      perceivedEffort: effort,
      feedback: feedback.trim() || null,
    });
  };

  const selectedShoe = shoes.find((s) => s.id === shoeId);
  const shoeText = selectedShoe ? shoeLabel(selectedShoe) : 'Não informar';
  const hasShoes = shoes.length > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.overlayContainer}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.overlay} onPress={onCancel}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Drag handle */}
              <View style={styles.dragHandle} />

            <Text style={styles.title}>Concluir treino</Text>

            {/* Card resumo */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{workout.title ?? 'Treino'}</Text>
              <Text style={styles.summaryMeta}>
                {workout.planned_km ?? 0} km planejados • {workout.phase ?? 'Base'}
              </Text>
            </View>

            {/* Km realizado */}
            <Text style={styles.label}>Km realizado</Text>
            <TextInput
              style={styles.input}
              value={completedKm}
              onChangeText={setCompletedKm}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
            />

            {/* Tênis */}
            <Text style={styles.label}>Tênis usado</Text>
            {hasShoes ? (
              <>
                <Pressable
                  style={styles.dropdown}
                  onPress={() => setShoeDropdownOpen(!shoeDropdownOpen)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.dropdownText, !selectedShoe && styles.dropdownPlaceholder]}>
                    {shoeText}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                </Pressable>
                {shoeDropdownOpen ? (
                  <View style={styles.dropdownList}>
                    <Pressable onPress={() => { setShoeId(NO_SHOE_VALUE); setShoeDropdownOpen(false); }} style={styles.dropdownItem}>
                      <Text style={styles.dropdownItemText}>Não informar</Text>
                    </Pressable>
                    {shoes.map((s) => (
                      <Pressable key={s.id} onPress={() => { setShoeId(s.id); setShoeDropdownOpen(false); }} style={styles.dropdownItem}>
                        <Text style={styles.dropdownItemText}>{shoeLabel(s)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={[styles.dropdown, styles.dropdownDisabled]}>
                <Text style={styles.dropdownPlaceholder}>Sem tênis cadastrado</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </View>
            )}

            {/* Esforço percebido */}
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

            {/* Observação */}
            <Text style={styles.label}>
              Observação <Text style={styles.labelHint}>(opcional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={3}
              placeholder="Como foi o treino? Dor, cansaço, clima, etc."
              placeholderTextColor={colors.textMuted}
              textAlignVertical="top"
            />

            {/* Botões */}
            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={submitting} accessibilityRole="button">
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <View style={styles.confirmBtnWrap}>
                <NeonButton label="Concluir treino" onPress={handleConfirm} loading={submitting} />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    maxHeight: '85%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.textPrimary, fontSize: 22, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.lg },
  summaryCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  summaryTitle: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
  summaryMeta: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('400'), marginTop: spacing.xs },
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
  },
  textArea: { minHeight: 80 },
  dropdown: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  dropdownDisabled: { opacity: 0.5 },
  dropdownText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('400') },
  dropdownPlaceholder: { color: colors.textMuted, fontSize: fontSizes.base, ...fontWeight('400') },
  dropdownList: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  dropdownItemText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('400') },
  slider: { marginBottom: spacing.sm, height: 40 },
  effortLabel: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('500'), textAlign: 'center', marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
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
