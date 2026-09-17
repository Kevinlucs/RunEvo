import { View, Text, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { colors, spacing, fontWeight, fontSizes } from '@/theme';
import { formatShortDate } from '@/utils/time';

/**
 * Mapa de assets de conquista por categoria.
 * Ordem: workouts-completed → Conquista-1, total-distance → Conquista-2,
 *        max-distance → Conquista-3, plans-completed → Conquista-4.
 */
const CATEGORY_IMAGES: Record<string, ImageSourcePropType> = {
  'workouts-completed': require('../../../assets/conquistas/Conquista-1.png'),
  'total-distance': require('../../../assets/conquistas/Conquista-2.png'),
  'max-distance': require('../../../assets/conquistas/Conquista-3.png'),
  'plans-completed': require('../../../assets/conquistas/Conquista-4.png'),
};

interface AchievementBadgeProps {
  /** Nome da conquista (ex.: "1ª corrida", "100 km") */
  name: string;
  /** Se desbloqueada ou não (altera opacidade) */
  unlocked: boolean;
  /** Chave da categoria — usada para selecionar a imagem correta */
  categoryKey: string;
  /** ISO date (YYYY-MM-DD) em que foi desbloqueada. Null se ainda bloqueada. */
  unlockedAt?: string | null;
  /** Cor de destaque da categoria (usada no glow quando desbloqueada) */
  color: string;
}

/**
 * Badge de conquista — só a imagem PNG circular, sem círculo de fundo.
 *
 * - Desbloqueada: imagem em opacidade plena + glow sutil na cor da categoria + data
 * - Bloqueada: imagem opaca (0.30), sem glow
 */
export function AchievementBadge({
  name,
  unlocked,
  categoryKey,
  unlockedAt,
  color,
}: AchievementBadgeProps): JSX.Element {
  const source = CATEGORY_IMAGES[categoryKey];
  const opacity = unlocked ? 1 : 0.30;
  const dateLabel = unlockedAt ? formatShortDate(unlockedAt) : '-';

  return (
    <View style={styles.container}>
      {/* Wrapper só para o glow — sem círculo visível */}
      <View
        style={[
          styles.imageWrapper,
          unlocked && {
            shadowColor: color,
            shadowOpacity: 0.6,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
            elevation: 10,
          },
        ]}
      >
        <Image
          source={source}
          style={[styles.image, { opacity }]}
          resizeMode="contain"
        />
      </View>

      {/* Nome da conquista */}
      <Text style={[styles.label, { opacity }]} numberOfLines={2}>
        {name}
      </Text>

      {/* Data de desbloqueio */}
      <Text style={[styles.date, { opacity }]}>{dateLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 88,
  },
  imageWrapper: {
    marginBottom: spacing.sm,
    // Sem background, sem borda — só wrappe para o shadow funcionar no iOS
  },
  image: {
    width: 72,
    height: 72,
  },
  label: {
    color: colors.textPrimary,
    ...fontWeight('600'),
    fontSize: fontSizes.caption,
    textAlign: 'center',
    lineHeight: fontSizes.caption * 1.3,
    marginBottom: 2,
  },
  date: {
    color: colors.textMuted,
    fontSize: 11,
    ...fontWeight('400'),
    textAlign: 'center',
  },
});
