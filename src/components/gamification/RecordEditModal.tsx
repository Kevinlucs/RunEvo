import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { NeonButton } from '@/components/ui/NeonButton';
import { DateField } from '@/components/forms/DateField';
import { TimeWheelPicker } from '@/components/forms/TimeWheelPicker';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import { parseTimeToSeconds } from '@/services/gamification/compute';

interface Props {
  visible: boolean;
  distanceLabel: string;
  color: string;
  currentTime?: string;
  currentDate?: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (input: { time: string; date: string }) => Promise<void>;
}

const MAX_HOURS = 9;

/**
 * Cadastro de uma marca que não veio de uma integração. O seletor é o mesmo
 * usado em IA Evo > Tempos anteriores para manter gesto e leitura consistentes.
 */
export function RecordEditModal({
  visible,
  distanceLabel,
  color,
  currentTime,
  currentDate,
  submitting = false,
  onCancel,
  onConfirm,
}: Props): JSX.Element {
  const [time, setTime] = useState('00:00:00');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | undefined>();
  const isEditing = Boolean(currentTime);

  useEffect(() => {
    if (visible) {
      setTime(currentTime ?? '00:00:00');
      setDate(currentDate ?? '');
      setError(null);
      setDateError(undefined);
    }
  }, [visible, currentTime, currentDate]);

  const handleConfirm = async (): Promise<void> => {
    const seconds = parseTimeToSeconds(time);
    if (!seconds || seconds <= 0) {
      setError('Selecione um tempo válido.');
      return;
    }
    if (!date) {
      setDateError('Informe a data da marca.');
      return;
    }

    setError(null);
    setDateError(undefined);
    try {
      await onConfirm({ time, date });
    } catch {
      setError('Não foi possível salvar sua marca. Tente novamente.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={[styles.accent, { backgroundColor: color }]} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>
                {isEditing ? 'Editar marca manual' : 'Adicionar marca manual'}
              </Text>
              <Text style={styles.subtitle}>
                {isEditing ? 'Atualize sua marca para' : 'Registre seu melhor tempo para'}{' '}
                {distanceLabel}.
              </Text>
            </View>
          </View>

          <View style={styles.timeSection}>
            <Text style={styles.label}>Seu tempo</Text>
            <TimeWheelPicker value={time} onChange={setTime} maxHours={MAX_HOURS} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <DateField
            label="Data"
            value={date}
            error={dateError}
            onChange={(nextDate) => {
              setDate(nextDate);
              setDateError(undefined);
            }}
          />

          <View style={styles.actions}>
            <NeonButton label="Salvar" onPress={handleConfirm} loading={submitting} />

            <Pressable
              style={styles.cancelBtn}
              onPress={onCancel}
              accessibilityRole="button"
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: spacing.xl,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 3,
    borderRadius: radii.pill,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  headerCopy: {
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    ...fontWeight('800'),
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  timeSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSizes.base,
    ...fontWeight('700'),
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  error: {
    color: colors.error,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardElevated,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: fontSizes.base,
    ...fontWeight('600'),
  },
});
