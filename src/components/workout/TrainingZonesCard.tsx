import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import type { TrainingZones } from '@/domain/motor-evo/types';

const ZONE_KEYS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;

/**
 * Zonas de treinamento Z1-Z5 do blueprint.
 * Layout pixel-perfect com mockup DESCRICAO TREINO 1.
 * Cada zona é um card individual com badge + nome + pace range + velocidade.
 */
export function TrainingZonesCard({ zones }: { zones: TrainingZones | null }): JSX.Element | null {
  if (!zones) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>ZONAS DE TREINAMENTO</Text>
      <Text style={styles.sectionTitle}>Zonas do atleta</Text>

      {ZONE_KEYS.map((key) => {
        const zone = zones[key];
        return (
          <View key={key} style={styles.zoneCard}>
            <View style={styles.zoneBadge}>
              <Text style={styles.zoneBadgeText}>{key}</Text>
            </View>
            <View style={styles.zoneContent}>
              <Text style={styles.zoneName}>{zone.name}</Text>
              <Text style={styles.zoneRange}>{zone.from} até {zone.to}</Text>
              {zone.speedFrom && zone.speedTo ? (
                <Text style={styles.zoneSpeed}>{zone.speedFrom} até {zone.speedTo}</Text>
              ) : null}
            </View>
          </View>
        );
      })}

      <Text style={styles.hint}>
        Use esta tabela para transformar as zonas do treino em pace/esteira.
      </Text>
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
  sectionLabel: { color: colors.neon, fontSize: 12, ...fontWeight('600'), letterSpacing: 1, marginBottom: -spacing.xs, textAlign: 'center'},
  sectionTitle: { color: colors.textPrimary, fontSize: 20, ...fontWeight('700'), marginBottom: spacing.md, textAlign: 'center' },
  zoneCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneBadge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneBadgeText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('800') },
  zoneContent: { flex: 1, marginLeft: 12 },
  zoneName: { color: colors.textSecondary, fontSize: 14, ...fontWeight('500'), marginBottom: 4 },
  zoneRange: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: 2 },
  zoneSpeed: { color: colors.textMuted, fontSize: 13, ...fontWeight('400') },
  hint: { color: colors.textSecondary, fontSize: 13, ...fontWeight('400'), marginTop: spacing.sm, lineHeight: 18 },
});
