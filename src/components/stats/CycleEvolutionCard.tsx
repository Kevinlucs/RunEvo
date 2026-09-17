import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, GitCompareArrows, Sparkles, TrendingUp } from 'lucide-react-native';
import { colors, radii, spacing, fontSizes, fontWeight, MIN_TOUCH_TARGET } from '@/theme';

interface Props {
  cycleCount: number;
  onCompare: () => void;
  onViewEvolution: () => void;
}

function getDescription(cycleCount: number): string {
  if (cycleCount >= 2) {
    return 'Compare seus ciclos e veja como volume, consistência e metas evoluíram.';
  }

  if (cycleCount === 1) {
    return 'Seu primeiro ciclo já está salvo. Complete o próximo para começar a comparar sua evolução.';
  }

  return 'Ao concluir seus ciclos, transforme cada preparação em uma visão clara da sua evolução.';
}

/**
 * Único ponto de destaque do RunEvo+ dentro de Estatísticas. Reúne os dois
 * recursos de evolução entre ciclos sem criar uma grade de upsells ou prometer
 * métricas de atividades que o app ainda não coleta.
 */
export function CycleEvolutionCard({ cycleCount, onCompare, onViewEvolution }: Props): JSX.Element {
  return (
    <LinearGradient
      colors={[colors.cardElevated, colors.neonMuted, colors.card]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Sparkles size={14} color={colors.bg} />
          <Text style={styles.badgeText}>RUNEVO+</Text>
        </View>
      </View>

      <Text style={styles.title}>Sua evolução, ciclo após ciclo</Text>
      <Text style={styles.description}>{getDescription(cycleCount)}</Text>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onCompare}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <View style={styles.actionIcon}>
            <GitCompareArrows size={19} color={colors.neon} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Comparar ciclos</Text>
            <Text style={styles.actionDescription}>Veja o que mudou entre preparações.</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onViewEvolution}
          style={({ pressed }) => [
            styles.action,
            styles.actionLast,
            pressed && styles.actionPressed,
          ]}
        >
          <View style={styles.actionIcon}>
            <TrendingUp size={19} color={colors.neon} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Ver evolução</Text>
            <Text style={styles.actionDescription}>
              Acompanhe suas tendências ao longo do tempo.
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.neonMuted,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.neon,
  },
  badgeText: {
    color: colors.bg,
    fontSize: fontSizes.caption,
    ...fontWeight('800'),
    letterSpacing: 0.7,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    ...fontWeight('800'),
    marginTop: spacing.md,
  },
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    ...fontWeight('400'),
    lineHeight: fontSizes.body * 1.5,
    marginTop: spacing.xs,
  },
  actions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
  },
  action: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionLast: { borderBottomWidth: 0, paddingBottom: 0 },
  actionPressed: { opacity: 0.72 },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.neonMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
  actionDescription: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 2 },
});
