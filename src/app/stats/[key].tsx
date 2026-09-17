import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { RecordEditModal } from '@/components/gamification';
import { ART_BY_KEY } from '@/components/gamification/RecordHexagon';
import { PERSONAL_RECORDS } from '@/services/gamification/constants';
import { formatLongDate } from '@/utils/time';
import { usePersonalRecordMilestones } from '@/hooks/usePersonalRecords';
import type { PersonalRecordEntry } from '@/domain/entities';
import { colors, spacing, fontSizes, fontWeight, radii } from '@/theme';

/** Máximo de marcas exibidas na listagem (as mais rápidas). */
const MAX_MARKS = 3;

/** Mantém o formato esportivo da referência: MM:SS ou H:MM:SS em provas longas. */
function formatRecordTime(time: string): string {
  const parts = time.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return time;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return `${String(minutes ?? 0).padStart(2, '0')}:${String(seconds ?? 0).padStart(2, '0')}`;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    if ((hours ?? 0) > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes ?? 0).padStart(2, '0')}:${String(seconds ?? 0).padStart(2, '0')}`;
    }
    return `${String(minutes ?? 0).padStart(2, '0')}:${String(seconds ?? 0).padStart(2, '0')}`;
  }

  return time;
}

/**
 * Tela de detalhe do recorde pessoal. Mostra somente as três marcas mais
 * rápidas. Marcas do Strava abrem a atividade original; as manuais revelam
 * exclusivamente os dados registrados pelo atleta.
 */
export default function RecordDetailScreen(): JSX.Element {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();

  const record = PERSONAL_RECORDS.find((r) => r.key === key);
  const { milestones, isLoading, add, update, remove } = usePersonalRecordMilestones(key ?? null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<PersonalRecordEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; time: string } | null>(null);

  if (!record) {
    return (
      <Screen>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Distância não encontrada</Text>
          <NeonButton label="Voltar" onPress={() => router.back()} variant="secondary" />
        </View>
      </Screen>
    );
  }

  // Melhor marca = primeiro item (mais rápido) — o repositório já ordena asc por tempo
  const bestMilestone = milestones[0] ?? null;
  const friendlyBestTime = bestMilestone ? formatRecordTime(bestMilestone.time) : null;
  const bestDate = bestMilestone?.date ? formatLongDate(bestMilestone.date) : null;

  // Mostra até MAX_MARKS marcas, todas que temos (já vêm ordenadas pelo hook)
  const visibleMarks = milestones.slice(0, MAX_MARKS);

  const art = ART_BY_KEY[record.key];

  const handleAdd = async (input: { time: string; date: string }): Promise<void> => {
    setSubmitting(true);
    try {
      if (editingMilestone) {
        await update(editingMilestone.id, input);
      } else {
        await add(input);
      }
      setShowAddModal(false);
      setEditingMilestone(null);
    } finally {
      setSubmitting(false);
    }
  };

  const openNewRecord = (): void => {
    setEditingMilestone(null);
    setShowAddModal(true);
  };

  const openManualRecord = (milestone: PersonalRecordEntry): void => {
    setEditingMilestone(milestone);
    setShowAddModal(true);
  };

  const handleDeleteMark = (milestoneId: string, time: string): void => {
    setDeleteTarget({ id: milestoneId, time });
  };

  const handleOpenStrava = async (url?: string): Promise<void> => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // Uma integração futura pode fornecer um link indisponível. Não
      // interrompemos a visualização das marcas por causa disso.
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Badge grande */}
        <View style={styles.badgeSection}>
          <Image
            source={art}
            style={styles.badgeImage}
            contentFit="contain"
            alt={`Badge de ${record.name}`}
          />
        </View>

        {/* Data (se houver) + contextualização da melhor marca + tempo destaque */}
        <View style={styles.infoSection}>
          {bestDate && <Text style={styles.infoDate}>{bestDate}</Text>}
          <Text style={styles.infoName}>Mais rápido {record.name}</Text>
          {friendlyBestTime ? (
            <Text style={styles.infoTime}>{friendlyBestTime}</Text>
          ) : (
            <Text style={styles.infoEmpty}>Nenhuma marca registrada</Text>
          )}
        </View>

        {/* Botão adicionar — estilo secundário (escuro), igual ao design */}
        <View style={styles.addAction}>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={openNewRecord}
            accessibilityRole="button"
            accessibilityLabel="Adicionar novo recorde pessoal"
          >
            <Ionicons name="add" size={18} color={colors.textPrimary} style={styles.addIcon} />
            <Text style={styles.addButtonLabel}>ADICIONAR NOVO RECORDE PESSOAL</Text>
          </Pressable>
        </View>

        {/* Seção MARCAS com divisória */}
        <View style={styles.marksSection}>
          <View style={styles.marksDividerRow}>
            <View style={styles.marksDivider} />
            <Text style={styles.marksTitle}>SUAS 3 MELHORES MARCAS</Text>
            <View style={styles.marksDivider} />
          </View>

          {isLoading && milestones.length === 0 ? (
            <Text style={styles.emptyText}>Carregando…</Text>
          ) : visibleMarks.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma marca registrada</Text>
          ) : (
            <View style={styles.marksList}>
              {visibleMarks.map((m) => {
                const mFriendly = formatRecordTime(m.time);
                const mDate = m.date ? formatLongDate(m.date) : null;
                // A origem define o comportamento do cartão — uma marca
                // importada nunca pode virar editável, mesmo se um link antigo
                // estiver indisponível.
                const isStrava = m.source === 'strava';
                const content = (
                  <>
                    <View style={styles.markInfo}>
                      <Text style={styles.markTime}>{mFriendly}</Text>
                      {mDate ? <Text style={styles.markDate}>{mDate}</Text> : null}
                    </View>
                  </>
                );

                if (isStrava) {
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => void handleOpenStrava(m.externalUrl)}
                      disabled={!m.externalUrl}
                      style={({ pressed }) => [styles.markRow, pressed && styles.markRowPressed]}
                      accessibilityRole={m.externalUrl ? 'link' : 'text'}
                      accessibilityLabel={
                        m.externalUrl
                          ? `Abrir no Strava a marca de ${mFriendly}`
                          : `Marca de ${mFriendly} importada do Strava`
                      }
                    >
                      {content}
                      <View style={styles.stravaAction}>
                        <View style={styles.stravaBadge}>
                          <Text style={styles.stravaBadgeText}>STRAVA</Text>
                        </View>
                        <Ionicons name="open-outline" size={18} color={colors.strava} />
                      </View>
                    </Pressable>
                  );
                }

                return (
                  <View key={m.id} style={styles.markRow}>
                    <Pressable
                      style={styles.markInfo}
                      onPress={() => openManualRecord(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar marca de ${mFriendly}`}
                    >
                      <Text style={styles.markTime}>{mFriendly}</Text>
                      {mDate ? <Text style={styles.markDate}>{mDate}</Text> : null}
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteMark(m.id, mFriendly)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover marca de ${mFriendly}`}
                      style={({ pressed }) => pressed && styles.trashPressed}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <RecordEditModal
        visible={showAddModal}
        distanceLabel={record.name}
        color={record.color}
        currentTime={editingMilestone?.time}
        currentDate={editingMilestone?.date}
        submitting={submitting}
        onCancel={() => {
          setShowAddModal(false);
          setEditingMilestone(null);
        }}
        onConfirm={handleAdd}
      />

      {/* Modal de confirmação de remoção — padrão do app */}
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setDeleteTarget(null)}>
          <Pressable style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Remover marca</Text>
            <Text style={styles.confirmMessage}>
              Deseja remover o registro de{' '}
              <Text style={styles.confirmHighlight}>{deleteTarget?.time}</Text>?
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteBtn} onPress={confirmDelete}>
                <Text style={styles.confirmDeleteText}>Remover</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
  },

  /* Badge */
  badgeSection: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  badgeImage: {
    width: 160,
    height: 160,
  },

  /* Info: data + nome + tempo */
  infoSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    gap: 4,
  },
  infoDate: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    ...fontWeight('400'),
  },
  infoName: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    ...fontWeight('800'),
  },
  infoTime: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    ...fontWeight('800'),
    marginTop: spacing.xs,
  },
  infoEmpty: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

  /* Botão adicionar — escuro, borda sutil */
  addAction: {
    width: '100%',
    marginBottom: spacing.xxl,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  addIcon: {
    marginRight: spacing.xs,
  },
  addButtonLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.caption + 1,
    ...fontWeight('700'),
    letterSpacing: 0.5,
  },

  /* Seção MARCAS */
  marksSection: {
    width: '100%',
  },
  marksDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  marksDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  marksTitle: {
    color: colors.textMuted,
    fontSize: fontSizes.caption - 1,
    ...fontWeight('700'),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  marksList: {
    gap: spacing.sm,
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  markRowPressed: {
    backgroundColor: colors.cardElevated,
  },
  markInfo: {
    flex: 1,
  },
  markTime: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    ...fontWeight('700'),
  },
  markDate: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    marginTop: 2,
  },
  stravaAction: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  stravaBadge: {
    backgroundColor: colors.stravaMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  stravaBadgeText: {
    color: colors.strava,
    fontSize: fontSizes.caption - 2,
    ...fontWeight('800'),
    letterSpacing: 0.6,
  },
  trashPressed: {
    opacity: 0.5,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
  },

  /* Modal de confirmação de remoção */
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  confirmCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    ...fontWeight('700'),
    marginBottom: spacing.sm,
  },
  confirmMessage: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * 1.5,
    marginBottom: spacing.lg,
  },
  confirmHighlight: {
    color: colors.textPrimary,
    ...fontWeight('700'),
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  confirmCancelText: {
    color: colors.textSecondary,
    fontSize: fontSizes.base,
    ...fontWeight('600'),
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  confirmDeleteText: {
    color: '#fff',
    fontSize: fontSizes.base,
    ...fontWeight('700'),
  },
});
