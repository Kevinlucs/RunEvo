import { useEffect, useRef } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, Text, StyleSheet } from 'react-native';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { TextField } from '@/components/ui/TextField';
import { NeonButton } from '@/components/ui/NeonButton';
import { ChoiceField } from '@/components/forms/ChoiceField';
import { DateField } from '@/components/forms/DateField';
import { PreviousTimeField } from '@/components/forms/PreviousTimeField';
import {
  aiEvoFormSchema,
  type AiEvoFormValues,
  LEVEL_OPTIONS,
  DISTANCE_OPTIONS,
  TERRAIN_OPTIONS,
  DAYS_PER_WEEK_OPTIONS,
  DEFAULT_FORM_VALUES,
} from '@/components/forms/ai-evo.schema';
import { draftRepository } from '@/repositories/draft.repository';
import { useAuthStore } from '@/store/auth.store';
import { usePlanGenerationStore } from '@/store/plan-generation.store';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';
import type { AthleteInput } from '@/domain/motor-evo/types';

const DAYS_PER_WEEK_CHOICES = DAYS_PER_WEEK_OPTIONS.map((n) => ({ value: String(n), label: `${n}x/semana` }));

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
          <Controller
            control={control}
            name="level"
            render={({ field }) => (
              <ChoiceField label="Nível" value={field.value} onChange={field.onChange} options={LEVEL_OPTIONS} error={errors.level?.message} />
            )}
          />

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
          <Controller
            control={control}
            name="terrain"
            render={({ field }) => (
              <ChoiceField label="Terreno" value={field.value} onChange={field.onChange} options={TERRAIN_OPTIONS} error={errors.terrain?.message} />
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

          <Text style={styles.sectionTitle}>Tempos anteriores</Text>
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

          <Text style={styles.sectionTitle}>Teste de 3km (obrigatório)</Text>
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
          <Controller
            control={control}
            name="test3kmPace"
            render={({ field }) => (
              <TextField
                label="Ou pace médio (se já souber)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                placeholder="mm:ss/km"
                keyboardType="numbers-and-punctuation"
              />
            )}
          />

          <Text style={styles.sectionTitle}>Objetivo</Text>
          <Controller
            control={control}
            name="objective"
            render={({ field }) => (
              <TextField
                label="Conte seu objetivo (opcional)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                placeholder="Ex: sub 50 no 10K, terminar com segurança..."
                autoCapitalize="sentences"
                error={errors.objective?.message}
              />
            )}
          />

          <NeonButton label="Gerar planilha" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), marginTop: spacing.xl },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm, marginBottom: spacing.xl },
  sectionTitle: {
    color: colors.neon,
    fontSize: fontSizes.lg,
    ...fontWeight('700'),
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
