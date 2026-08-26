import { useEffect, useRef, useMemo } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, Text, View, StyleSheet } from 'react-native';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { TextField } from '@/components/ui/TextField';
import { NeonButton } from '@/components/ui/NeonButton';
import { ChoiceField } from '@/components/forms/ChoiceField';
import { DateField } from '@/components/forms/DateField';
import { PreviousTimeField } from '@/components/forms/PreviousTimeField';
import { SelectableCard } from '@/components/forms/SelectableCard';
import { SectionHeader } from '@/components/forms/SectionHeader';
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

const DAYS_PER_WEEK_CHOICES = DAYS_PER_WEEK_OPTIONS.map((n) => ({ value: String(n), label: `${n}x/semana` }));

const LEVEL_CARDS = [
  { value: 'iniciante', emoji: '🌱', title: 'Iniciante', description: 'Começando a correr' },
  { value: 'intermediário', emoji: '💪', title: 'Intermediário', description: 'Correndo regularmente' },
  { value: 'avançado', emoji: '🔥', title: 'Avançado', description: 'Competidor experiente' },
];

const TERRAIN_CARDS = [
  { value: 'plano', emoji: '↔️', title: 'Plano', description: 'Baixa elevação • até 5 m/km' },
  { value: 'misto', emoji: '⚡', title: 'Misto', description: 'Elevação moderada • 5 a 15 m/km' },
  { value: 'elevado', emoji: '▲', title: 'Elevado', description: 'Muitas subidas • acima de 15 m/km' },
];

