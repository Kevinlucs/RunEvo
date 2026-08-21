import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Mountain, Dumbbell, Zap, Flag } from 'lucide-react-native';
import { PremiumGate } from '@/components/premium';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AddWorkoutModal, type AddWorkoutFormInput } from '@/components/plan/AddWorkoutModal';
import { useActivePlan } from '@/hooks/useActivePlan';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { useCurrentWeek } from '@/hooks/useCurrentWeek';
import { usePlanProgress } from '@/hooks/usePlanProgress';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useAuthStore } from '@/store/auth.store';
import { buildWeekMeta, groupWeeksByPhase, type WeekMeta, type PhaseGroup } from '@/services/plan/plan-cycle.service';
import { addWorkout, removeWorkout } from '@/services/plan/edit-workout.service';
import { exportPlanAsPdf, exportPlanAsExcel } from '@/services/plan/export-plan';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PHASE_ICONS: Record<string, React.ComponentType<any>> = {
  base: Mountain,
  resistência: Dumbbell,
  resistencia: Dumbbell,
  pico: Zap,
  polimento: Flag,
};
const PHASE_SUBTITLE: Record<string, string> = { base: 'Fundação aeróbica', resistência: 'Volume e constância', pico: 'Semanas mais fortes', polimento: 'Redução até a prova' };

/**
 * Aba Treinos — 3 seções: Modificações, Fases, Exportação.
 * Pixel-perfect com mockups TELA TREINOS 1-3.
 */
