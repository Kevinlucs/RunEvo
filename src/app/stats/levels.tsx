import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { LevelShield } from '@/components/gamification';
import { useLifetimeStats } from '@/hooks/useLifetimeStats';
import { computeLevel, computeKmToNextLevel } from '@/services/gamification/compute';
import { RUN_LEVELS } from '@/services/gamification/constants';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * Lista dos 7 níveis de corrida (Amarelo → Verde-Limão).
 * Nível atual recebe destaque (borda neon), níveis futuros ficam com opacidade reduzida.
 */
export default function LevelsScreen(): JSX.Element {
  const { stats: lifetimeStats, isLoading } = useLifetimeStats();
  const currentLevel = computeLevel(lifetimeStats.totalKm);
  const kmToNext = computeKmToNextLevel(lifetimeStats.totalKm);
  const currentLevelIndex = RUN_LEVELS.findIndex((l) => l.key === currentLevel.key);

  return (
    <Screen>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Níveis de corrida</Text>
        <Text style={styles.subtitle}>
          {isLoading
            ? 'Carregando...'
            : kmToNext !== null
              ? `Faltam ${kmToNext.toFixed(1)} km para ${RUN_LEVELS[currentLevelIndex + 1]?.name}`
              : 'Você atingiu o nível máximo!'}
        </Text>

        <View style={styles.list}>
          {RUN_LEVELS.map((level, index) => {
            const isCurrent = level.key === currentLevel.key;
            const isUnlocked = index <= currentLevelIndex;
            const opacity = isUnlocked ? 1 : 0.45;
            const rangeLabel =
              level.maxKm !== null
                ? `${level.minKm}–${level.maxKm.toFixed(0)} km`
                : `${level.minKm}+ km`;

            return (
              <View
                key={level.key}
                style={[
                  styles.row,
                  isCurrent && styles.rowCurrent,
                ]}
              >
                <LevelShield level={level} size={64} opacity={opacity} />
                <View style={styles.rowContent}>
                  <Text style={[styles.levelName, { opacity }]}>{level.name}</Text>
                  <Text style={[styles.levelRange, { opacity }]}>{rangeLabel}</Text>
                  {isCurrent && <Text style={styles.levelBadge}>VOCÊ ESTÁ AQUI</Text>}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xxxl },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    ...fontWeight('800'),
    marginTop: spacing.xs,
    marginBottom: 2,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    marginBottom: spacing.lg,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  list: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowCurrent: {
    borderColor: colors.neon,
    borderWidth: 2,
  },
  rowContent: {
    flex: 1,
  },
  levelName: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    ...fontWeight('700'),
    marginBottom: spacing.xs,
  },
  levelRange: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
  },
  levelBadge: {
    color: colors.neon,
    fontSize: fontSizes.caption,
    ...fontWeight('700'),
    marginTop: spacing.xs,
    letterSpacing: 0.5,
  },
});