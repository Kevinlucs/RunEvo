import { create } from 'zustand';
import type { AthleteInput } from '@/domain/motor-evo/types';
import type { Plan } from '@/domain/motor-evo/plan-generator';

/**
 * Ponte entre as telas do fluxo de geração (formulário → loading → prévia) —
 * evita serializar `AthleteInput`/`Plan` inteiros em params de rota.
 */
interface PlanGenerationState {
  pendingInput: AthleteInput | null;
  generatedPlan: Plan | null;
  /** true quando a planilha nova saiu idêntica à ativa (docs/fase-3-brief.md §4.3). */
  identicalToActive: boolean;
  setPendingInput: (input: AthleteInput) => void;
  setGeneratedPlan: (plan: Plan, identicalToActive: boolean) => void;
  clear: () => void;
}

export const usePlanGenerationStore = create<PlanGenerationState>((set) => ({
  pendingInput: null,
  generatedPlan: null,
  identicalToActive: false,
  setPendingInput: (input) => set({ pendingInput: input }),
  setGeneratedPlan: (plan, identicalToActive) => set({ generatedPlan: plan, identicalToActive }),
  clear: () => set({ pendingInput: null, generatedPlan: null, identicalToActive: false }),
}));
