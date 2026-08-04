import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { BarChart } from '@/components/stats/BarChart';
import { LockedSection } from '@/components/paywall/LockedSection';
import { useCycleHistory } from '@/hooks/useCycleHistory';
import { useEntitlement } from '@/hooks/useEntitlement';
import {
  buildAdherenceSeries,
  buildEvolutionSynthesis,
  buildPaceSeries,
  buildPeakVolumeSeries,
  buildQualitySeries,
} from '@/services/history/cycle-evolution';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * docs/fase-7-5-brief.md Grupo 4 — gráficos de evolução entre ciclos (Plus).
 * Séries de `cycle-evolution.ts` (puro/testado); esta tela só decide layout,
 * gate e estado de "poucos dados". Reaproveita `BarChart` (Fase 6) — nenhuma
 * lib de gráfico nova.
 */
export default function Evolution(): JSX.Element {
  const { cycles, isLoading } = useCycleHistory();
  const { isPlus } = useEntitlement();

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>Carregando ciclos...</Text>
      </View>
    );
  }

  if (cycles.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.insufficientCard}>
          <Text style={styles.insufficientTitle}>Nenhum ciclo concluído ainda</Text>
          <Text style={styles.insufficientMessage}>
            Complete seu primeiro ciclo para começar a ver sua evolução aqui.
          </Text>
        </View>
      </View>
    );
  }

  const paceSeries = buildPaceSeries(cycles);
  const peakVolumeSeries = buildPeakVolumeSeries(cycles);
  const adherenceSeries = buildAdherenceSeries(cycles);
  const qualitySeries = buildQualitySeries(cycles);
  const synthesis = buildEvolutionSynthesis(cycles);

  const content = (
    <>
      {cycles.length < 2 ? (
        <View style={styles.insufficientCard}>
          <Text style={styles.insufficientTitle}>Só 1 ciclo por enquanto</Text>
          <Text style={styles.insufficientMessage}>Complete mais um ciclo para ver sua evolução.</Text>
        </View>
      ) : synthesis ? (
        <View style={styles.synthesisCard}>
          <Text style={styles.synthesisText}>{synthesis}</Text>
        </View>
      ) : null}

      {paceSeries.length > 0 ? (
        <Card title="Pace-alvo (min/km)">
          <BarChart data={paceSeries} unit=" min/km" />
        </Card>
      ) : null}

      {peakVolumeSeries.length > 0 ? (
        <Card title="Volume de pico">
          <BarChart data={peakVolumeSeries} unit="km" />
        </Card>
      ) : null}

      {adherenceSeries.length > 0 ? (
        <Card title="Aderência média">
          <BarChart data={adherenceSeries} unit="%" />
        </Card>
      ) : null}

      {qualitySeries.length > 0 ? (
        <Card title="Quality Score">
          <BarChart data={qualitySeries} unit="/10" />
        </Card>
      ) : null}
    </>
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isPlus ? (
          content
        ) : (
          <LockedSection
            title="Veja sua evolução completa entre ciclos"
            ctaLabel="Assinar RunEvo+"
            onPressCta={() => router.push({ pathname: '/runevo-plus', params: { reason: 'history' } })}
          >
            {content}
          </LockedSection>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  muted: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xl, textAlign: 'center' },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  insufficientCard: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  insufficientTitle: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800') },
  insufficientMessage: { color: colors.textSecondary, fontSize: fontSizes.body },
  synthesisCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.neon,
    backgroundColor: colors.cardElevated,
  },
  synthesisText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
});
