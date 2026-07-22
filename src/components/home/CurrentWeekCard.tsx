import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors, spacing, fontSizes } from '@/theme';
import type { Workout } from '@/domain/entities';

const STATUS_LABEL: Record<Workout['status'], string> = {
  pending: 'Pendente',
  completed: 'Concluído',
  skipped: 'Pulado',
};

const STATUS_COLOR: Record<Workout['status'], string> = {
  pending: colors.textMuted,
  completed: colors.success,
  skipped: colors.textSecondary,
};

/** docs/fase-4-brief.md Grupo 2.2 (§27, bloco 5): treinos da semana corrente, ordenados por dia. */
export function CurrentWeekCard({ weekNumber, workouts }: { weekNumber: number; workouts: Workout[] }): JSX.Element {
  const sorted = [...workouts].sort((a, b) => a.week_index - b.week_index);

  return (
    <Card title={`Semana Atual — S${weekNumber}`}>
      {sorted.length === 0 ? (
        <Text style={styles.empty}>Nenhum treino cadastrado nesta semana.</Text>
      ) : (
        sorted.map((workout) => (
          <View key={workout.id} style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {workout.title ?? 'Treino'}
              </Text>
              <Text style={styles.subtitle}>
                {workout.day_label ?? '-'} · {workout.day_type ?? '-'}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.km}>{workout.planned_km ?? 0} km</Text>
              <Text style={[styles.status, { color: STATUS_COLOR[workout.status] }]}>
                {STATUS_LABEL[workout.status]}
              </Text>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: { flex: 1, marginRight: spacing.md },
  title: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '600' },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  km: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '700' },
  status: { fontSize: fontSizes.caption, marginTop: 2 },
  empty: { color: colors.textMuted, fontSize: fontSizes.body },
});
