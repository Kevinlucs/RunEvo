import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { AchievementBadge } from '@/components/gamification';
import { useAchievements } from '@/hooks/useAchievements';
import { ACHIEVEMENT_CATEGORIES } from '@/services/gamification/constants';
import { colors, spacing, fontSizes, fontWeight, radii } from '@/theme';

/**
 * Tela de Conquistas — cada categoria tem seu card (fundo elevado + borda),
 * com título + descrição acima dos badges em grid centralizado.
 * Espelha o visual do card único de Recordes Pessoais.
 */
export default function AchievementsScreen(): JSX.Element {
  const { achievements, isLoading } = useAchievements();

  const achievementsByCategory = ACHIEVEMENT_CATEGORIES.map((category) => ({
    category,
    items: achievements.filter((a) => a.categoryKey === category.key),
  }));

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <Screen>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho centralizado */}
        <Text style={styles.title}>Conquistas</Text>
        <Text style={styles.subtitle}>
          {isLoading ? 'Carregando...' : `${unlockedCount} de ${achievements.length} desbloqueadas`}
        </Text>

        {achievementsByCategory.map(({ category, items }) => (
          <View key={category.key} style={styles.categoryCard}>
            {/* Título + descrição da categoria dentro do card */}
            <Text style={[styles.categoryName, { color: category.color }]}>
              {category.name}
            </Text>
            <Text style={styles.categoryDescription}>{category.description}</Text>

            {/* Grid de badges centralizado */}
            <View style={styles.grid}>
              {items.map((achievement) => (
                <View key={achievement.key} style={styles.gridItem}>
                  <AchievementBadge
                    name={achievement.name}
                    color={category.color}
                    categoryKey={achievement.categoryKey}
                    unlocked={achievement.unlocked}
                    unlockedAt={achievement.unlockedAt}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },

  /* Cabeçalho */
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    ...fontWeight('800'),
    marginTop: spacing.xs,
    marginBottom: 2,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },

  /* Card por categoria — igual ao card de Recordes */
  categoryCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  categoryName: {
    fontSize: fontSizes.lg,
    ...fontWeight('700'),
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  categoryDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  /* Grid de badges */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  gridItem: {
    width: 88,
    alignItems: 'center',
  },
});
