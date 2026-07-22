import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TextField } from '@/components/ui/TextField';
import { colors, spacing, fontSizes, radii, MIN_TOUCH_TARGET } from '@/theme';

interface Props {
  label: string;
  time: string;
  onChangeTime: (value: string) => void;
  no: boolean;
  onChangeNo: (value: boolean) => void;
  checkboxLabel: string;
  error?: string;
}

/**
 * Um bloco por distância (5K/10K/21K/42K) — SEMPRE empilhado, nunca em duas
 * colunas (docs/fase-3-brief.md §Grupo 3, layout mobile crítico). Marcar "não
 * corri" desabilita e limpa o input (`noXk = true`, `timeXk` some do submit).
 */
export function PreviousTimeField({ label, time, onChangeTime, no, onChangeNo, checkboxLabel, error }: Props): JSX.Element {
  return (
    <View style={styles.wrap}>
      <TextField
        label={label}
        value={no ? '' : time}
        onChangeText={onChangeTime}
        placeholder="hh:mm:ss"
        keyboardType="numbers-and-punctuation"
        error={no ? undefined : error}
      />
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
  wrap: { marginBottom: spacing.md },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    marginTop: -spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: { backgroundColor: colors.neon, borderColor: colors.neon },
  checkmark: { color: colors.bg, fontSize: fontSizes.caption, fontWeight: '900' },
  checkboxLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
});
