import React from 'react';
import { Text, StyleSheet, type TextProps } from 'react-native';
import { colors, fontFamily, fontSize } from '@/theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'muted';

interface AppTextProps extends TextProps {
  variant?: Variant;
}

export function AppText({ variant = 'body', style, ...rest }: AppTextProps) {
  return <Text style={[styles.base, styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { color: colors.textPrimary, fontFamily: fontFamily.regular },
  title: { fontFamily: fontFamily.extrabold, fontSize: fontSize['3xl'] },
  heading: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  body: { fontSize: fontSize.base },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.textSecondary },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
});
