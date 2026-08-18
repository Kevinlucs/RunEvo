import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

/**
 * Card "Como Executar" — prescrição do treino formatada com hierarquia.
 * Layout pixel-perfect com mockup DESCRICAO TREINO 2.
 */
export function WorkoutDescriptionCard({ lines }: { lines: string[] }): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>COMO EXECUTAR</Text>
      <Text style={styles.sectionTitle}>Descrição do treino</Text>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>EDIÇÃO NA ABA TREINOS</Text>
      </View>

      {lines.length > 0 ? (
        <View style={styles.blocksContainer}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockHeaderText}>BLOCO PRINCIPAL</Text>
          </View>
          {lines.map((line, index) => (
            <View key={index} style={[styles.blockLine, index < lines.length - 1 && styles.blockLineBorder]}>
              <Text style={styles.blockLineText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Descrição ainda não preenchida para este treino.</Text>
      )}
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
});
