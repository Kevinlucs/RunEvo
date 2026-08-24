import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
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
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          >
            <Text style={styles.title}>Adicionar treino — Semana {weekNumber}</Text>

            <Text style={styles.label}>Título</Text>
            <TextInput
              style={[styles.input, error && !title.trim() ? styles.inputError : null]}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex.: Rodagem extra"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Dia da semana</Text>
            <TextInput
              style={[styles.input, error && !dayLabel.trim() ? styles.inputError : null]}
              value={dayLabel}
              onChangeText={setDayLabel}
              placeholder="Ex.: Quarta"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Tipo</Text>
            <TextInput
              style={styles.input}
              value={dayType}
              onChangeText={setDayType}
              placeholder="Ex.: Base, Longão, Qualidade"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Km planejado</Text>
            <TextInput
              style={[styles.input, error && !(Number(km.replace(',', '.')) > 0) ? styles.inputError : null]}
              value={km}
              onChangeText={setKm}
              keyboardType="decimal-pad"
              placeholder="Ex.: 10"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Pace planejado</Text>
            <TextInput
              style={styles.input}
              value={pace}
              onChangeText={setPace}
              placeholder="Ex.: 6:00/km"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Data (opcional)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholder="Detalhes do treino..."
              placeholderTextColor={colors.textMuted}
              textAlignVertical="top"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={submitting} accessibilityRole="button">
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <NeonButton label="Adicionar" onPress={handleConfirm} loading={submitting} />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    maxHeight: '91%',
  },
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
    marginBottom: spacing.lg
  },
  inputError: { borderColor: colors.error },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { flex: 1, height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
});