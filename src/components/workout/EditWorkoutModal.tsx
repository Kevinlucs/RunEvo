import { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui/TextField';
import { DateField } from '@/components/forms/DateField';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { Workout } from '@/domain/entities';

export interface EditWorkoutFormInput {
  title: string;
  description: string;
  plannedKm: number;
  plannedPace: string;
  workoutDate: string | null;
}

interface Props {
  visible: boolean;
  workout: Workout;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (input: EditWorkoutFormInput) => void;
}

/** docs/fase-5-brief.md Grupo 4 (§22) — editar título/descrição/km/pace/data. Nunca o treino da prova. */
export function EditWorkoutModal({ visible, workout, submitting, onCancel, onConfirm }: Props): JSX.Element {
  const [title, setTitle] = useState(workout.title ?? '');
  const [description, setDescription] = useState(workout.description ?? '');
  const [km, setKm] = useState(String(workout.planned_km ?? ''));
  const [pace, setPace] = useState(workout.planned_pace ?? '');
  const [date, setDate] = useState(workout.workout_date ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(workout.title ?? '');
    setDescription(workout.description ?? '');
    setKm(String(workout.planned_km ?? ''));
    setPace(workout.planned_pace ?? '');
    setDate(workout.workout_date ?? '');
    setError(null);
  }, [visible, workout]);

  const handleConfirm = (): void => {
    const parsedKm = Number(km.replace(',', '.'));
    if (!title.trim()) {
      setError('Título obrigatório.');
      return;
    }
    if (!Number.isFinite(parsedKm) || parsedKm <= 0) {
      setError('Km deve ser um número maior que zero.');
      return;
    }
    setError(null);
    onConfirm({
      title: title.trim(),
      description: description.trim(),
      plannedKm: parsedKm,
      plannedPace: pace.trim() || '-',
      workoutDate: date || null,
    });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.badge}>
            <Ionicons name="create" size={26} color={colors.bg} />
          </View>
          <Text style={styles.title}>Editar treino</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <TextField label="Título" value={title} onChangeText={setTitle} />
            <TextField label="Descrição" value={description} onChangeText={setDescription} multiline />
            <TextField label="Km planejado" value={km} onChangeText={setKm} keyboardType="decimal-pad" />
            <TextField label="Pace planejado" value={pace} onChangeText={setPace} placeholder="Ex.: 6:00/km" />
            <DateField label="Data" value={date} onChange={setDate} />
          </ScrollView>

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
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.xl },
  sheet: {
    width: '100%',
    maxHeight: '85%',
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
  title: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.lg },
  scroll: { flexGrow: 0 },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});
