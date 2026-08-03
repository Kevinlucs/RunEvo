import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/stats/StatCard';
import { BarChart } from '@/components/stats/BarChart';
import { LockedSection } from '@/components/paywall/LockedSection';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useAthleteStats } from '@/hooks/useAthleteStats';
import { useEntitlement } from '@/hooks/useEntitlement';
import { classifyImc } from '@/services/stats/stats.service';
import { PLUS_FEATURES } from '@/services/subscription/plus-features';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * docs/fase-6-brief.md Grupo 2 (§31, mockup 13). §31 pede "sem vão preto
 * abaixo do header" — por isso o header vive dentro do ScrollView, igual à
 * Home (docs/fase-4-brief.md §27), nunca numa área fixa separada do conteúdo.
 */
export default function Stats(): JSX.Element {
  const { plan, isLoading: planLoading } = useActivePlan();
  const { stats, isLoading: statsLoading } = useAthleteStats();
  const { isPlus } = useEntitlement();

  if (!planLoading && !plan) {
    return (
      <Screen>
        <AppHeader />
        <EmptyState
          title="Nada para mostrar ainda"
          message="Suas estatísticas aparecem aqui assim que você tiver uma planilha ativa."
          ctaLabel="Criar minha planilha"
          onPressCta={() => router.push('/(tabs)/ai-evo')}
        />
      </Screen>
    );
  }

  if (statsLoading || !stats) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <AppHeader />
          <Text style={styles.h1}>Estatísticas</Text>
        </ScrollView>
      </Screen>
    );
  }

  const imcLabel = classifyImc(stats.imc);
  const plannedVsRealized = stats.weeklyStats.map((w) => ({
    label: w.label,
    value: w.completedKm,
    secondaryValue: w.plannedKm,
  }));
  const weeklyVolume = stats.weeklyStats.map((w) => ({ label: w.label, value: w.completedKm }));
  const adherence = stats.weeklyStats.map((w) => ({ label: w.label, value: Math.round(w.completionRate * 100) }));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <AppHeader />
        <Text style={styles.h1}>Estatísticas</Text>

        <View style={styles.topCard}>
          <StatCard large icon="speedometer-outline" value={`${stats.totalKm} km`} label="Distância total" />
        </View>

        <View style={styles.grid}>
          <StatCard icon="checkmark-circle-outline" value={`${stats.completedWorkouts}`} label="Concluídos" />
          <StatCard icon="clipboard-outline" value={`${stats.remainingWorkouts}`} label="Restantes" />
        </View>
        <View style={styles.grid}>
          <StatCard icon="flame-outline" value={`${stats.weeksStreak}`} label="Semanas seguidas" />
          <StatCard
            icon="scale-outline"
            value={stats.imc ? stats.imc.toFixed(1) : '-'}
            label={imcLabel}
            labelColor={colors.neon}
          />
        </View>

        <Card title="Planejado × Realizado">
          <BarChart data={plannedVsRealized} unit="km" primaryLabel="Realizado" secondaryLabel="Planejado" />
        </Card>

        <Card title="Volume semanal">
          <BarChart data={weeklyVolume} unit="km" />
        </Card>

        <Card title="Aderência">
          <BarChart data={adherence} unit="%" />
        </Card>

        <Text style={styles.sectionLabel}>Recursos RunEvo+</Text>
        {isPlus ? (
          <Card title="Evolução entre ciclos">
            <Text style={styles.plusNote}>
              Compare esta planilha com ciclos anteriores assim que concluir mais de uma prova.
            </Text>
          </Card>
        ) : (
          <LockedSection
            title="Desbloqueie a evolução completa"
            ctaLabel="Assinar RunEvo+"
            onPressCta={() => router.push({ pathname: '/runevo-plus', params: { reason: 'history' } })}
          >
            <Card title="Evolução entre ciclos">
              {PLUS_FEATURES.map((f) => (
                <View key={f.label} style={styles.featureRow}>
                  <Ionicons name={f.icon} size={18} color={colors.textSecondary} />
                  <Text style={styles.featureText}>{f.label}</Text>
                </View>
              ))}
            </Card>
          </LockedSection>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xxxl },
  h1: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), marginTop: spacing.sm, marginBottom: spacing.lg },
  topCard: { marginBottom: spacing.md },
  grid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    ...fontWeight('800'),
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  plusNote: { color: colors.textSecondary, fontSize: fontSizes.body },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  featureText: { color: colors.textSecondary, fontSize: fontSizes.body },
});
