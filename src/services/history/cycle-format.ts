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

/** docs/fase-7-5-brief.md Grupo 3 — deltas de comparação (`cycle-compare.ts`). */
export function formatSignedPercent(percent: number | null): string {
  if (percent === null) return '-';
  const rounded = Math.round(percent);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function formatSignedNumber(value: number | null, decimals = 0): string {
  if (value === null) return '-';
  const rounded = Number(value.toFixed(decimals));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

/** Segundos de delta de pace — negativo é `b` mais rápido que `a` (ver `CycleComparison.goalPaceSeconds`). */
export function formatPaceDelta(absoluteSeconds: number | null): string {
  if (absoluteSeconds === null) return '-';
  if (absoluteSeconds === 0) return 'igual';
  const abs = Math.abs(Math.round(absoluteSeconds));
  return absoluteSeconds < 0 ? `${abs}s/km mais rápido` : `${abs}s/km mais lento`;
}

/** Delta de `completionRate` (escala 0..1) em pontos percentuais. */
export function formatPointsDelta(rateDelta: number | null): string {
  if (rateDelta === null) return '-';
  const pp = Math.round(rateDelta * 100);
  return `${pp > 0 ? '+' : ''}${pp}pp`;
}
