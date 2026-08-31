import { useEffect, useRef, useMemo, useState } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, Text, View, Pressable, TextInput, StyleSheet } from 'react-native';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Sprout, Activity, Flame, Crown, CircleHelp, Clock, Route, Waves, TrendingUp, MountainSnow, ChevronDown } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { NeonButton } from '@/components/ui/NeonButton';
import { DateField } from '@/components/forms/DateField';
import { PreviousTimesWheel } from '@/components/forms/PreviousTimesWheel';
import { Badge } from '@/components/forms/Badge';
import { Test3kmWheel } from '@/components/forms/Test3kmWheel';
import { Test3kmInfoModal } from '@/components/forms/Test3kmInfoModal';
import { SelectableCard } from '@/components/forms/SelectableCard';
import { LevelInfoModal } from '@/components/forms/LevelInfoModal';
import { TerrainInfoModal } from '@/components/forms/TerrainInfoModal';
import {
  aiEvoFormSchema,
  type AiEvoFormValues,
  DISTANCE_OPTIONS,
  DAYS_PER_WEEK_OPTIONS,
  DEFAULT_FORM_VALUES,
} from '@/components/forms/ai-evo.schema';
import { draftRepository } from '@/repositories/draft.repository';
import { useAuthStore } from '@/store/auth.store';
import { usePlanGenerationStore } from '@/store/plan-generation.store';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';
import type { AthleteInput } from '@/domain/motor-evo/types';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const LEVEL_CARDS = [
  { value: 'iniciante', icon: 'sprout', title: 'Iniciante' },
  { value: 'intermediário', icon: 'activity', title: 'Intermediário' },
  { value: 'avançado', icon: 'flame', title: 'Avançado' },
  { value: 'elite', icon: 'crown', title: 'Elite' },
] as const;

const LEVEL_ICON_MAP: Record<string, React.ReactNode> = {
  sprout: <Sprout size={22} color={colors.neon} />,
  activity: <Activity size={22} color={colors.neon} />,
  flame: <Flame size={22} color={colors.neon} />,
  crown: <Crown size={22} color={colors.neon} />,
};

const TERRAIN_CARDS = [
  { value: 'plano', icon: 'route', title: 'Plano' },
  { value: 'ondulado', icon: 'waves', title: 'Ondulado' },
  { value: 'moderado', icon: 'trendingUp', title: 'Moderado' },
  { value: 'montanhoso', icon: 'mountainSnow', title: 'Montanhoso' },
] as const;

const TERRAIN_ICON_MAP: Record<string, React.ReactNode> = {
  route: <Route size={22} color={colors.neon} />,
  waves: <Waves size={22} color={colors.neon} />,
  trendingUp: <TrendingUp size={22} color={colors.neon} />,
  mountainSnow: <MountainSnow size={22} color={colors.neon} />,
};

