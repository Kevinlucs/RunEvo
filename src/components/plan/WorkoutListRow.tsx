import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';
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

export interface WorkoutListRowEditControls {
  /** docs/fase-5-brief.md Grupo 4 (§22) — reordenar/remover só treinos pendentes; nunca a prova. */
  canEdit: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
}

/**
 * Item da lista virtualizada de Treinos (§29) — memoizado, plano pode ter
 * ~300 treinos. `onPress` (docs/fase-4-brief.md Grupo 4) abre o detalhe do
 * treino; sem ele a linha fica só informativa (nenhum uso atual precisa disso,
 * mas evita quebrar quem ainda não passa a prop). `edit` (Fase 5 Grupo 4)
 * troca o chevron pelos controles de reordenar/remover.
 */
function WorkoutListRowBase({
  workout,
  onPress,
  edit,
}: {
  workout: Workout;
  onPress?: () => void;
  edit?: WorkoutListRowEditControls;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Abrir treino: ${workout.title ?? 'treino'}` : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
    >
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
        <Text style={[styles.status, { color: STATUS_COLOR[workout.status] }]}>{STATUS_LABEL[workout.status]}</Text>
      </View>
      {edit?.canEdit ? (
        <View style={styles.editControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Mover para cima" onPress={edit.onMoveUp} style={styles.iconButton}>
            <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Mover para baixo" onPress={edit.onMoveDown} style={styles.iconButton}>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Remover treino" onPress={edit.onRemove} style={styles.iconButton}>
            <Ionicons name="trash" size={18} color={colors.error} />
          </Pressable>
        </View>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

export const WorkoutListRow = memo(WorkoutListRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: { flex: 1, marginRight: spacing.md },
  title: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('600') },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  km: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
  status: { fontSize: fontSizes.caption, marginTop: 2 },
  editControls: { flexDirection: 'row', marginLeft: spacing.sm },
  iconButton: { padding: spacing.xs },
});
