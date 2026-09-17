import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { CheckCircle2 } from 'lucide-react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

interface PerformanceCenterProps {
  completedWorkouts: number;
  plannedWorkouts: number;
}

const RING_SIZE = 148;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Painel principal da tela de Estatísticas. Resume a aderência do ciclo
 * corrente sem introduzir métricas ainda indisponíveis no produto, como pace
 * real, duração, frequência cardíaca ou elevação.
 */
export function PerformanceCenter({
  completedWorkouts,
  plannedWorkouts,
}: PerformanceCenterProps): JSX.Element {
  const adherence =
    plannedWorkouts > 0 ? Math.round((completedWorkouts / plannedWorkouts) * 100) : 0;
  const progress = Math.min(100, Math.max(0, adherence));
  const progressOffset = RING_CIRCUMFERENCE * (1 - progress / 100);

  return (
    <LinearGradient
      colors={[colors.cardElevated, colors.neonMuted, colors.card]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.eyebrow}>Performance Center</Text>
      <Text style={styles.title}>Visão real da evolução</Text>
      <Text style={styles.description}>
        Acompanhe a execução do seu plano semana a semana em um só lugar.
      </Text>

      <View style={styles.summary}>
        <View accessible accessibilityLabel={`${progress}% de aderência`} style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={colors.bg}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={colors.neon}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={progressOffset}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.ringLabel}>
            <Text style={styles.percent}>{progress}%</Text>
            <Text style={styles.adherenceLabel}>ADERÊNCIA</Text>
          </View>
        </View>

        <View style={styles.detail}>
          <View style={styles.detailIcon}>
            <CheckCircle2 size={20} color={colors.neon} />
          </View>
          <Text style={styles.detailValue}>
            {completedWorkouts} de {plannedWorkouts}
          </Text>
          <Text style={styles.detailLabel}>treinos concluídos</Text>
          <Text style={styles.detailHint}>
            {plannedWorkouts === 0
              ? 'Seu progresso aparecerá quando os treinos estiverem disponíveis.'
              : progress === 100
                ? 'Ciclo completo até aqui. Excelente consistência.'
                : 'Cada treino concluído fortalece a evolução do ciclo.'}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.neonMuted,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  eyebrow: {
    color: colors.neon,
    fontSize: fontSizes.body,
    ...fontWeight('800'),
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    ...fontWeight('800'),
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.base,
    ...fontWeight('400'),
    lineHeight: fontSizes.base * 1.55,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  percent: {
    color: colors.neon,
    fontSize: fontSizes.display,
    ...fontWeight('800'),
  },
  adherenceLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    ...fontWeight('800'),
    letterSpacing: 0.9,
  },
  detail: {
    flex: 1,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.neonMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    ...fontWeight('800'),
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    ...fontWeight('600'),
    marginTop: 2,
  },
  detailHint: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    ...fontWeight('400'),
    lineHeight: fontSizes.caption * 1.45,
    marginTop: spacing.md,
  },
});
