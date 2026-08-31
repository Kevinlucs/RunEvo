import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSizes, fontWeight, radii } from '@/theme';

interface Props {
  label: string;
  tone: 'neon' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md';
  /** 'pill' — cápsula larga e baixa com borda, para destaque abaixo de um título. */
  variant?: 'default' | 'pill';
}

const TONE_STYLES: Record<Props['tone'], { bg: string; color: string; border: string }> = {
  neon: { bg: 'rgba(204,255,0,0.12)', color: colors.neon, border: 'rgba(204,255,0,0.5)' },
  error: { bg: 'rgba(255,68,68,0.15)', color: colors.error, border: 'rgba(255,68,68,0.5)' },
  warning: { bg: 'rgba(255,193,7,0.12)', color: '#FFC107', border: 'rgba(255,193,7,0.5)' },
  info: { bg: 'rgba(100,200,255,0.12)', color: '#64C8FF', border: 'rgba(100,200,255,0.5)' },
};

export function Badge({ label, tone, size = 'md', variant = 'default' }: Props): JSX.Element {
  const style = TONE_STYLES[tone];
  const isSm = size === 'sm';
  const isPill = variant === 'pill';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: style.bg },
        isSm && styles.badgeSm,
        isPill && styles.badgePill,
        isPill && { borderColor: style.border },
      ]}
    >
      <Text style={[styles.text, { color: style.color }, isSm && styles.textSm, isPill && styles.textPill]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgePill: {
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderWidth: 1,
  },
  text: {
    fontSize: fontSizes.base,
    ...fontWeight('600'),
  },
  textSm: {
    fontSize: 10,
  },
  textPill: {
    fontSize: 11,
    ...fontWeight('700'),
  },
});
