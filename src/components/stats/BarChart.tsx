import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

export interface BarChartPoint {
  label: string;
  value: number;
  /** Segunda barra ao lado (ex.: planejado × realizado). */
  secondaryValue?: number;
}

interface Props {
  data: BarChartPoint[];
  /** Sufixo no rótulo de topo de cada barra (ex.: "km", "%"). */
  unit?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}

const BAR_MAX_HEIGHT = 96;

/**
 * docs/fase-6-brief.md Grupo 2 (§31) — gráfico de barras próprio (Views puras,
 * sem lib de gráfico: "componentes próprios" é uma das opções que o brief já
 * autoriza, e evita adicionar dependência pesada para barras simples).
 */
export function BarChart({ data, unit = '', primaryLabel, secondaryLabel }: Props): JSX.Element {
  const hasSecondary = data.some((d) => d.secondaryValue !== undefined);
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondaryValue ?? 0)));

  return (
    <View>
      {hasSecondary && (primaryLabel ?? secondaryLabel) ? (
        <View style={styles.legend}>
          {primaryLabel ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.neon }]} />
              <Text style={styles.legendText}>{primaryLabel}</Text>
            </View>
          ) : null}
          {secondaryLabel ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.cardElevated }]} />
              <Text style={styles.legendText}>{secondaryLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
        {data.map((point) => (
          <View key={point.label} style={styles.column}>
            <View style={styles.bars}>
              {hasSecondary ? (
                <View
                  style={[
                    styles.bar,
                    styles.barSecondary,
                    { height: Math.max(2, (Math.round((point.secondaryValue ?? 0) * 10) / 10 / max) * BAR_MAX_HEIGHT) },
                  ]}
                />
              ) : null}
              <View style={[styles.bar, { height: Math.max(2, (point.value / max) * BAR_MAX_HEIGHT) }]} />
            </View>
            <Text style={styles.value}>
              {point.value}
              {unit}
            </Text>
            <Text style={styles.label}>{point.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: radii.pill },
  legendText: { color: colors.textSecondary, fontSize: fontSizes.caption },
  track: { alignItems: 'flex-end', gap: spacing.md, paddingBottom: spacing.xs },
  column: { alignItems: 'center', width: 44 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_MAX_HEIGHT },
  bar: { width: 14, borderRadius: radii.sm, backgroundColor: colors.neon },
  barSecondary: { backgroundColor: colors.cardElevated },
  value: { color: colors.textPrimary, fontSize: fontSizes.caption, ...fontWeight('700'), marginTop: spacing.xs },
  label: { color: colors.textMuted, fontSize: fontSizes.caption, marginTop: 2 },
});
