import type { CycleSummary } from './cycle-summary';

/**
 * docs/fase-7-5-brief.md Grupo 3 — comparação entre dois ciclos. Função pura:
 * só calcula deltas em cima de `CycleSummary` (Grupo 1), nunca lê plano/motor
 * diretamente. `a` é o ciclo base (ex.: mais antigo), `b` o de comparação
 * (ex.: mais recente) — a UI decide a ordem; aqui é sempre `b - a`.
 */
export interface MetricDelta {
  /** `b - a`, ou null se um dos dois lados não tiver o dado salvo. */
  absolute: number | null;
  /** `(b - a) / |a| * 100`, ou null se `a` for 0/null (sem base para %). */
  percent: number | null;
}

export interface CycleComparison {
  peakWeeklyKm: MetricDelta;
  longestRunKm: MetricDelta;
  /** Segundos — negativo significa `b` mais rápido que `a`. */
  goalPaceSeconds: MetricDelta;
  qualityScore: MetricDelta;
  /** Escala 0..1 (mesma de `CycleSummary.adherence.completionRate`). */
  completionRate: MetricDelta;
  totalWeeks: MetricDelta;
  daysPerWeek: MetricDelta;
  /** Ambos os ciclos têm a mesma `raceDistanceKm` salva (e não nula). */
  sameRaceDistance: boolean;
}

function delta(a: number | null, b: number | null): MetricDelta {
  if (a === null || b === null) return { absolute: null, percent: null };
  const absolute = b - a;
  const percent = a !== 0 ? (absolute / Math.abs(a)) * 100 : null;
  return { absolute, percent };
}

export function compareCycles(a: CycleSummary, b: CycleSummary): CycleComparison {
  return {
    peakWeeklyKm: delta(a.peakWeeklyKm, b.peakWeeklyKm),
    longestRunKm: delta(a.longestRunKm, b.longestRunKm),
    goalPaceSeconds: delta(a.goalPaceSeconds, b.goalPaceSeconds),
    qualityScore: delta(a.qualityScore, b.qualityScore),
    completionRate: delta(a.adherence.completionRate, b.adherence.completionRate),
    totalWeeks: delta(a.totalWeeks, b.totalWeeks),
    daysPerWeek: delta(a.daysPerWeek, b.daysPerWeek),
    sameRaceDistance: a.raceDistanceKm !== null && a.raceDistanceKm === b.raceDistanceKm,
  };
}
