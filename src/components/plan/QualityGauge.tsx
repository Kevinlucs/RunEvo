import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

interface QualityGaugeProps {
  score: number; // validation.summary.qualityScore (0–10)
  status: string; // validation.summary.qualityStatus
  riskLevel: string; // validation.summary.riskLevel
}

const GAUGE_WIDTH = 220;
const GAUGE_HEIGHT = 130;
const CENTER_X = GAUGE_WIDTH / 2;
const CENTER_Y = 115;
const RADIUS = 92;
const TICK_COUNT = 14;
const TICK_GAP_DEG = 3;

/** Interpola vermelho → amarelo → verde conforme t (0..1). */
function tickColor(t: number): string {
  if (t < 0.5) return '#FF4444';
  if (t < 0.78) return '#FFC107';
  return colors.neon;
}

/** Ponto na circunferência do arco (ângulo em graus, 180 = esquerda, 0 = direita). */
function polar(angleDeg: number, r: number): { x: number; y: number } {
  const rad = (Math.PI * angleDeg) / 180;
  return {
    x: CENTER_X + r * Math.cos(rad),
    y: CENTER_Y - r * Math.sin(rad),
  };
}

/** Path de um segmento em anel (arco grosso) entre dois ângulos. */
function arcSegmentPath(startDeg: number, endDeg: number, rOuter: number, rInner: number): string {
  const p1 = polar(startDeg, rOuter);
  const p2 = polar(endDeg, rOuter);
  const p3 = polar(endDeg, rInner);
  const p4 = polar(startDeg, rInner);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 0 0 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 0 1 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

const RISK_POSITION: Record<string, number> = {
  baixo: 0.9,
  médio: 0.5,
  medio: 0.5,
  alto: 0.25,
  'muito alto': 0.1,
};

export function QualityGauge({ score, status, riskLevel }: QualityGaugeProps): JSX.Element {
  const clamped = Math.max(0, Math.min(10, score));
  const litCount = Math.round((clamped / 10) * TICK_COUNT);

  // Arco de 180° (esquerda→direita), dividido em TICK_COUNT segmentos.
  const totalSpan = 180;
  const segSpan = totalSpan / TICK_COUNT;
  const rOuter = RADIUS;
  const rInner = RADIUS - 16;

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    // i=0 é o segmento da esquerda (180°); avança em direção a 0°.
    const startDeg = 180 - i * segSpan;
    const endDeg = startDeg - segSpan + TICK_GAP_DEG;
    const t = i / (TICK_COUNT - 1);
    const lit = i < litCount;
    return {
      key: i,
      path: arcSegmentPath(startDeg, endDeg, rOuter, rInner),
      color: lit ? tickColor(t) : '#2A2A2A',
    };
  });

  const riskPos = RISK_POSITION[riskLevel.toLowerCase()] ?? 0.5;

  return (
    <View style={styles.wrap}>
      <View style={styles.gaugeArea}>
        <Svg width={GAUGE_WIDTH} height={GAUGE_HEIGHT}>
          <G>
            {ticks.map((tick) => (
              <Path key={tick.key} d={tick.path} fill={tick.color} />
            ))}
          </G>
        </Svg>
        <View style={styles.centerLabel}>
          <Text style={styles.scoreValue}>{clamped.toFixed(1)}</Text>
          <Text style={styles.scoreMax}>/10</Text>
        </View>
      </View>

      <Text style={styles.statusText}>
        Quality Score <Text style={styles.statusValue}>({status})</Text>
      </Text>

      {/* Barra de risco técnico */}
      <View style={styles.riskHeader}>
        <Text style={styles.riskLabel}>Risco técnico</Text>
        <Text style={styles.riskValue}>{riskLevel}</Text>
      </View>
      <View style={styles.riskBarWrap}>
        <View style={styles.riskBar}>
          <View style={[styles.riskSegment, { backgroundColor: '#FF4444' }]} />
          <View style={[styles.riskSegment, { backgroundColor: '#FFC107' }]} />
          <View style={[styles.riskSegment, { backgroundColor: colors.neon }]} />
        </View>
        <View style={[styles.riskMarker, { left: `${riskPos * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  gaugeArea: { width: GAUGE_WIDTH, height: GAUGE_HEIGHT, alignItems: 'center', justifyContent: 'flex-end' },
  centerLabel: {
    position: 'absolute',
    bottom: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  scoreValue: { color: colors.neon, fontSize: 34, ...fontWeight('800') },
  scoreMax: { color: colors.textSecondary, fontSize: 16, ...fontWeight('700'), marginBottom: 4 },
  statusText: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm, marginBottom: spacing.lg },
  statusValue: { color: colors.neon, ...fontWeight('700') },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  riskLabel: { color: colors.textSecondary, fontSize: fontSizes.body },
  riskValue: { color: colors.neon, fontSize: fontSizes.body, ...fontWeight('700') },
  riskBarWrap: { width: '100%', height: 16, justifyContent: 'center' },
  riskBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  riskSegment: { flex: 1, height: 6 },
  riskMarker: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    top: 2,
    backgroundColor: colors.textPrimary,
    borderWidth: 2,
    borderColor: colors.bg,
    transform: [{ rotate: '45deg' }],
  },
});