export default function Plan(): JSX.Element {
  const { plan, isLoading } = useActivePlan();
  const { workouts } = usePlanWorkouts(plan?.id);
  const { weekNumber: currentWeekNumber } = useCurrentWeek();
  usePlanProgress();
  const userId = useAuthStore((s) => s.userId);
  const { profile } = useAthleteProfile(userId);
  const { isPlus } = useEntitlement();

  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [workoutDropdownOpen, setWorkoutDropdownOpen] = useState(false);
  const [addModalWeek, setAddModalWeek] = useState<WeekMeta | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const weeksMeta = useMemo(
    () => (plan ? buildWeekMeta(plan, workouts, currentWeekNumber) : []),
    [plan, workouts, currentWeekNumber],
  );
  const phaseGroups = useMemo(() => groupWeeksByPhase(weeksMeta), [weeksMeta]);

  const weekWorkouts = useMemo(
    () => workouts.filter((w) => w.week_number === selectedWeek).sort((a, b) => a.week_index - b.week_index),
    [workouts, selectedWeek],
  );
  const selectedWorkout = weekWorkouts.find((w) => w.id === selectedWorkoutId) ?? weekWorkouts[0] ?? null;
  const selectedWeekMeta = weeksMeta.find((w) => w.weekNumber === selectedWeek);
  const weekKm = weekWorkouts.reduce((s, w) => s + (w.planned_km ?? 0), 0);
  const weekRegistered = weekWorkouts.filter((w) => w.status !== 'pending').length;

  const handleRemoveWorkout = useCallback(() => {
    if (!selectedWorkout) return;
    Alert.alert('Remover treino', `"${selectedWorkout.title ?? 'Treino'}" será removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void removeWorkout(selectedWorkout.id) },
    ]);
  }, [selectedWorkout]);

  const handleAddWorkout = async (input: AddWorkoutFormInput): Promise<void> => {
    if (!plan || !userId || !addModalWeek) return;
    setAddSubmitting(true);
    const result = await addWorkout({
      planId: plan.id, userId, weekNumber: addModalWeek.weekNumber, phase: addModalWeek.phase,
      title: input.title, description: input.description, dayType: input.dayType,
      dayLabel: input.dayLabel, workoutDate: input.workoutDate,
      plannedKm: input.plannedKm, plannedPace: input.plannedPace,
    });
    setAddSubmitting(false);
    if (result.ok) setAddModalWeek(null);
    else Alert.alert('Erro', result.error.message);
  };

  const handleExport = useCallback(
    async (format: 'pdf' | 'excel'): Promise<void> => {
      if (!plan || exporting) return;
      if (format === 'excel' && !isPlus) {
        router.push({ pathname: '/runevo-plus', params: { reason: 'history' } });
        return;
      }
      setExporting(true);
      try {
        const input = { plan, workouts, athlete: profile, advanced: isPlus };
        const result = format === 'pdf' ? await exportPlanAsPdf(input) : await exportPlanAsExcel(input);
        if (!result.ok) Alert.alert('Erro', result.error.message);
      } finally { setExporting(false); }
    },
    [plan, workouts, profile, isPlus, exporting],
  );

  if (!isLoading && !plan) {
    return (
      <Screen>
        <AppHeader />
        <EmptyState title="Nenhuma planilha ativa" message="Gere sua planilha com a IA Evo para ver seus treinos aqui." ctaLabel="Criar minha planilha" onPressCta={() => router.push('/(tabs)/ai-evo')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppHeader />

        {/* SEÇÃO 1 — MODIFICAÇÕES */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MODIFICAÇÕES DA PLANILHA</Text>
          <Text style={styles.sectionTitle}>Editar treinos do ciclo</Text>
          <Text style={styles.sectionText}>Escolha a semana e o treino para editar, adicionar ou remover.</Text>
          <View style={styles.badgePill}><Text style={styles.badgePillText}>PLANILHA ATUAL</Text></View>

          {/* Dropdown Semana */}
          <Text style={styles.dropdownLabel}>SEMANA</Text>
          <Pressable style={styles.dropdown} onPress={() => setWeekDropdownOpen(!weekDropdownOpen)} accessibilityRole="button">
            <Text style={styles.dropdownText}>{selectedWeekMeta ? `S${selectedWeekMeta.weekNumber} • ${selectedWeekMeta.phase} • ${weekKm} km` : `S${selectedWeek}`}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
          {weekDropdownOpen ? (
            <View style={styles.dropdownList}>
              {weeksMeta.map((w) => (
                <Pressable key={w.weekNumber} onPress={() => { setSelectedWeek(w.weekNumber); setWeekDropdownOpen(false); setSelectedWorkoutId(null); }} style={styles.dropdownItem}>
                  <Text style={[styles.dropdownItemText, w.weekNumber === selectedWeek && styles.dropdownItemActive]}>S{w.weekNumber} • {w.phase} • {w.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Dropdown Treino */}
          <Text style={styles.dropdownLabel}>TREINO</Text>
          <Pressable style={styles.dropdown} onPress={() => setWorkoutDropdownOpen(!workoutDropdownOpen)} accessibilityRole="button">
            <Text style={styles.dropdownText} numberOfLines={1}>{selectedWorkout ? `${selectedWorkout.day_label ?? '-'} • ${selectedWorkout.title ?? 'Treino'} • ${selectedWorkout.planned_km ?? 0} km` : 'Selecione'}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
          {workoutDropdownOpen ? (
            <View style={styles.dropdownList}>
              {weekWorkouts.map((w) => (
                <Pressable key={w.id} onPress={() => { setSelectedWorkoutId(w.id); setWorkoutDropdownOpen(false); }} style={styles.dropdownItem}>
                  <Text style={[styles.dropdownItemText, w.id === selectedWorkoutId && styles.dropdownItemActive]} numberOfLines={1}>{w.day_label ?? '-'} • {w.title ?? 'Treino'} • {w.planned_km ?? 0} km</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Botão Editar — FREE, sempre funcional */}
          <View style={styles.btnGroup}>
            <Pressable style={styles.btnNeon} onPress={() => selectedWorkout && router.push(`/workout/${selectedWorkout.id}` as never)} accessibilityRole="button">
              <Text style={styles.btnNeonText}>✏️ Editar treino</Text>
            </Pressable>
          </View>

          {/* Botões Plus — bloqueados pelo PremiumGate */}
          <PremiumGate
            locked={!isPlus}
            title="Recurso Premium"
            description="Desbloqueie para adicionar e remover treinos do ciclo."
            onUnlock={() => router.push({ pathname: '/runevo-plus', params: { reason: 'history' } })}
          >
            <View style={styles.btnGroup}>
              <Pressable style={styles.btnGray} onPress={() => selectedWeekMeta && setAddModalWeek(selectedWeekMeta)} accessibilityRole="button">
                <Text style={styles.btnGrayText}>+ Adicionar na semana</Text>
              </Pressable>
              <Pressable style={styles.btnDanger} onPress={handleRemoveWorkout} accessibilityRole="button">
                <Text style={styles.btnDangerText}>🗑️ Remover treino</Text>
              </Pressable>
            </View>
          </PremiumGate>

          <Text style={styles.resumeText}>{weekWorkouts.length} treino(s) na semana • {weekKm} km planejados • {weekRegistered}/{weekWorkouts.length} registrado(s).</Text>
        </View>

        {/* SEÇÃO 2 — FASES */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FASES DA PLANILHA</Text>
          <Text style={styles.sectionTitle}>Organização do ciclo</Text>
          <Text style={styles.sectionText}>Clique em uma fase para ver os treinos</Text>

          {phaseGroups.map((group) => (
            <PhaseCard key={group.phase} group={group} />
          ))}
        </View>

        {/* SEÇÃO 3 — EXPORTAÇÃO */}
        <LinearGradient colors={['rgba(204,255,0,0.04)', 'transparent']} style={styles.section}>
          <Text style={styles.sectionLabel}>EXPORTAÇÃO</Text>
          <Text style={styles.sectionTitle}>Compartilhar planilha</Text>
          <Text style={styles.sectionText}>Gere versões profissionais da planilha para análise, impressão ou compartilhamento.</Text>

          <PremiumGate
            locked={!isPlus}
            title="Recurso Premium"
            description="Exporte sua planilha em PDF ou Excel profissional."
            onUnlock={() => router.push({ pathname: '/runevo-plus', params: { reason: 'history' } })}
          >
            <Pressable style={styles.exportCard} onPress={() => void handleExport('excel')} accessibilityRole="button">
              <Text style={styles.exportEmoji}>📊</Text>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>Excel profissional</Text>
                <Text style={styles.exportDesc}>Planilha detalhada com todas as semanas</Text>
              </View>
            </Pressable>
            <Pressable style={styles.exportCard} onPress={() => void handleExport('pdf')} accessibilityRole="button">
              <Text style={styles.exportEmoji}>📄</Text>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>PDF profissional</Text>
                <Text style={styles.exportDesc}>Versão para impressão e compartilhamento</Text>
              </View>
            </Pressable>
          </PremiumGate>
        </LinearGradient>
      </ScrollView>

      {addModalWeek ? (
        <AddWorkoutModal visible weekNumber={addModalWeek.weekNumber} submitting={addSubmitting} onCancel={() => setAddModalWeek(null)} onConfirm={handleAddWorkout} />
      ) : null}
    </Screen>
  );
}

function PhaseCard({ group }: { group: PhaseGroup }): JSX.Element {
  const PhaseIcon = PHASE_ICONS[group.phase.toLowerCase()] ?? Mountain;
  const subtitle = PHASE_SUBTITLE[group.phase.toLowerCase()] ?? '';
  const totalWorkouts = group.weeks.reduce((s, w) => s + w.workoutCount, 0);
  const totalKm = group.weeks.reduce((s, w) => s + w.totalKm, 0);

  return (
    <Pressable style={styles.phaseCard} onPress={() => router.push(`/plan/phase/${group.phase}` as never)} accessibilityRole="button">
      <View style={styles.phaseHeader}>
        <View style={styles.phaseIconWrap}>
          <PhaseIcon size={24} color={colors.neon} />
        </View>
        <View style={styles.phaseInfo}>
          <Text style={styles.phaseName}>{group.phase}</Text>
          <Text style={styles.phaseSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.phaseStats}>
        <Text style={styles.phaseStatWhite}>{totalWorkouts} treinos</Text>
        <Text style={styles.phaseStatNeon}>{totalKm} km</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  section: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.15)',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionLabel: { color: colors.neon, fontSize: 12, ...fontWeight('600'), letterSpacing: 1, marginBottom: spacing.xs },
  sectionTitle: { color: colors.textPrimary, fontSize: 22, ...fontWeight('800'), marginBottom: spacing.sm },
  sectionText: { color: colors.textSecondary, fontSize: 14, ...fontWeight('400'), marginBottom: spacing.md, lineHeight: 20 },
  badgePill: { alignSelf: 'flex-start', backgroundColor: 'rgba(204,255,0,0.15)', borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginBottom: spacing.lg },
  badgePillText: { color: colors.neon, fontSize: 12, ...fontWeight('700') },
  dropdownLabel: { color: colors.textSecondary, fontSize: 11, ...fontWeight('600'), letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.sm },
  dropdown: { backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: 'rgba(204,255,0,0.2)', borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('400'), flex: 1, marginRight: spacing.sm },
  dropdownList: { backgroundColor: colors.cardElevated, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', marginTop: spacing.xs, overflow: 'hidden', maxHeight: 200 },
  dropdownItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  dropdownItemText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('400') },
  dropdownItemActive: { color: colors.neon, ...fontWeight('700') },
  btnGroup: { marginTop: spacing.lg, gap: spacing.sm },
  btnNeon: { height: 52, backgroundColor: colors.neon, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  btnNeonText: { color: colors.bg, fontSize: fontSizes.base, ...fontWeight('700') },
  btnGray: { height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  btnGrayText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
  btnDanger: { height: 52, backgroundColor: 'rgba(255,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  btnDangerText: { color: colors.error, fontSize: fontSizes.base, ...fontWeight('600') },
  resumeText: { color: colors.textSecondary, fontSize: 13, ...fontWeight('400'), marginTop: spacing.md, textAlign: 'center' },
  phaseCard: { backgroundColor: colors.cardElevated, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: spacing.lg, marginBottom: spacing.md },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  phaseIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(204,255,0,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  phaseInfo: { flex: 1 },
  phaseName: { color: colors.textPrimary, fontSize: 18, ...fontWeight('800') },
  phaseSubtitle: { color: colors.textSecondary, fontSize: 13, ...fontWeight('400'), marginTop: 2 },
  progressTrack: { height: 6, borderRadius: radii.pill, backgroundColor: '#2A2A2A', overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: '100%', backgroundColor: colors.neon, borderRadius: radii.pill },
  phaseStats: { flexDirection: 'row', justifyContent: 'space-between' },
  phaseStatWhite: { color: colors.textPrimary, fontSize: 13, ...fontWeight('600') },
  phaseStatNeon: { color: colors.neon, fontSize: 13, ...fontWeight('600') },
  exportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardElevated, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.md },
  exportEmoji: { fontSize: 28, marginRight: spacing.md },
  exportInfo: { flex: 1 },
  exportTitle: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
  exportDesc: { color: colors.textSecondary, fontSize: 13, ...fontWeight('400'), marginTop: 2 },
});
