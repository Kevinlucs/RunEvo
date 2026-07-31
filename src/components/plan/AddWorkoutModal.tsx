import { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui/TextField';
import { DateField } from '@/components/forms/DateField';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

export interface AddWorkoutFormInput {
  title: string;
  description: string;
  dayType: string;
  dayLabel: string;
  plannedKm: number;
  plannedPace: string;
  workoutDate: string | null;
}

interface Props {
  visible: boolean;
  weekNumber: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (input: AddWorkoutFormInput) => void;
}

/** docs/fase-5-brief.md Grupo 4 (§22) — adicionar treino à semana. */
export function AddWorkoutModal({ visible, weekNumber, submitting, onCancel, onConfirm }: Props): JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayType, setDayType] = useState('Base');
  const [dayLabel, setDayLabel] = useState('');
  const [km, setKm] = useState('');
  const [pace, setPace] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDescription('');
    setDayType('Base');
    setDayLabel('');
    setKm('');
    setPace('');
    setDate('');
    setError(null);
  }, [visible]);

  const handleConfirm = (): void => {
    const parsedKm = Number(km.replace(',', '.'));
    if (!title.trim()) {
      setError('Título obrigatório.');
      return;
    }
    if (!dayLabel.trim()) {
      setError('Dia da semana obrigatório.');
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
      dayType: dayType.trim() || 'Base',
      dayLabel: dayLabel.trim(),
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
            <Ionicons name="add" size={26} color={colors.bg} />
          </View>
          <Text style={styles.title}>Adicionar treino — Semana {weekNumber}</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <TextField label="Título" value={title} onChangeText={setTitle} placeholder="Ex.: Rodagem extra" />
            <TextField label="Dia da semana" value={dayLabel} onChangeText={setDayLabel} placeholder="Ex.: Quarta" />
            <TextField label="Tipo" value={dayType} onChangeText={setDayType} placeholder="Ex.: Base, Longão, Qualidade" />
            <TextField label="Km planejado" value={km} onChangeText={setKm} keyboardType="decimal-pad" />
            <TextField label="Pace planejado" value={pace} onChangeText={setPace} placeholder="Ex.: 6:00/km" />
            <DateField label="Data (opcional)" value={date} onChange={setDate} />
            <TextField label="Descrição (opcional)" value={description} onChangeText={setDescription} multiline />
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <NeonButton label="Cancelar" variant="secondary" onPress={onCancel} disabled={submitting} />
            </View>
            <View style={styles.actionButton}>
              <NeonButton label="Adicionar" onPress={handleConfirm} loading={submitting} />
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
  title: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.lg },
  scroll: { flexGrow: 0 },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionButton: { flex: 1 },
});
