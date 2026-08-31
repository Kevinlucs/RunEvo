import { useState } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

interface Props {
  label: string;
  /** 'YYYY-MM-DD' — mesmo formato que `parseLocalDate` (motor) espera. */
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  error?: string;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(value: string): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
}

function formatBR(value: string): string {
  if (!value) return 'dd/mm/aaaa';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

/** Data via picker nativo (docs/fase-3-brief.md §Grupo 3) — nunca input de texto livre. */
export function DateField({ label, value, onChange, minimumDate, error }: Props): JSX.Element {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date): void => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) onChange(toISODate(selectedDate));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={styles.calendarBtn}>
          <Calendar size={20} color={colors.neon} />
        </Pressable>
        <Pressable onPress={() => setOpen(true)} style={styles.valueArea}>
          <Text style={value ? styles.value : styles.placeholder}>
            {formatBR(value)}
          </Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {open ? (
        <DateTimePicker
          value={parseISODate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    color: colors.textPrimary,
    fontSize: 16,
    ...fontWeight('700'),
    marginBottom: spacing.sm,
  },
  field: {
    height: 52,
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  fieldError: { borderColor: colors.error },
  calendarBtn: {
    marginRight: spacing.md,
  },
  valueArea: {
    flex: 1,
    justifyContent: 'center',
  },
  value: { color: colors.textPrimary, fontSize: fontSizes.base },
  placeholder: { color: colors.textMuted, fontSize: fontSizes.base },
  error: { color: colors.error, fontSize: fontSizes.caption, marginTop: spacing.xs },
});
