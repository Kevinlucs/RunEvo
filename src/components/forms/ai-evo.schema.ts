import { z } from 'zod';

/**
 * Formulário IA Evo (docs/fase-3-brief.md §Grupo 3). Um schema por seção,
 * mesclados num só resolver — RHF valida no submit e on-blur.
 *
 * Boundary de tipos (decisão da Fase 2, reforçada pelo brief §Grupo 3): os
 * VALORES do formulário já são os do legado (`targetDistance` string
 * numérica crua, `terrain` enum do motor) — a UI mostra rótulos amigáveis
 * (ver `DISTANCE_OPTIONS`/`TERRAIN_OPTIONS` abaixo), mas nunca inventa um
 * valor "bonito" que precise de tradução depois. Nada de normalizar dentro
 * do motor.
 */

const personalSchema = z.object({
  age: z.coerce.number().int().min(10, 'Idade mínima 10 anos').max(100, 'Idade máxima 100 anos').optional(),
  height: z.coerce.number().min(100, 'Altura mínima 100cm').max(250, 'Altura máxima 250cm').optional(),
  weight: z.coerce.number().min(30, 'Peso mínimo 30kg').max(300, 'Peso máximo 300kg').optional(),
  level: z.enum(['iniciante', 'intermediário', 'avançado'], { required_error: 'Selecione seu nível' }),
});

const raceSchema = z.object({
  targetDistance: z.enum(['5', '10', '21', '42', 'ultra', 'custom'], {
    required_error: 'Selecione a distância alvo',
  }),
  customDistance: z.coerce.number().positive('Informe uma distância válida').optional(),
  terrain: z.enum(['plano', 'misto', 'elevado'], { required_error: 'Selecione o terreno' }),
  startDate: z.string().min(1, 'Informe a data de início'),
  raceDate: z.string().min(1, 'Informe a data da prova'),
  daysPerWeek: z.coerce.number().int().min(2, 'Mínimo 2 dias').max(6, 'Máximo 6 dias'),
});

const previousTimesSchema = z.object({
  time5k: z.string().optional(),
  no5k: z.boolean().optional(),
  time10k: z.string().optional(),
  no10k: z.boolean().optional(),
  time21k: z.string().optional(),
  no21k: z.boolean().optional(),
  time42k: z.string().optional(),
  no42k: z.boolean().optional(),
});

const testSchema = z.object({
  test3kmTime: z.string().optional(),
  test3kmPace: z.string().optional(),
});

const objectiveSchema = z.object({
  objective: z.string().max(500, 'Máximo 500 caracteres').optional(),
});

const baseFormSchema = personalSchema
  .merge(raceSchema)
  .merge(previousTimesSchema)
  .merge(testSchema)
  .merge(objectiveSchema);

/** Regras entre campos (distância personalizada, datas, teste obrigatório). */
export const aiEvoFormSchema = baseFormSchema.superRefine((data, ctx) => {
  if ((data.targetDistance === 'ultra' || data.targetDistance === 'custom') && !data.customDistance) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe a distância personalizada (km)',
      path: ['customDistance'],
    });
  }

  if (data.startDate && data.raceDate) {
    const start = new Date(data.startDate);
    const race = new Date(data.raceDate);
    if (race <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A data da prova deve ser depois da data de início',
        path: ['raceDate'],
      });
    }
  }

  // Teste de 3km é obrigatório (docs/motor-evo-specification.md §4).
  if (!data.test3kmTime && !data.test3kmPace) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe o tempo total ou o pace médio do teste de 3km',
      path: ['test3kmTime'],
    });
  }
});

export type AiEvoFormValues = z.infer<typeof baseFormSchema>;

export const LEVEL_OPTIONS: { value: AiEvoFormValues['level']; label: string }[] = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediário', label: 'Intermediário' },
  { value: 'avançado', label: 'Avançado' },
];

/** Rótulo amigável ↔ valor cru do legado (parseNumber-friendly: '5'|'10'|'21'|'42'). */
export const DISTANCE_OPTIONS: { value: AiEvoFormValues['targetDistance']; label: string }[] = [
  { value: '5', label: '5K' },
  { value: '10', label: '10K' },
  { value: '21', label: '21K (Meia Maratona)' },
  { value: '42', label: '42K (Maratona)' },
  { value: 'ultra', label: 'Ultramaratona' },
  { value: 'custom', label: 'Distância personalizada' },
];

export const TERRAIN_OPTIONS: { value: AiEvoFormValues['terrain']; label: string }[] = [
  { value: 'plano', label: 'Plano' },
  { value: 'misto', label: 'Misto' },
  { value: 'elevado', label: 'Elevado' },
];

export const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6] as const;

export const DEFAULT_FORM_VALUES: Partial<AiEvoFormValues> = {
  level: 'iniciante',
  targetDistance: '5',
  terrain: 'plano',
  daysPerWeek: 3,
};
