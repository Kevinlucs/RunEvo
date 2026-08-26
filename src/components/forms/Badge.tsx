import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSizes, fontWeight } from '@/theme';

interface Props {
  label: string;
  tone: 'neon' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md';
}

const TONE_STYLES: Record<Props['tone'], { bg: string; color: string }> = {
  neon: { bg: 'rgba(204,255,0,0.12)', color: colors.neon },
  error: { bg: 'rgba(255,68,68,0.15)', color: colors.error },
  warning: { bg: 'rgba(255,193,7,0.12)', color: '#FFC107' },
  info: { bg: 'rgba(100,200,255,0.12)', color: '#64C8FF' },
};

export function Badge({ label, tone, size = 'md' }: Props): JSX.Element {
  const style = TONE_STYLES[tone];
  const isSm = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: style.bg }, isSm && styles.badgeSm]}>
      <Text style={[styles.text, { color: style.color }, isSm && styles.textSm]}>{label}</Text>
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
  text: {
    fontSize: fontSizes.base,
    ...fontWeight('600'),
  },
  textSm: {
    fontSize: 10,
  },
});
