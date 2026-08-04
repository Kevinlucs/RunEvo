import { secondsToPace } from '@/domain/motor-evo/pace';
import { formatShortDate } from '@/utils/time';
import type { CycleSummary } from './cycle-summary';

/** `"YYYY-MM-DD"` → `"22 jul 2026"` — ciclos podem ser de anos diferentes, ao contrário de `formatShortDate` (usado dentro de um único ano de plano ativo). */
export function formatCycleDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const year = dateStr.slice(0, 4);
  return `${formatShortDate(dateStr)} ${year}`;
}

/** Formatações de exibição compartilhadas entre histórico/comparação/evolução — nunca inventa valor, só formata o que `CycleSummary` já trouxe. */
export function formatPercent(rate: number | null): string {
  return rate === null ? '-' : `${Math.round(rate * 100)}%`;
}

export function formatGoalPace(summary: Pick<CycleSummary, 'goalPaceSeconds'>): string {
  return summary.goalPaceSeconds !== null ? secondsToPace(summary.goalPaceSeconds) : '-';
}

export function formatRaceCompleted(summary: Pick<CycleSummary, 'raceCompleted'>): string {
  if (summary.raceCompleted === null) return '-';
  return summary.raceCompleted ? 'Concluída' : 'Não concluída';
}

export function formatKm(value: number | null): string {
  return value === null ? '-' : `${Math.round(value * 10) / 10} km`;
}
