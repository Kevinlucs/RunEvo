import { useEffect, useState, useMemo } from 'react';
import { Modal, View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { TrainingZones } from '@/domain/motor-evo/types';

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
  phase: string;
  planStartDate: string;
  zones: TrainingZones | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (input: AddWorkoutFormInput) => void;
}

const PHASE_ZONE: Record<string, keyof Pick<TrainingZones, 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'>> = {
  Base: 'Z2',
  Resistência: 'Z3',
  Resistencia: 'Z3',
  Pico: 'Z4',
  Polimento: 'Z2',
};

function getWeekDays(planStartDate: string, weekNumber: number): { label: string; value: string; dayName: string }[] {
  try {
    const start = new Date(planStartDate);
    const mondayOffset = (weekNumber - 1) * 7;
    const monday = new Date(start);
    monday.setDate(start.getDate() + mondayOffset);

    const days: { label: string; value: string; dayName: string }[] = [];
    const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const dayName = dayNames[i] ?? '';
      days.push({
        label: `${dayName}, ${dd}/${mm}`,
        value: `${yyyy}-${mm}-${dd}`,
        dayName,
      });
    }
    return days;
  } catch {
    return [];
  }
}

function suggestedPaceForPhase(phase: string, zones: TrainingZones | null): string {
  if (!zones) return '-';
  const zoneKey = PHASE_ZONE[phase] ?? 'Z2';
  return zones[zoneKey]?.from ?? '-';
}

/** docs/fase-5-brief.md Grupo 4 (§22) — adicionar treino à semana. */
export function AddWorkoutModal({
  visible,
  weekNumber,
  phase,
  planStartDate,
  zones,
  submitting,
  onCancel,
  onConfirm,
}: Props): JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [km, setKm] = useState('');
  const [pace, setPace] = useState('');
  const [date, setDate] = useState('');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDays = useMemo(() => getWeekDays(planStartDate, weekNumber), [planStartDate, weekNumber]);
  const isDateAvailable = weekDays.length > 0;

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDescription('');
    setKm('');
    setPace(suggestedPaceForPhase(phase, zones));
    setDate('');
    setDateDropdownOpen(false);
    setError(null);
  }, [visible, phase, zones]);

  const selectedDateDay = weekDays.find((d) => d.value === date);
  const selectedDateLabel = selectedDateDay?.label;
  const selectedDayName = selectedDateDay?.dayName;

  const handleConfirm = (): void => {
    const parsedKm = Number(km.replace(',', '.'));
    if (!title.trim()) {
      setError('Título obrigatório.');
      return;
    }
    if (!date) {
      setError('Selecione a data do treino.');
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
      dayType: phase,
      dayLabel: selectedDayName || 'Segunda',
      plannedKm: parsedKm,
      plannedPace: pace.trim() || '-',
      workoutDate: date,
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

            <Text style={styles.label}>Km planejado</Text>
            <TextInput
              style={[styles.input, error && !(Number(km.replace(',', '.')) > 0) ? styles.inputError : null]}
              value={km}
              onChangeText={setKm}
              keyboardType="decimal-pad"
              placeholder="Ex.: 10"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Data</Text>
            {isDateAvailable ? (
              <>
                <Pressable
                  style={styles.dropdown}
                  onPress={() => setDateDropdownOpen(!dateDropdownOpen)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.dropdownText, !date && styles.dropdownPlaceholder]}>
                    {selectedDateLabel || 'Selecione uma data'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                </Pressable>
                {dateDropdownOpen ? (
                  <View style={styles.dropdownList}>
                    {weekDays.map((day) => (
                      <Pressable
                        key={day.value}
                        onPress={() => {
                          setDate(day.value);
                          setDateDropdownOpen(false);
                        }}
                        style={styles.dropdownItem}
                      >
                        <Text style={[styles.dropdownItemText, date === day.value && styles.dropdownItemActive]}>
                          {day.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={[styles.dropdown, styles.dropdownDisabled]}>
                <Text style={styles.dropdownPlaceholder}>Data indisponível</Text>
              </View>
            )}

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholder={"1km em Z1\n3km em Z2\n1km em Z1"}
              placeholderTextColor={colors.textMuted}
              textAlignVertical="center"
              textAlign="center"
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
    marginBottom: spacing.lg,
  },
  inputError: { borderColor: colors.error },
  dropdown: {
    backgroundColor: colors.cardElevated,
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
  dropdownItemActive: { color: colors.neon, ...fontWeight('700') },
  textArea: { minHeight: 80, textAlignVertical: 'center', textAlign: 'center' },
  error: { color: colors.error, fontSize: fontSizes.body, marginBottom: spacing.md, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { flex: 1, height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
});
