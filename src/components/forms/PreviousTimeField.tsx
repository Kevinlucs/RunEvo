import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes, radii, MIN_TOUCH_TARGET, fontWeight } from '@/theme';

interface Props {
  label: string;
  time: string;
  onChangeTime: (value: string) => void;
  no: boolean;
  onChangeNo: (value: boolean) => void;
  checkboxLabel: string;
  error?: string;
}

function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  const groups: string[] = [];
  let rest = digits;
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  groups.unshift(rest);
  return groups.join(':');
}

/**
 * Um bloco por distância (5K/10K/21K/42K) — SEMPRE empilhado, nunca em duas
 * colunas (docs/fase-3-brief.md §Grupo 3, layout mobile crítico). Marcar "não
 * corri" desabilita e limpa o input (`noXk = true`, `timeXk` some do submit).
 */
export function PreviousTimeField({ label, time, onChangeTime, no, onChangeNo, checkboxLabel, error }: Props): JSX.Element {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, no ? styles.inputDisabled : null, error && !no ? styles.inputError : null]}
        value={no ? '' : time}
        onChangeText={(v) => onChangeTime(maskTime(v))}
        placeholder="hh:mm:ss"
        keyboardType="number-pad"
        placeholderTextColor={colors.textMuted}
        editable={!no}
      />
      {error && !no ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: no }}
        onPress={() => {
          const next = !no;
          onChangeNo(next);
          if (next) onChangeTime('');
        }}
        style={styles.checkboxRow}
      >
        <View style={[styles.checkbox, no && styles.checkboxChecked]}>{no ? <Text style={styles.checkmark}>✓</Text> : null}</View>
        <Text style={styles.checkboxLabel}>{checkboxLabel}</Text>
      </Pressable>
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
  input: {
    height: 52,
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    fontSize: fontSizes.base,
    marginBottom: spacing.sm,
  },
  inputDisabled: { opacity: 0.5 },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: fontSizes.caption, marginBottom: spacing.sm },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: { borderColor: colors.neon, backgroundColor: 'rgba(204,255,0,0.08)' },
  checkmark: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('900') },
  checkboxLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
});
