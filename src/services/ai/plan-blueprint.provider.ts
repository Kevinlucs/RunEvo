import { supabase } from '@/lib/supabase';
import {
  buildBlueprintPrompt,
  buildFallbackBlueprint,
  normalizeBlueprint,
  type PlanBlueprint,
  type BlueprintAthleteInput,
} from '@/domain/motor-evo/blueprint';
import { aiBlueprintResponseSchema } from './blueprint.schema';
import { classifyGoalViability, type GoalViabilityResult } from '@/services/viability/goal-viability';
import { buildViabilityPromptSection, resolveViabilityExplanation } from '@/services/viability/viability-explanation';

/**
 * docs/fase-3-brief.md §2.3. A IA (estrategista) nunca produz a planilha final
 * — só o blueprint. `resolveBlueprint` tenta o provider remoto; QUALQUER falha
 * (rede, timeout, JSON inválido, Zod reprovando) cai no local. O atleta nunca
 * fica bloqueado (docs/motor-evo-specification.md §1/§9).
 *
 * docs/fase-8-brief.md Grupo 2 — a viabilidade (`classifyGoalViability`, fora
 * do motor) é calculada aqui, ANTES da chamada de IA, e injetada no mesmo
 * prompt (`buildViabilityPromptSection`) — nenhuma chamada de IA nova. A
 * explicação final (`viabilityExplanation`) já sai validada/com fallback
 * (`resolveViabilityExplanation`) em `BlueprintResolution`.
 */
export type BlueprintPromptInput = BlueprintAthleteInput;

export interface BlueprintResolution {
  blueprint: PlanBlueprint;
  viability: GoalViabilityResult;
  viabilityExplanation: string;
}

export interface PlanBlueprintProvider {
  generate(input: BlueprintPromptInput): Promise<BlueprintResolution>;
}

/** ai-coach.js:836-853 (`parseJSONResponse`) — limpa cercas de markdown e extrai o objeto JSON. */
function parseJSONResponse(text: string): unknown {
  let cleaned = String(text || '').trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

interface EdgeFunctionSuccessBody {
  success: true;
  model: string;
  text: string;
}

/**
 * ai-coach.js:801-867 (`callGeminiAPI` + `generateBlueprint`) — a chamada de
 * rede em si (Edge Function `generate-plan`), parse, validação Zod e
 * `normalizeBlueprint`. Backend/retry/fallback de modelo ficam na função
 * (supabase/functions/generate-plan/index.ts); aqui só o lado cliente.
 */
export const remoteBlueprintProvider: PlanBlueprintProvider = {
  async generate(input) {
    const viability = classifyGoalViability(input);
    const prompt = buildBlueprintPrompt(input) + buildViabilityPromptSection(viability);

    const { data, error } = await supabase.functions.invoke<EdgeFunctionSuccessBody>('generate-plan', {
      body: { prompt },
    });

    if (error) throw error;
    if (!data?.success || !data.text) throw new Error('Resposta vazia da IA.');

    const parsed = parseJSONResponse(data.text);
    const validated = aiBlueprintResponseSchema.parse(parsed);

    return {
      blueprint: normalizeBlueprint(validated, input, 'ai'),
      viability,
      viabilityExplanation: resolveViabilityExplanation(validated.viabilityExplanation, viability),
    };
  },
};

/** ai-coach.js:949-1049 (`buildFallbackBlueprint`, já portado — Grupo C da Fase 2). */
export const localBlueprintProvider: PlanBlueprintProvider = {
  async generate(input) {
    const viability = classifyGoalViability(input);
    return {
      blueprint: buildFallbackBlueprint(input),
      viability,
      // sem IA neste caminho: sempre o fallback determinístico.
      viabilityExplanation: resolveViabilityExplanation(undefined, viability),
    };
  },
};

/**
 * ai-coach.js:855-867 (`generateBlueprint`'s try/catch) — tenta remoto,
 * qualquer falha cai no local. `source` já registrado por cada provider
 * (`'ai'` no normalizeBlueprint, `'local'` no buildFallbackBlueprint — enum
 * limpo, decisão da Fase 2).
 */
export async function resolveBlueprint(
  input: BlueprintPromptInput,
  remote: PlanBlueprintProvider = remoteBlueprintProvider,
  local: PlanBlueprintProvider = localBlueprintProvider,
): Promise<BlueprintResolution> {
  try {
    return await remote.generate(input);
  } catch (error) {
    console.warn('IA Evo indisponível ou blueprint inválido. Usando blueprint local.', error);
    return local.generate(input);
  }
}
