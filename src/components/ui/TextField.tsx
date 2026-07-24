import { View, Text, TextInput, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import { colors, radii, spacing, fontSizes, MIN_TOUCH_TARGET } from '@/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences';
  error?: string;
  multiline?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  error,
  multiline = false,
}: Props): JSX.Element {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: fontSizes.body, marginBottom: spacing.sm },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    fontSize: fontSizes.base,
  },
  inputMultiline: { minHeight: MIN_TOUCH_TARGET * 2, paddingVertical: spacing.md },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: fontSizes.caption, marginTop: spacing.xs },
});