export default function AiEvo(): JSX.Element {
  const userId = useAuthStore((s) => s.userId);
  const setPendingInput = usePlanGenerationStore((s) => s.setPendingInput);
  const draftLoaded = useRef(false);
  const [levelInfoVisible, setLevelInfoVisible] = useState(false);
  const [terrainInfoVisible, setTerrainInfoVisible] = useState(false);
  const [test3kmInfoVisible, setTest3kmInfoVisible] = useState(false);
  const [distanceDropdownOpen, setDistanceDropdownOpen] = useState(false);
  const [daysDropdownOpen, setDaysDropdownOpen] = useState(false);
  const [longRunDropdownOpen, setLongRunDropdownOpen] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AiEvoFormValues>({
    resolver: zodResolver(aiEvoFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
    mode: 'onBlur',
  });

  const values = useWatch({ control });
  const targetDistance = values.targetDistance;

  // Calcula semanas até a prova
  const weeksUntilRace = useMemo(() => {
    if (!values.startDate || !values.raceDate) return null;
    const start = new Date(values.startDate);
    const race = new Date(values.raceDate);
    const diffMs = race.getTime() - start.getTime();
    const weeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
    return weeks > 0 ? weeks : null;
  }, [values.startDate, values.raceDate]);

  // Restaura rascunho ao abrir (docs/fase-3-brief.md §1.2).
  useEffect(() => {
    if (!userId || draftLoaded.current) return;
    draftLoaded.current = true;
    draftRepository.load(userId).then((res) => {
      if (res.ok && res.value) reset({ ...DEFAULT_FORM_VALUES, ...res.value } as AiEvoFormValues);
    });
  }, [userId, reset]);

  // Salva rascunho com debounce a cada alteração.
  const valuesJSON = JSON.stringify(values);
  useEffect(() => {
    if (!userId || !draftLoaded.current) return;
    const timeout = setTimeout(() => {
      void draftRepository.save(userId, values);
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- valuesJSON já captura o conteúdo relevante de `values`
  }, [userId, valuesJSON]);

  const onSubmit = (data: AiEvoFormValues): void => {
    if (!userId) return;
    const input: AthleteInput = { ...data };
    setPendingInput(input);
    router.push('/plan/generating');
  };

  return (
    <Screen>
      <AppHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews={false}
          nestedScrollEnabled
        >
          <Text style={styles.title}>IA Evo</Text>
          <Text style={styles.subtitle}>Evolua sua corrida com inteligência</Text>

          {/* SEÇÃO: Dados do Corredor */}
          <View style={styles.inputsCard}>
            <Text style={styles.sectionTitleInCard}>Dados do Corredor</Text>
            <Text style={styles.sectionDescInCard}>Informações básicas sobre você</Text>

            <Text style={styles.label}>Idade</Text>
            <Controller
              control={control}
              name="age"
              render={({ field }) => (
                <TextInput
                  style={[styles.input, errors.age ? styles.inputError : null]}
                  value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                  onChangeText={field.onChange}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
              )}
            />
            {errors.age ? <Text style={styles.error}>{errors.age.message}</Text> : null}

            <Text style={styles.label}>Altura (cm)</Text>
            <Controller
              control={control}
              name="height"
              render={({ field }) => (
                <TextInput
                  style={[styles.input, errors.height ? styles.inputError : null]}
                  value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                  onChangeText={field.onChange}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
              )}
            />
            {errors.height ? <Text style={styles.error}>{errors.height.message}</Text> : null}

            <Text style={styles.label}>Peso (kg)</Text>
            <Controller
              control={control}
              name="weight"
              render={({ field }) => (
                <TextInput
                  style={[styles.input, errors.weight ? styles.inputError : null]}
                  value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                  onChangeText={field.onChange}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                />
              )}
            />
            {errors.weight ? <Text style={styles.error}>{errors.weight.message}</Text> : null}
          </View>

          {/* SEÇÃO: Nível de Experiência */}
          <View style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelTitle}>Nível de experiência</Text>
              <Pressable onPress={() => setLevelInfoVisible(true)} accessibilityRole="button" accessibilityLabel="O que é cada nível?">
                <CircleHelp style={{ marginTop: -5 }} size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <Controller
              control={control}
              name="level"
              render={({ field }) => (
                <View>
                  {LEVEL_CARDS.map((card) => (
                    <SelectableCard
                      key={card.value}
                      selected={field.value === card.value}
                      onPress={() => field.onChange(card.value)}
                      icon={LEVEL_ICON_MAP[card.icon]}
                      title={card.title}
                    />
                  ))}
                </View>
              )}
            />
            {errors.level ? <Text style={styles.error}>{errors.level.message}</Text> : null}
          </View>

          {/* SEÇÃO: Prova */}
          <View style={styles.provaCard}>
            <Text style={styles.sectionTitleInCard}>Prova</Text>

            <Text style={styles.label}>Distância alvo</Text>
            <Controller
              control={control}
              name="targetDistance"
              render={({ field }) => (
                <View style={styles.dropdownWrap}>
                  <Pressable
                    style={styles.dropdown}
                    onPress={() => setDistanceDropdownOpen(!distanceDropdownOpen)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.dropdownText, !field.value && styles.dropdownPlaceholder]}>
                      {DISTANCE_OPTIONS.find((o) => o.value === field.value)?.label || 'Selecione a distância'}
                    </Text>
                    <ChevronDown size={18} color={colors.textMuted} />
                  </Pressable>
                  {distanceDropdownOpen ? (
                    <View style={styles.dropdownList}>
                      {DISTANCE_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.value}
                          onPress={() => {
                            field.onChange(opt.value);
                            setDistanceDropdownOpen(false);
                          }}
                          style={styles.dropdownItem}
                        >
                          <Text style={[styles.dropdownItemText, field.value === opt.value && styles.dropdownItemActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {errors.targetDistance ? <Text style={styles.error}>{errors.targetDistance.message}</Text> : null}
                </View>
              )}
            />

            {(targetDistance === 'ultra' || targetDistance === 'custom') && (
              <>
                <Text style={styles.label}>Distância em km</Text>
                <Controller
                  control={control}
                  name="customDistance"
                  render={({ field }) => (
                    <>
                      <TextInput
                        style={styles.input}
                        value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                        onChangeText={field.onChange}
                        keyboardType="decimal-pad"
                        placeholder="Ex.: 61"
                        placeholderTextColor={colors.textMuted}
                      />
                      {errors.customDistance ? <Text style={styles.error}>{errors.customDistance.message}</Text> : null}
                    </>
                  )}
                />
              </>
            )}
          </View>

          <View style={styles.terrainCard}>
            <View style={styles.terrainHeader}>
              <Text style={styles.terrainTitle}>Terreno principal</Text>
              <Pressable onPress={() => setTerrainInfoVisible(true)} accessibilityRole="button" accessibilityLabel="O que é cada terreno?">
                <CircleHelp style={{ marginTop: -5 }} size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <Controller
              control={control}
              name="terrain"
              render={({ field }) => (
                <View>
                  {TERRAIN_CARDS.map((card) => (
                    <SelectableCard
                      key={card.value}
                      selected={field.value === card.value}
                      onPress={() => field.onChange(card.value)}
                      icon={TERRAIN_ICON_MAP[card.icon]}
                      title={card.title}
                    />
                  ))}
                </View>
              )}
            />

            {errors.terrain ? <Text style={styles.error}>{errors.terrain.message}</Text> : null}
          </View>

          <View style={styles.datesCard}>
            <Text style={styles.sectionTitleInCard}>Datas</Text>

            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DateField label="Data de início" value={field.value} onChange={field.onChange} minimumDate={new Date()} error={errors.startDate?.message} />
              )}
            />
            <Controller
              control={control}
              name="raceDate"
              render={({ field }) => (
                <DateField label="Data da prova" value={field.value} onChange={field.onChange} minimumDate={new Date()} error={errors.raceDate?.message} />
              )}
            />

            {weeksUntilRace ? (
              <View style={styles.weeksCountdown}>
                <Clock size={16} color={colors.neon} />
                <Text style={styles.weeksCountdownText}>{weeksUntilRace} semanas até a prova</Text>
              </View>
            ) : null}
          </View>

          {/* SEÇÃO: Treino semanal */}
          <View style={styles.trainingCard}>
            <Text style={styles.sectionTitleInCard}>Treino semanal</Text>

            <Text style={styles.label}>Dias de treino por semana</Text>
            <Controller
              control={control}
              name="daysPerWeek"
              render={({ field }) => (
                <View style={styles.dropdownWrap}>
                  <Pressable style={styles.dropdown} onPress={() => setDaysDropdownOpen(!daysDropdownOpen)} accessibilityRole="button">
                    <Text style={[styles.dropdownText, !field.value && styles.dropdownPlaceholder]}>
                      {field.value ? `${field.value}x/semana` : 'Selecione'}
                    </Text>
                    <ChevronDown size={18} color={colors.textMuted} />
                  </Pressable>
                  {daysDropdownOpen ? (
                    <View style={styles.dropdownList}>
                      {DAYS_PER_WEEK_OPTIONS.map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => {
                            setValue('daysPerWeek', n, { shouldValidate: true });
                            setDaysDropdownOpen(false);
                          }}
                          style={styles.dropdownItem}
                        >
                          <Text style={[styles.dropdownItemText, field.value === n && styles.dropdownItemActive]}>{n}x/semana</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {errors.daysPerWeek ? <Text style={styles.error}>{errors.daysPerWeek.message}</Text> : null}
                </View>
              )}
            />

            <Text style={styles.label}>Dia do longão</Text>
            <Controller
              control={control}
              name="longRunDay"
              render={({ field }) => (
                <View style={styles.dropdownWrap}>
                  <Pressable style={styles.dropdown} onPress={() => setLongRunDropdownOpen(!longRunDropdownOpen)} accessibilityRole="button">
                    <Text style={[styles.dropdownText, !field.value && styles.dropdownPlaceholder]}>
                      {field.value || 'Selecione o dia'}
                    </Text>
                    <ChevronDown size={18} color={colors.textMuted} />
                  </Pressable>
                  {longRunDropdownOpen ? (
                    <View style={styles.dropdownList}>
                      {WEEKDAYS.map((day) => (
                        <Pressable
                          key={day}
                          onPress={() => {
                            field.onChange(day);
                            setLongRunDropdownOpen(false);
                          }}
                          style={styles.dropdownItem}
                        >
                          <Text style={[styles.dropdownItemText, field.value === day && styles.dropdownItemActive]}>{day}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            />
          </View>

          {/* SEÇÃO: Tempos Anteriores */}
          <View style={styles.timesCard}>
            <PreviousTimesWheel
              values={{
                time5k: values.time5k,
                no5k: values.no5k,
                time10k: values.time10k,
                no10k: values.no10k,
                time21k: values.time21k,
                no21k: values.no21k,
                time42k: values.time42k,
                no42k: values.no42k,
              }}
              onChange={(field, value) => setValue(field as keyof AiEvoFormValues, value as never)}
            />
          </View>

          {/* SEÇÃO: Teste de 3km */}
          <View style={styles.test3kmCard}>
            <View style={styles.titleRowCenter}>
              <Text style={styles.sectionTitleInCard}>Teste de 3 km</Text>
              <Pressable onPress={() => setTest3kmInfoVisible(true)} accessibilityRole="button" accessibilityLabel="Como fazer o teste?">
                <CircleHelp size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.badgeCenterWrap}>
              <Badge label="OBRIGATÓRIO" tone="error" variant="pill" />
            </View>
            <Text style={styles.sectionDescInCard}>Seu resultado define suas zonas de treino.</Text>

            <View style={styles.instructionBox}>
              <Text style={styles.instructionTitle}>Corra 3 km</Text>
              <Text style={styles.instructionText}>No seu melhor ritmo sustentável e constante.</Text>
            </View>

            <Text style={[styles.label, styles.labelCenter]}>Tempo total dos 3 km</Text>
            <Test3kmWheel
              value={values.test3kmTime}
              onChange={(mmss) => setValue('test3kmTime', mmss)}
              onPaceChange={(pace) => setValue('test3kmPace', pace)}
            />
            {errors.test3kmTime ? <Text style={styles.error}>{errors.test3kmTime.message}</Text> : null}

            <Text style={styles.paceText}>
              Seu pace: <Text style={styles.paceValue}>{values.test3kmPace || '--:--'}</Text> /km
            </Text>
          </View>

          {/* SEÇÃO: Objetivo */}
          <View style={styles.objectiveCard}>
            <View style={styles.titleRowCenter}>
              <Text style={styles.sectionTitleInCard}>Objetivo</Text>
            </View>
            <View style={styles.badgeCenterWrap}>
              <Badge label="OBRIGATÓRIO" tone="error" variant="pill" />
            </View>
            <Text style={styles.sectionDescInCard}>O que você quer conquistar?</Text>

            <Controller
              control={control}
              name="objective"
              render={({ field }) => (
                <TextInput
                  style={[styles.objectiveInput, errors.objective ? styles.inputError : null]}
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  placeholder="Ex.: Correr 10 km abaixo de 50 min"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="sentences"
                  multiline
                  textAlign="center"
                  textAlignVertical="center"
                />
              )}
            />
            {errors.objective ? <Text style={styles.error}>{errors.objective.message}</Text> : null}

            <Text style={[styles.objectiveHint, styles.objectiveHintCenter]}>
              Pode ser uma prova, um tempo, uma distância ou uma meta.
            </Text>
          </View>

          <NeonButton label="Gerar Planilha" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
        </ScrollView>
      </KeyboardAvoidingView>

      <LevelInfoModal visible={levelInfoVisible} onClose={() => setLevelInfoVisible(false)} />
      <TerrainInfoModal visible={terrainInfoVisible} onClose={() => setTerrainInfoVisible(false)} />
      <Test3kmInfoModal visible={test3kmInfoVisible} onClose={() => setTest3kmInfoVisible(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  title: { color: colors.neon, fontSize: 28, ...fontWeight('800'), textAlign: 'center', marginTop: spacing.xl },
  subtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  inputsCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sectionTitleInCard: { color: colors.textPrimary, fontSize: 18, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.xs },
  sectionDescInCard: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: spacing.lg },
  levelCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  levelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  levelTitle: { color: colors.textPrimary, fontSize: 18, ...fontWeight('800') },
  error: { color: colors.error, fontSize: fontSizes.caption, marginTop: spacing.xs },
  provaCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  label: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.sm },
  dropdownWrap: { marginBottom: spacing.lg },
  dropdown: {
    backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52,
  },
  dropdownText: { color: colors.textPrimary, fontSize: fontSizes.base },
  dropdownPlaceholder: { color: colors.textMuted },
  dropdownList: {
    backgroundColor: colors.cardElevated, borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A2A', marginTop: -spacing.md, marginBottom: spacing.lg, overflow: 'hidden' as const,
  },
  dropdownItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  dropdownItemText: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('400') },
  dropdownItemActive: { color: colors.neon, ...fontWeight('700') },
  input: {
    height: 52, backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 12, color: colors.textPrimary, fontSize: fontSizes.base,
    paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  inputError: { borderColor: colors.error },
  terrainCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  terrainHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  terrainTitle: { color: colors.textPrimary, fontSize: 18, ...fontWeight('800') },
  datesCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  trainingCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  timesCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  titleRowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  badgeCenterWrap: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xs },
  labelCenter: { textAlign: 'center' },
  instructionBox: { backgroundColor: colors.cardElevated, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(204,255,0,0.2)', padding: spacing.lg, marginVertical: spacing.lg, alignItems: 'center' },
  instructionTitle: { color: colors.neon, fontSize: 16, ...fontWeight('800'), marginBottom: spacing.xs },
  instructionText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  paceText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: spacing.md },
  paceValue: { color: colors.neon, ...fontWeight('700') },
  test3kmCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  objectiveCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  objectiveInput: { minHeight: 90, backgroundColor: colors.cardElevated, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', color: colors.textPrimary, fontSize: fontSizes.base, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: spacing.md },
  objectiveHint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, lineHeight: 18 },
  objectiveHintCenter: { textAlign: 'center' },
  weeksCountdown: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(204,255,0,0.08)', borderColor: 'rgba(204,255,0,0.2)', borderWidth: 1,
    borderRadius: 12, padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg,
  },
  weeksCountdownText: { color: colors.neon, fontSize: 14, ...fontWeight('600') },
});
