import { supabase } from '@/lib/supabase';
import type { AISuggestion } from '@/domain/motor-evo/adaptive-training';
import { parseCheckinCoachResponse, type CheckinCoachRequest } from './checkin-coach.schema';

/**
 * docs/fase-5-brief.md Grupo 1/2.3. Chama a Edge Function `checkin-coach` (IA
 * real) e devolve a sugestão já validada — NUNCA a recomendação final: quem
 * decide é `normalizeAICheckinRecommendation` (guardrails §18), chamado por
 * quem consome este provider. Qualquer falha (rede, timeout, contrato) deve
 * ser tratada pelo chamador como "segue só com a recomendação local" — aqui
 * só propaga o erro.
 */
export interface CheckinCoachProvider {
  suggest(input: CheckinCoachRequest): Promise<AISuggestion>;
}

export const remoteCheckinCoachProvider: CheckinCoachProvider = {
  async suggest(input) {
    const { data, error } = await supabase.functions.invoke<unknown>('checkin-coach', { body: input });
    if (error) throw error;
    return parseCheckinCoachResponse(data);
  },
};
