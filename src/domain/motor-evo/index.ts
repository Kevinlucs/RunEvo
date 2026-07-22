import { buildFallbackBlueprint } from './blueprint';
import { assemblePlan, type Plan } from './plan-generator';
import { validateAndFixPlan } from './validation';
import type { AthleteInput } from './types';

/**
 * Fachada de orquestração (docs/legacy-audit.md §13.7).
 * Mapeamento: `generatePlan` (ai-coach.js:2772-2800) → plan-generator.ts (assemblePlan) + index.ts (aqui).
 *
 * ESCOPO — só o caminho local/determinístico: a IA (`generateBlueprint`/
 * `callGeminiAPI` no legado) não é portada aqui. `docs/motor-evo-specification.md`
 * §1 já deixa claro que a IA nunca produz a planilha final — ela só entraria como
 * uma alternativa de `blueprint` fornecida de fora (`services/ai/*`, Fase 3);
 * este `generatePlan` sempre usa `buildFallbackBlueprint`, que é o único caminho
 * testado nos golden da Fase 2 (o harness rejeita `fetch` de propósito).
 */
export function generatePlan(userData: AthleteInput): Plan {
  const blueprint = buildFallbackBlueprint(userData);
  const plan = assemblePlan(userData, blueprint);
  return validateAndFixPlan(plan, plan.userData) as Plan;
}

export type { Plan } from './plan-generator';
