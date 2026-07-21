import type { Week } from './types';

/**
 * `sumWeekKm` (ai-coach.js:2000-2002) e `getPreviousNonRecoveryWeek`
 * (ai-coach.js:941-946) do legado, extraídas para um módulo neutro porque
 * `validation.ts` (dono de `sumWeekKm` segundo docs/legacy-audit.md §13.6) e
 * `quality-score.ts` (`calculatePlanQualityScore` usa as duas) precisariam
 * importar uma da outra — ciclo de import em runtime. `validation.ts`
 * reexporta `sumWeekKm` para manter o nome público no lugar que o mapeamento
 * espera.
 */

/** ai-coach.js:2000-2002 */
export function sumWeekKm(week: Pick<Week, 'workouts'>): number {
  return (week.workouts || []).reduce((sum, workout) => sum + Number(workout.km || 0), 0);
}

/** ai-coach.js:941-946 */
export function getPreviousNonRecoveryWeek(weeks: Week[], currentIndex: number): Week | null {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!weeks[i]?.off) return weeks[i] as Week;
  }
  return null;
}
