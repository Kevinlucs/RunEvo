import { resolveBlueprint } from '@/services/ai/plan-blueprint.provider';
import { assemblePlan, type Plan } from '@/domain/motor-evo/plan-generator';
import { validateAndFixPlan } from '@/domain/motor-evo/validation';
import type { AthleteInput } from '@/domain/motor-evo/types';

/**
 * docs/motor-evo-specification.md §20 (`generatePlan`), com o blueprint
 * resolvido pelo caminho de IA/local da Fase 3 (`resolveBlueprint`) em vez do
 * `buildFallbackBlueprint` fixo de `src/domain/motor-evo/index.ts` (que só
 * cobre o caminho local — correto pros golden da Fase 2, mas aqui o app
 * precisa poder tentar a IA de verdade).
 *
 * Etapas emitidas (docs/fase-3-brief.md §4.1) refletem o progresso REAL do
 * pipeline (não um timer falso) — só 3 fronteiras genuinamente
 * assíncronas/sequenciais existem (`resolveBlueprint` → `assemblePlan` →
 * `validateAndFixPlan`); as 7 etapas do enunciado ("analisando atleta ·
 * interpretando objetivo · calculando zonas · criando estratégia ·
 * construindo semanas · validando · calculando score") são cálculos
 * internos e síncronos dentro dessas 3 fronteiras (não expostos
 * individualmente pelo motor), então foram agrupadas por fronteira real —
 * decisão tomada sozinho, sinalizada para validação no relato da Fase 3.
 */
export type GenerationStep = 'analisando' | 'construindo' | 'validando';

export const GENERATION_STEP_LABELS: Record<GenerationStep, string> = {
  analisando: 'Analisando atleta, interpretando objetivo e calculando zonas...',
  construindo: 'Criando estratégia e construindo as semanas...',
  validando: 'Validando o plano e calculando o quality score...',
};

export async function generatePlanWithProgress(
  input: AthleteInput,
  onStep?: (step: GenerationStep) => void,
): Promise<Plan> {
  onStep?.('analisando');
  const blueprint = await resolveBlueprint(input);

  onStep?.('construindo');
  const plan = assemblePlan(input, blueprint);

  onStep?.('validando');
  return validateAndFixPlan(plan, plan.userData);
}
