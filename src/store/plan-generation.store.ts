import { create } from 'zustand';
import type { AthleteInput } from '@/domain/motor-evo/types';
import type { Plan } from '@/domain/motor-evo/plan-generator';
import type { GoalViabilityResult } from '@/services/viability/goal-viability';

/**
 * Ponte entre as telas do fluxo de geração (formulário → loading → prévia) —
 * evita serializar `AthleteInput`/`Plan` inteiros em params de rota.
 *
 * `viability`/`viabilityExplanation` (docs/fase-8-brief.md Grupo 2) vêm
 * juntos do mesmo `generatePlanWithProgress` — nunca recalculados na UI.
 */
interface PlanGenerationState {
  pendingInput: AthleteInput | null;
  generatedPlan: Plan | null;
  viability: GoalViabilityResult | null;
  viabilityExplanation: string | null;
  /** true quando a planilha nova saiu idêntica à ativa (docs/fase-3-brief.md §4.3). */
  identicalToActive: boolean;
  setPendingInput: (input: AthleteInput) => void;
  setGeneratedPlan: (
    plan: Plan,
    identicalToActive: boolean,
    viability: GoalViabilityResult,
    viabilityExplanation: string,
  ) => void;
  clear: () => void;
}

export const usePlanGenerationStore = create<PlanGenerationState>((set) => ({
  pendingInput: null,
  generatedPlan: null,
  viability: null,
  viabilityExplanation: null,
  identicalToActive: false,
  setPendingInput: (input) => set({ pendingInput: input }),
  setGeneratedPlan: (plan, identicalToActive, viability, viabilityExplanation) =>
    set({ generatedPlan: plan, identicalToActive, viability, viabilityExplanation }),
  clear: () =>
    set({ pendingInput: null, generatedPlan: null, viability: null, viabilityExplanation: null, identicalToActive: false }),
}));
