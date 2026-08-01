import type { PropsWithChildren } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

interface Props {
  title: string;
  ctaLabel?: string;
  onPressCta: () => void;
}

/**
 * docs/fase-6-brief.md §34 — conteúdo Plus visível porém escurecido, com
 * **um único** CTA para o grupo inteiro (nunca um botão por card — era
 * problema explícito no legado). Envolve quantos cards/gráficos forem
 * passados como `children`; o overlay deixa o conteúdo por trás legível o
 * bastante para dar vontade de assinar, mas não interativo (`pointerEvents`).
 */
export function LockedSection({ title, ctaLabel = 'Desbloquear com RunEvo+', onPressCta, children }: PropsWithChildren<Props>): JSX.Element {
  return (
    <View style={styles.wrapper}>
      <View pointerEvents="none" style={styles.dimmed}>
        {children}
      </View>
      <View style={styles.overlay}>
        <Ionicons name="lock-closed" size={22} color={colors.neon} />
        <Text style={styles.title}>{title}</Text>
        <NeonButton label={ctaLabel} onPress={onPressCta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', marginBottom: spacing.lg },
  dimmed: { opacity: 0.35 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
  },
  title: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700'), textAlign: 'center' },
});
