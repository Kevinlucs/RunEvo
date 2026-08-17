import type { PropsWithChildren } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

interface Props {
  title?: string;
}

/** Card padrão para seções da prévia do plano (§4.2) e telas afins. */
export function Card({ title, children }: PropsWithChildren<Props>): JSX.Element {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: { color: colors.neon, fontSize: fontSizes.lg, ...fontWeight('800'), marginBottom: spacing.md },
});
