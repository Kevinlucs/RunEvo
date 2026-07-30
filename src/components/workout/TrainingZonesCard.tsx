import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';
import type { TrainingZones } from '@/domain/motor-evo/types';

const ZONE_KEYS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;

/** docs/fase-4-brief.md Grupo 4 (§28): zonas Z1-Z5 do blueprint, com o método/âncora usado. */
export function TrainingZonesCard({ zones }: { zones: TrainingZones | null }): JSX.Element | null {
  if (!zones) return null;
  const anchorLabel = zones.anchor.method === 'goal_anchored' ? 'ancorado no objetivo' : 'ancorado no teste de 3km';

  return (
    <Card title={`Zonas de treino (Z1-Z5) — ${anchorLabel}`}>
      {ZONE_KEYS.map((key) => {
        const zone = zones[key];
        return (
          <View key={key} style={styles.row}>
            <Text style={styles.label}>{zone.label}</Text>
            <Text style={styles.range}>
              {zone.name} · {zone.from} a {zone.to}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { color: colors.neon, fontSize: fontSizes.body, ...fontWeight('800') },
  range: { color: colors.textSecondary, fontSize: fontSizes.caption, flexShrink: 1, textAlign: 'right' },
});
