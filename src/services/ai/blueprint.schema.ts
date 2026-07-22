import { z } from 'zod';

/**
 * Contrato Zod da resposta da IA (docs/motor-evo-specification.md §8) — o
 * JSON pequeno que a IA retorna (NÃO o `PlanBlueprint` interno completo, que
 * só existe depois de `normalizeBlueprint` mesclar isto com o cálculo local
 * de `goalContext`/limites de segurança). Tolerante a campos extras
 * (`.passthrough()`), estrito nos tipos — qualquer campo com tipo errado
 * reprova a validação inteira e cai no fallback local (docs/fase-3-brief.md
 * §2.3: "qualquer falha da IA cai no local").
 */

const athleteAnalysisSchema = z
  .object({
    detectedLevel: z.string(),
    riskLevel: z.enum(['baixo', 'médio', 'alto', 'muito alto']),
    goalFeasibility: z.string(),
    mainStrength: z.string(),
    mainWeakness: z.string(),
    focus: z.string(),
    coachSummary: z.string(),
  })
  .passthrough();

const blueprintStrategySchema = z
  .object({
    initialWeeklyKm: z.number(),
    peakWeeklyKm: z.number(),
    initialLongRunKm: z.number(),
    peakLongRunKm: z.number(),
    recoveryEveryWeeks: z.number(),
    taperWeeks: z.number(),
  })
  .passthrough();

const phaseDistributionEntrySchema = z
  .object({
    phase: z.enum(['Base', 'Resistência', 'Pico', 'Polimento']),
    startWeek: z.number(),
    endWeek: z.number(),
  })
  .passthrough();

const engineCalibrationSchema = z
  .object({
    progressionStyle: z.enum(['conservadora', 'equilibrada', 'agressiva']),
    recoveryPriority: z.enum(['baixa', 'média', 'alta']),
    intensityBias: z.enum(['baixo', 'moderado', 'alto']),
  })
  .passthrough();

export const aiBlueprintResponseSchema = z
  .object({
    athleteAnalysis: athleteAnalysisSchema,
    strategy: blueprintStrategySchema,
    paceZones: z.record(z.string()),
    phaseDistribution: z.array(phaseDistributionEntrySchema),
    warnings: z.array(z.string()),
    engineCalibration: engineCalibrationSchema,
  })
  .passthrough();

export type AIBlueprintResponse = z.infer<typeof aiBlueprintResponseSchema>;
