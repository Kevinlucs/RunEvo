import { z } from 'zod';

/**
 * Contrato Zod da Edge Function `checkin-coach` (docs/fase-5-brief.md Grupo 1).
 * A função já valida a saída da IA no servidor antes de responder — este
 * schema é a segunda camada, do lado do cliente, para o caso de a função
 * responder algo fora do contrato (versão desalinhada, erro de rede
 * disfarçado de 200 etc.). Falha aqui cai no fallback local, igual a
 * qualquer outra falha (docs/motor-evo-specification.md §1/§9).
 */
export const checkinCoachRequestSchema = z.object({
  weekNumber: z.number().int().nonnegative(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    completedKm: z.number().nonnegative(),
    plannedKm: z.number().nonnegative(),
    averageEffort: z.number().nonnegative(),
    completionRate: z.number().nonnegative(),
  }),
  feedback: z.object({
    effort: z.number().int().min(1).max(10),
    feeling: z.enum(['leve', 'normal', 'pesado', 'muito_pesado']),
    pain: z.boolean(),
    notes: z.string().optional().default(''),
  }),
  planContext: z.object({
    raceType: z.string(),
    phase: z.string(),
    weeksToRace: z.number().int(),
  }),
});
export type CheckinCoachRequest = z.infer<typeof checkinCoachRequestSchema>;

export const checkinCoachRecommendationSchema = z
  .object({
    action: z.enum(['maintain', 'reduce', 'recovery', 'slight_increase']),
    adjustmentPercent: z.number(),
    weeksToAdjust: z.number().int(),
    reason: z.string(),
    coachTip: z.string().default(''),
    messageToUser: z.string(),
    confidence: z.enum(['baixa', 'média', 'alta']),
  })
  .passthrough();
export type CheckinCoachRecommendation = z.infer<typeof checkinCoachRecommendationSchema>;

const checkinCoachResponseSchema = z.object({
  success: z.literal(true),
  recommendation: checkinCoachRecommendationSchema,
});
export type CheckinCoachResponse = z.infer<typeof checkinCoachResponseSchema>;

export function parseCheckinCoachResponse(data: unknown): CheckinCoachRecommendation {
  return checkinCoachResponseSchema.parse(data).recommendation;
}
