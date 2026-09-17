import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import type { Workout } from '@/domain/entities';
import {
  submitPostWorkoutCheckin,
  type PostWorkoutFeeling,
} from '@/services/workout/submit-post-workout-checkin.service';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';

const FEELINGS: Array<{ value: PostWorkoutFeeling; label: string }> = [
  { value: 'muito_facil', label: 'Muito fácil' },
  { value: 'facil', label: 'Fácil' },
  { value: 'ideal', label: 'Ideal' },
  { value: 'dificil', label: 'Difícil' },
  { value: 'muito_dificil', label: 'Muito difícil' },
];

interface Props {
  visible: boolean;
  workout: Workout | null;
  onClose: () => void;
  onCompleted: () => void;
}

/** Mesmo padrão de overlay do RunEvo, focado no feedback da corrida sincronizada. */
export function PostWorkoutCheckinModal({
  visible,
  workout,
  onClose,
  onCompleted,
}: Props): JSX.Element | null {
  const [effort, setEffort] = useState(5);
  const [feeling, setFeeling] = useState<PostWorkoutFeeling>('ideal');
  const [pain, setPain] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setEffort(5);
    setFeeling('ideal');
    setPain(null);
    setNotes('');
    setError(null);
  }, [visible, workout?.id]);

  if (!workout) return null;

  const complete = async (): Promise<void> => {
    if (pain === null) {
      setError('Informe se sentiu dor ou incômodo.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitPostWorkoutCheckin({
      workoutId: workout.id,
      effort,
      feeling,
      pain,
      notes,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onCompleted();
  };

  const distance = workout.completed_km ?? workout.planned_km ?? 0;
  const provider = 'Strava';
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.heading}>
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark" size={22} color={colors.bg} />
              </View>
              <Text style={styles.title}>Treino concluído</Text>
              <Text style={styles.description}>
                Sua corrida foi sincronizada. Como você se sentiu?
              </Text>
            </View>

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{workout.title ?? 'Corrida'}</Text>
              <Text style={styles.summaryMeta}>
                {distance.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km • Sincronizado
                via {provider}
              </Text>
            </View>

            <Text style={styles.label}>Sensação do treino</Text>
            <View style={styles.feelings}>
              {FEELINGS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setFeeling(option.value)}
                  style={[styles.feeling, feeling === option.value && styles.feelingActive]}
                >
                  <Text
                    style={[
                      styles.feelingText,
                      feeling === option.value && styles.feelingTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Esforço percebido</Text>
            <Slider
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={effort}
              onValueChange={(value) => setEffort(Math.round(value))}
              minimumTrackTintColor={colors.neon}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.neon}
              style={styles.slider}
            />
            <Text style={styles.effort}>{effort}/10</Text>

            <Text style={styles.label}>Sentiu dor ou incômodo?</Text>
            <View style={styles.choiceRow}>
              {[true, false].map((value) => (
                <Pressable
                  key={String(value)}
                  onPress={() => setPain(value)}
                  style={[styles.choice, pain === value && styles.choiceActive]}
                >
                  <Text style={[styles.choiceText, pain === value && styles.choiceTextActive]}>
                    {value ? 'Sim' : 'Não'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>
              Observação <Text style={styles.optional}>(opcional)</Text>
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={styles.input}
              multiline
              numberOfLines={3}
              placeholder="Ex.: últimas repetições ficaram pesadas."
              placeholderTextColor={colors.textMuted}
              textAlignVertical="top"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable onPress={onClose} disabled={submitting} style={styles.later}>
                <Text style={styles.laterText}>Fazer depois</Text>
              </Pressable>
              <View style={styles.submit}>
                <NeonButton
                  label="Finalizar check-in"
                  onPress={() => void complete()}
                  loading={submitting}
                />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.66)',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
  heading: { alignItems: 'center' },
  checkIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800') },
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  summary: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  summaryTitle: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
  summaryMeta: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 3 },
  label: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    ...fontWeight('700'),
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  optional: { color: colors.textMuted, ...fontWeight('400') },
  feelings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  feeling: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feelingActive: { borderColor: colors.neon, backgroundColor: colors.neonMuted },
  feelingText: { color: colors.textSecondary, fontSize: 11, ...fontWeight('600') },
  feelingTextActive: { color: colors.neon },
  slider: { height: 32 },
  effort: {
    color: colors.neon,
    fontSize: fontSizes.body,
    ...fontWeight('800'),
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: { borderColor: colors.neon, backgroundColor: colors.neonMuted },
  choiceText: { color: colors.textSecondary, ...fontWeight('700') },
  choiceTextActive: { color: colors.neon },
  input: {
    minHeight: 82,
    color: colors.textPrimary,
    backgroundColor: colors.cardElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: fontSizes.body,
  },
  error: { color: colors.error, fontSize: fontSizes.caption, marginTop: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  later: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  laterText: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('700') },
  submit: { flex: 1 },
});
