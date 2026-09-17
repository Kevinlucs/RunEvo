import { View, Text, StyleSheet } from 'react-native';
import { LevelShield } from './LevelShield';
import { computeKmToNextLevel } from '@/services/gamification/compute';
import type { RunLevel } from '@/services/gamification/constants';
import { colors, spacing, fontWeight, fontSizes } from '@/theme';

interface LevelCardProps {
  /** Nível atual (ex.: { key: 'amarelo', name: 'Amarelo', ... }) */
  level: RunLevel;
  /** Km total lifetime */
  totalKm: number;
  /** Km máximo do nível atual (para renderizar barra) */
  levelMaxKm: number;
}

/**
 * Card de nível — exibe:
 * - Escudo grande do nível atual (à esquerda)
 * - Nome do nível + km total grande (centro)
 * - Barra de progresso (embaixo)
 * - "X km para o nível Próximo" (embaixo da barra)
 *
 * Uso: aba de Estatísticas, tela de Níveis.
 */
export function LevelCard({ level, totalKm, levelMaxKm }: LevelCardProps): JSX.Element {
  const kmToNext = computeKmToNextLevel(totalKm);
  const progressPercent = Math.min(100, (totalKm / levelMaxKm) * 100);
  const styles = createStyles();

  return (
    <View style={styles.container}>
      {/* Escudo grande à esquerda */}
      <View style={styles.shieldContainer}>
        <LevelShield level={level} size={100} opacity={0.9} />
      </View>

      {/* Informações (centro-direita) */}
      <View style={styles.content}>
        <Text style={styles.levelName}>{level.name}</Text>
        <Text style={styles.kmTotal}>{Math.floor(totalKm)} km</Text>
        <Text style={styles.label}>Total de quilômetros</Text>

        {/* Barra de progresso */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: level.color }]} />
        </View>

        {/* km para próximo nível */}
        <Text style={styles.kmToNext}>
          {kmToNext > 0 ? `${Math.ceil(kmToNext)} km para o próximo nível` : 'Máximo atingido!'}
        </Text>
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.cardElevated,
      borderRadius: 12,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.neonMuted,
    },
    shieldContainer: {
      marginRight: spacing.lg,
    },
    content: {
      flex: 1,
    },
    levelName: {
      color: colors.textPrimary,
      ...fontWeight('800'),
      fontSize: fontSizes.lg,
      marginBottom: spacing.xs,
    },
    kmTotal: {
      color: colors.neon,
      ...fontWeight('900'),
      fontSize: fontSizes.title,
      marginBottom: spacing.xs,
      lineHeight: fontSizes.title * 1.1,
    },
    label: {
      color: colors.textSecondary,
      ...fontWeight('400'),
      fontSize: fontSizes.caption,
      marginBottom: spacing.md,
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.bg,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    kmToNext: {
      color: colors.textSecondary,
      ...fontWeight('600'),
      fontSize: fontSizes.body,
    },
  });
}