export default function AiEvo(): JSX.Element {
  const userId = useAuthStore((s) => s.userId);
  const setPendingInput = usePlanGenerationStore((s) => s.setPendingInput);
  const draftLoaded = useRef(false);

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
    // Boundary de tipos: os valores do form já são os do legado
    // (targetDistance string crua, terrain enum do motor) — nada a traduzir
    // aqui além de montar o shape final de AthleteInput.
    const input: AthleteInput = { ...data };
    setPendingInput(input);
    router.push('/plan/generating');
  };

  return (
    <Screen>
      <AppHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>IA Evo</Text>
          <Text style={styles.subtitle}>
            Conte pra gente sobre você e sua prova. A IA (ou o motor local, se a IA não estiver disponível) monta sua
            planilha.
          </Text>

          {/* SEÇÃO: Dados do Corredor */}
          <SectionHeader emoji="📋" title="Dados do Corredor" description="Informações básicas sobre você" />

          <Controller
            control={control}
            name="age"
            render={({ field }) => (
              <TextField
                label="Idade"
                value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                onChangeText={field.onChange}
                keyboardType="number-pad"
                error={errors.age?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="height"
            render={({ field }) => (
              <TextField
                label="Altura (cm)"
                value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                onChangeText={field.onChange}
                keyboardType="number-pad"
                error={errors.height?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="weight"
            render={({ field }) => (
              <TextField
                label="Peso (kg)"
                value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                error={errors.weight?.message}
              />
            )}
          />

          <Text style={styles.fieldLabel}>Nível de experiência</Text>
          <Controller
            control={control}
            name="level"
            render={({ field }) => (
              <View style={styles.selectableCardsGroup}>
                {LEVEL_CARDS.map((card) => (
                  <SelectableCard
                    key={card.value}
                    selected={field.value === card.value}
                    onPress={() => field.onChange(card.value as 'iniciante' | 'intermediário' | 'avançado')}
                    emoji={card.emoji}
                    title={card.title}
                    description={card.description}
                  />
                ))}
                {errors.level ? <Text style={styles.error}>{errors.level.message}</Text> : null}
              </View>
            )}
          />

          {/* SEÇÃO: Prova */}
          <SectionHeader emoji="🏃" title="Prova" description="Detalhes sobre a corrida e o ciclo de treino" />

          <Controller
            control={control}
            name="targetDistance"
            render={({ field }) => (
              <ChoiceField
                label="Distância alvo"
                value={field.value}
                onChange={field.onChange}
                options={DISTANCE_OPTIONS}
                error={errors.targetDistance?.message}
              />
            )}
          />
          {(targetDistance === 'ultra' || targetDistance === 'custom') && (
            <Controller
              control={control}
              name="customDistance"
              render={({ field }) => (
                <TextField
                  label="Distância personalizada (km)"
                  value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                  onChangeText={field.onChange}
                  keyboardType="decimal-pad"
                  error={errors.customDistance?.message}
                />
              )}
            />
          )}

          <Text style={styles.fieldLabel}>Terreno principal</Text>
          <Controller
            control={control}
            name="terrain"
            render={({ field }) => (
              <View style={styles.selectableCardsGroup}>
                {TERRAIN_CARDS.map((card) => (
                  <SelectableCard
                    key={card.value}
                    selected={field.value === card.value}
                    onPress={() => field.onChange(card.value as 'plano' | 'misto' | 'elevado')}
                    emoji={card.emoji}
                    title={card.title}
                    description={card.description}
                  />
                ))}
                {errors.terrain ? <Text style={styles.error}>{errors.terrain.message}</Text> : null}
              </View>
            )}
          />

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

          <Controller
            control={control}
            name="daysPerWeek"
            render={({ field }) => (
              <ChoiceField
                label="Dias de treino por semana"
                value={field.value !== undefined ? String(field.value) : undefined}
                onChange={(v) => setValue('daysPerWeek', Number(v), { shouldValidate: true })}
                options={DAYS_PER_WEEK_CHOICES}
                error={errors.daysPerWeek?.message}
              />
            )}
          />

          {/* SEÇÃO: Tempos Anteriores */}
          <SectionHeader emoji="🕐" title="Tempos anteriores" description="Indique seus melhores tempos, se houver" />

          <PreviousTimeField
            label="5K"
            time={values.time5k ?? ''}
            onChangeTime={(v) => setValue('time5k', v)}
            no={Boolean(values.no5k)}
            onChangeNo={(v) => setValue('no5k', v)}
            checkboxLabel="Ainda não corri 5K"
            error={errors.time5k?.message}
          />
          <PreviousTimeField
            label="10K"
            time={values.time10k ?? ''}
            onChangeTime={(v) => setValue('time10k', v)}
            no={Boolean(values.no10k)}
            onChangeNo={(v) => setValue('no10k', v)}
            checkboxLabel="Ainda não corri 10K"
            error={errors.time10k?.message}
          />
          <PreviousTimeField
            label="21K"
            time={values.time21k ?? ''}
            onChangeTime={(v) => setValue('time21k', v)}
            no={Boolean(values.no21k)}
            onChangeNo={(v) => setValue('no21k', v)}
            checkboxLabel="Ainda não corri 21K"
            error={errors.time21k?.message}
          />
          <PreviousTimeField
            label="42K"
            time={values.time42k ?? ''}
            onChangeTime={(v) => setValue('time42k', v)}
            no={Boolean(values.no42k)}
            onChangeNo={(v) => setValue('no42k', v)}
            checkboxLabel="Ainda não corri 42K"
            error={errors.time42k?.message}
          />

          {/* SEÇÃO: Teste de 3km */}
          <SectionHeader emoji="⚡" title="Teste de 3km" required description="Corra 3km no seu ritmo normal para calibrar suas zonas" />

          <Controller
            control={control}
            name="test3kmTime"
            render={({ field }) => (
              <TextField
                label="Tempo total do teste"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                placeholder="mm:ss"
                keyboardType="numbers-and-punctuation"
                error={errors.test3kmTime?.message}
              />
            )}
          />

          {/* SEÇÃO: Objetivo */}
          <SectionHeader emoji="🎯" title="Objetivo" required description="Deixe um objetivo pessoal para motivação" />

          <Controller
            control={control}
            name="objective"
            render={({ field }) => (
              <TextField
                label="Seu objetivo"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                placeholder="Ex: sub 50 no 10K, terminar com segurança..."
                autoCapitalize="sentences"
                multiline
                error={errors.objective?.message}
              />
            )}
          />

          <NeonButton label="Gerar Planilha" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), marginTop: spacing.xl },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm, marginBottom: spacing.lg },
  fieldLabel: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('600'), marginBottom: spacing.sm, marginTop: spacing.md },
  selectableCardsGroup: { marginBottom: spacing.lg },
  error: { color: colors.error, fontSize: fontSizes.caption, marginTop: spacing.xs },
  weeksCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(204,255,0,0.08)',
    borderColor: 'rgba(204,255,0,0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  weeksCountdownText: { color: colors.neon, fontSize: 14, ...fontWeight('600') },
});
