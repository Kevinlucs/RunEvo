import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';
import { NeonButton } from '@/components/ui/NeonButton';
import { colors, spacing, fontWeight } from '@/theme';

interface PremiumGateProps {
  locked: boolean;
  title?: string;
  description?: string;
  cta?: string;
  onUnlock: () => void;
  children: React.ReactNode;
}

/**
 * Overlay premium reutilizável. Envolve o conteúdo inteiro (children).
 * locked=false: renderiza children normalmente.
 * locked=true: renderiza children com pointerEvents none + gradiente preto
 *   progressivo cobrindo da metade inferior + Lock CTA centralizado.
 *   O topo do conteúdo fica visível, a parte de baixo escurece.
 */
export function PremiumGate({
  locked,
  title = 'Recurso RunEvo+',
  description = 'Desbloqueie este recurso no plano Premium.',
  cta = 'Conhecer RunEvo+',
  onUnlock,
  children,
}: PremiumGateProps): JSX.Element {
  const fadeAnim = useRef(new Animated.Value(locked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: locked ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [locked, fadeAnim]);

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Conteúdo completo — visível mas não interativo */}
      <View pointerEvents="none">
        {children}
      </View>

      {/* Overlay: fundo escuro + CTA centralizado */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={styles.ctaArea} onPress={onUnlock} accessibilityRole="button">
          <View style={styles.lockCircle}>
            <Lock size={32} color={colors.neon} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.ctaButton}>
            <NeonButton label={cta} onPress={onUnlock} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', borderRadius: 20, overflow: 'hidden' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: spacing.xl,
  },
  ctaArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(204,255,0,0.4)',
    backgroundColor: 'rgba(204,255,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: 18, ...fontWeight('800'), marginBottom: spacing.xs, textAlign: 'center' },
  description: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  ctaButton: { width: '100%', maxWidth: 220 },
});
