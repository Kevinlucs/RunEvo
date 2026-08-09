/**
 * docs/fase-8-brief.md Grupo 3 — trial de 8 semanas, o gate de valor do
 * Plus. Puro e determinístico, fora da UI — a UI só lê o resultado destas
 * funções (`useEntitlement()` fornece `isPlus`; nenhuma tela decide o gate
 * sozinha).
 */
export const TRIAL_CONFIG = {
  /** Semanas cobertas pelo trial em planos "normais" (>= 16 semanas). */
  maxWeeks: 8,
  /**
   * Edge de plano curto: "8 semanas OU metade do plano, o que terminar
   * primeiro" — planos com menos de `maxWeeks * shortPlanDivisor` semanas
   * têm o trial cortado na metade em vez do teto fixo.
   */
  shortPlanDivisor: 2,
  /** Aviso discreto de fim de trial dispara quando faltam <= isto semanas. */
  endingNoticeWeeksBefore: 2,
} as const;

/** "8 semanas OU metade do plano, o que terminar primeiro" (docs/fase-8-brief.md Grupo 3). */
export function calculateTrialWeeks(totalWeeks: number): number {
  return Math.min(TRIAL_CONFIG.maxWeeks, Math.floor(totalWeeks / TRIAL_CONFIG.shortPlanDivisor));
}

export interface WeekAccessParams {
  weekNumber: number;
  currentWeekNumber: number;
  totalWeeks: number;
  isPlus: boolean;
}

/**
 * Regra confirmada com o usuário (Fase 8, Parada 2): "ver/planejar as
 * semanas futuras é Plus, mas o treino corrente nunca some" — mesmo Free,
 * mesmo depois do trial, a semana ATUAL continua acessível. Só o
 * planejamento de semanas futuras além do trial é bloqueado.
 */
export function isWeekAccessible({ weekNumber, currentWeekNumber, totalWeeks, isPlus }: WeekAccessParams): boolean {
  if (isPlus) return true;
  if (weekNumber <= calculateTrialWeeks(totalWeeks)) return true;
  return weekNumber === currentWeekNumber;
}

export interface TrialNoticeParams {
  currentWeekNumber: number;
  totalWeeks: number;
  isPlus: boolean;
}

/**
 * Aviso discreto só quando faltar pouco (~2 semanas) para o fim do trial —
 * nunca um contador permanente. Some de novo depois que o trial acaba (a
 * própria tela bloqueada já comunica isso).
 */
export function shouldShowTrialEndingNotice({ currentWeekNumber, totalWeeks, isPlus }: TrialNoticeParams): boolean {
  if (isPlus) return false;
  const trialWeeks = calculateTrialWeeks(totalWeeks);
  const weeksRemaining = trialWeeks - currentWeekNumber;
  return weeksRemaining >= 0 && weeksRemaining <= TRIAL_CONFIG.endingNoticeWeeksBefore;
}

/** "Gerar uma nova planilha = Plus (Free vive a 1ª planilha)" (docs/fase-8-brief.md Grupo 3). */
export function canGenerateNewPlan({ hasExistingPlan, isPlus }: { hasExistingPlan: boolean; isPlus: boolean }): boolean {
  return isPlus || !hasExistingPlan;
}
