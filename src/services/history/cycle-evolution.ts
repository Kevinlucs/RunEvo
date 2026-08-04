import { secondsToPace } from '@/domain/motor-evo/pace';
import { formatCycleDate } from './cycle-format';
import type { CycleSummary } from './cycle-summary';

/**
 * docs/fase-7-5-brief.md Grupo 4 — séries temporais para os gráficos de
 * evolução. Funções puras sobre `CycleSummary` (Grupo 1): nunca recalcula
 * treino, só ordena/formata o que já está salvo. Pontos cuja métrica não foi
 * salva num ciclo são **excluídos** da série (não viram 0 — 0 seria inventar
 * um valor).
 */
export interface EvolutionPoint {
  label: string;
  value: number;
}

function raceDateKey(cycle: CycleSummary): string {
  return cycle.raceDate ?? '9999-99-99';
}

/** `listArchived` vem mais recente primeiro; aqui a ordem é cronológica (mais antigo → mais recente) para o eixo X do gráfico. */
export function chronological(cycles: CycleSummary[]): CycleSummary[] {
  return [...cycles].sort((a, b) => raceDateKey(a).localeCompare(raceDateKey(b)));
}

function buildSeries(cycles: CycleSummary[], pick: (c: CycleSummary) => number | null): EvolutionPoint[] {
  return chronological(cycles)
    .map((c) => ({ label: formatCycleDate(c.raceDate), value: pick(c) }))
    .filter((p): p is EvolutionPoint => p.value !== null);
}

export function buildPeakVolumeSeries(cycles: CycleSummary[]): EvolutionPoint[] {
  return buildSeries(cycles, (c) => c.peakWeeklyKm);
}

export function buildAdherenceSeries(cycles: CycleSummary[]): EvolutionPoint[] {
  return buildSeries(cycles, (c) => (c.adherence.completionRate !== null ? Math.round(c.adherence.completionRate * 100) : null));
}

export function buildQualitySeries(cycles: CycleSummary[]): EvolutionPoint[] {
  return buildSeries(cycles, (c) => c.qualityScore);
}

/** Pace-alvo em minutos decimais (ex.: 300s → 5.0) — só conversão de unidade para o eixo do gráfico, não recálculo. */
export function buildPaceSeries(cycles: CycleSummary[]): EvolutionPoint[] {
  return buildSeries(cycles, (c) => (c.goalPaceSeconds !== null ? Math.round((c.goalPaceSeconds / 60) * 10) / 10 : null));
}

/**
 * Frase de síntese determinística (não IA) — "a linha que mais emociona":
 * pace-alvo do primeiro ao último ciclo com o dado salvo. `null` se não
 * houver pelo menos 2 ciclos com pace-alvo salvo (nada para comparar).
 */
export function buildEvolutionSynthesis(cycles: CycleSummary[]): string | null {
  const ordered = chronological(cycles);
  const withPace = ordered.filter((c): c is CycleSummary & { goalPaceSeconds: number } => c.goalPaceSeconds !== null);
  if (withPace.length < 2) return null;

  const first = withPace[0]!;
  const last = withPace[withPace.length - 1]!;
  return `Em ${ordered.length} ciclos, seu pace-alvo evoluiu de ${secondsToPace(first.goalPaceSeconds)} para ${secondsToPace(last.goalPaceSeconds)}.`;
}
