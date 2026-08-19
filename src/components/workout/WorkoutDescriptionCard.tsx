import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { extractAdaptiveAlerts } from '@/services/workout/extract-adaptive-alerts';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * Card "Como Executar" — prescrição do treino com alertas adaptativos separados.
 * Alertas do IA Coach (carga reduzida, redistribuição, etc.) são extraídos
 * e renderizados em cards individuais abaixo do bloco principal.
 */
export function WorkoutDescriptionCard({ lines }: { lines: string[] }): JSX.Element {
  const { blocks, alerts } = extractAdaptiveAlerts(lines);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>COMO EXECUTAR</Text>
      <Text style={styles.sectionTitle}>Descrição do treino</Text>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>EDIÇÃO NA ABA TREINOS</Text>
      </View>

      {blocks.length > 0 ? (
        <View style={styles.blocksContainer}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockHeaderText}>BLOCO PRINCIPAL</Text>
          </View>
          {blocks.map((line, index) => (
            <View key={index} style={[styles.blockLine, index < blocks.length - 1 && styles.blockLineBorder]}>
              <Text style={styles.blockLineText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Descrição ainda não preenchida para este treino.</Text>
      )}

      {alerts.length > 0 ? (
        <View style={styles.alertsSection}>
          {alerts.map((alert, index) => (
            <View key={index} style={styles.alertCard}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} style={styles.alertIcon} />
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionLabel: { color: colors.neon, fontSize: 14, ...fontWeight('800'), letterSpacing: 1.5, marginBottom: spacing.xs },
  sectionTitle: { color: colors.textPrimary, fontSize: 20, ...fontWeight('700'), marginBottom: spacing.md },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A2A2A',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  badgeText: { color: colors.textSecondary, fontSize: 12, ...fontWeight('600'), letterSpacing: 0.5 },
  blocksContainer: {
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.15)',
  },
  blockHeader: {
    backgroundColor: 'rgba(204,255,0,0.08)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  blockHeaderText: { color: colors.neon, fontSize: 13, ...fontWeight('700'), letterSpacing: 0.5 },
  blockLine: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(204,255,0,0.3)',
  },
  blockLineBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  blockLineText: { color: colors.textPrimary, fontSize: 16, ...fontWeight('600') },
  empty: { color: colors.textMuted, fontSize: fontSizes.body, ...fontWeight('400') },
  alertsSection: { marginTop: spacing.lg },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,152,0,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  alertIcon: { marginRight: spacing.sm, marginTop: 1 },
  alertText: { color: colors.warning, fontSize: 14, ...fontWeight('600'), flex: 1 },
});
