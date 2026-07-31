import { z } from 'zod';
import { uuid, isoTimestamp } from './common';

export const checkinSchema = z.object({
  id: uuid,
  plan_id: uuid,
  user_id: uuid,
  week_number: z.number().int(),
  current_weight_kg: z.number().nullable().default(null),
  fatigue_level: z.number().int().min(1).max(10).nullable().default(null),
  pain_level: z.number().int().min(0).max(10).nullable().default(null),
  feeling: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  ai_analysis: z.record(z.unknown()).default({}),
  adjustment: z.record(z.unknown()).default({}),
  // §22 (Fase 5): edição manual de um treino invalida o check-in que já
  // considerou aquela semana — o atleta precisa refazer. Mantido como linha
  // histórica (não apagado) com o motivo.
  invalidated: z.boolean().default(false),
  invalidated_reason: z.string().nullable().default(null),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});
export type Checkin = z.infer<typeof checkinSchema>;
