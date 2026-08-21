import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
 * Overlay premium reutilizável — mostra conteúdo parcial com gradiente
 * progressivo + CTA para paywall quando locked=true.
 * Sem expo-blur (performance ruim no Expo Go Android) — simula com gradiente.
 */
export function PremiumGate({
  locked,
  title = 'Recurso Premium',
  description = 'Desbloqueie este recurso no plano Premium.',
  cta = 'Conhecer Premium',
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
      {/* Conteúdo com interação bloqueada */}
      <View pointerEvents="none">
        {children}
      </View>

      {/* Gradiente progressivo sobre o conteúdo */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.2, 0.5, 1]}
          style={styles.gradient}
        />

        {/* CTA centralizado na parte inferior */}
        <Pressable style={styles.ctaContainer} onPress={onUnlock} accessibilityRole="button">
          {/* Sparkles decorativos */}
          <View style={[styles.sparkle, styles.sparkle1]} />
          <View style={[styles.sparkle, styles.sparkle2]} />
          <View style={[styles.sparkle, styles.sparkle3]} />
          <View style={[styles.sparkle, styles.sparkle4]} />

          {/* Ícone Lock */}
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

      {/* Texto intermediário sobre o conteúdo visível */}
      <Animated.View style={[styles.inlineHint, { opacity: fadeAnim }]} pointerEvents="none">
        <Lock size={14} color={colors.neon} />
        <Text style={styles.inlineHintText}>
          Recurso disponível no plano <Text style={styles.inlineHintNeon}>Premium</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    top: '50%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  ctaContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 1,
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(204,255,0,0.4)',
    backgroundColor: 'rgba(204,255,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  sparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neon,
  },
  sparkle1: { top: 8, right: '30%' },
  sparkle2: { top: 20, left: '25%' },
  sparkle3: { top: 40, right: '20%' },
  sparkle4: { top: 55, left: '35%' },
  title: { color: colors.textPrimary, fontSize: 20, ...fontWeight('800'), marginBottom: spacing.sm, textAlign: 'center' },
  description: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20, paddingHorizontal: spacing.md },
  ctaButton: { width: '100%', maxWidth: 240 },
  inlineHint: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  inlineHintText: { color: colors.textSecondary, fontSize: 13, ...fontWeight('500') },
  inlineHintNeon: { color: colors.neon, ...fontWeight('700') },
});
