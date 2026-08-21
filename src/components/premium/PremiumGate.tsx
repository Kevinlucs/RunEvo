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
 * Overlay premium reutilizável. Envolve APENAS o conteúdo bloqueado (children).
 * O conteúdo Free fica FORA deste componente — renderizado normalmente acima.
 *
 * locked=false: renderiza children normalmente.
 * locked=true: mostra children com opacity baixa + gradiente + lock CTA sobre.
 *   Um "hint" é renderizado ACIMA dos children (no fluxo, não absolute).
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
    <View style={styles.wrapper}>
      {/* Hint inline — no fluxo, acima do conteúdo bloqueado */}
      <View style={styles.hintRow}>
        <Lock size={14} color={colors.neon} />
        <Text style={styles.hintText}>
          Recurso disponível no plano <Text style={styles.hintNeon}>Premium</Text>
        </Text>
      </View>

      {/* Conteúdo bloqueado com overlay */}
      <View style={styles.lockedContainer}>
        {/* Children com opacity baixa, sem interação */}
        <View style={styles.lockedContent} pointerEvents="none">
          {children}
        </View>

        {/* Gradiente escuro sobre o conteúdo bloqueado */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* CTA centralizado sobre o gradiente */}
        <Pressable style={styles.ctaOverlay} onPress={onUnlock} accessibilityRole="button">
          <View style={styles.lockCircle}>
            <Lock size={32} color={colors.neon} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.ctaButton}>
            <NeonButton label={cta} onPress={onUnlock} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: spacing.md },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  hintText: { color: colors.textSecondary, fontSize: 13, ...fontWeight('500') },
  hintNeon: { color: colors.neon, ...fontWeight('700') },
  lockedContainer: {
    position: 'relative',
    minHeight: 200,
    overflow: 'hidden',
    borderRadius: 16,
  },
  lockedContent: { opacity: 0.3 },
  ctaOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 2,
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
