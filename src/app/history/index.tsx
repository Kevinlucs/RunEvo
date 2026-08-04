import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCycleHistory } from '@/hooks/useCycleHistory';
import { formatCycleDate, formatKm, formatPercent, formatRaceCompleted } from '@/services/history/cycle-format';
import type { CycleSummary } from '@/services/history/cycle-summary';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * docs/fase-7-5-brief.md Grupo 2 (§34 acesso) — a "estante de troféus":
 * lista dos ciclos arquivados do próprio atleta, gratuita para todos. Tocar
 * num card abre o resumo read-only (`[planId].tsx`); "Comparar"/"Ver
 * evolução" levam às rotas Plus (Grupo 3/4), que decidem sozinhas o gate —
 * esta tela não decide Free/Plus.
 */
export default function HistoryList(): JSX.Element {
  const { cycles, isLoading } = useCycleHistory();

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>Carregando histórico...</Text>
      </View>
    );
  }

  if (cycles.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Seu histórico começa aqui"
          message="Seu primeiro ciclo está em andamento. Quando você concluir uma prova e começar outra, seus ciclos aparecerão aqui."
          ctaLabel="Ver minha planilha atual"
          onPressCta={() => router.push('/(tabs)/plan')}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={cycles}
        keyExtractor={(item) => item.planId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.actions}>
            <ActionRow icon="git-compare-outline" label="Comparar ciclos" onPress={() => router.push('/history/compare')} />
            <ActionRow icon="trending-up-outline" label="Ver evolução" onPress={() => router.push('/history/evolution')} />
          </View>
        }
        renderItem={({ item }) => <CycleCard cycle={item} onPress={() => router.push(`/history/${item.planId}`)} />}
      />
    </View>
  );
}

function ActionRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }): JSX.Element {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.actionRow}>
      <View style={styles.actionLeft}>
        <Ionicons name={icon} size={20} color={colors.neon} />
        <Text style={styles.actionLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function CycleCard({ cycle, onPress }: { cycle: CycleSummary; onPress: () => void }): JSX.Element {
  const completed = cycle.raceCompleted;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.raceName} numberOfLines={1}>
          {cycle.raceName ?? 'Ciclo sem nome'}
        </Text>
        <View style={[styles.badge, completed === true && styles.badgeCompleted]}>
          <Text style={[styles.badgeText, completed === true && styles.badgeTextCompleted]}>{formatRaceCompleted(cycle)}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {formatCycleDate(cycle.raceDate)} · {formatKm(cycle.raceDistanceKm)} · {cycle.totalWeeks ?? '-'} semanas
      </Text>
      <Text style={styles.adherence}>Aderência: {formatPercent(cycle.adherence.completionRate)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  muted: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xl, textAlign: 'center' },
  listContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  actions: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionLabel: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('600') },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  raceName: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700'), flexShrink: 1 },
  meta: { color: colors.textSecondary, fontSize: fontSizes.caption },
  adherence: { color: colors.neon, fontSize: fontSizes.caption, ...fontWeight('700') },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeCompleted: { borderColor: colors.neon },
  badgeText: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('700') },
  badgeTextCompleted: { color: colors.neon },
});
