import { clamp } from './utils/math';
import type { Phase } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — fases do plano.
 * Mapeamento: docs/legacy-audit.md §13.4/§13.5
 * (`buildPhaseDistribution, normalizePhaseDistribution` → blueprint.ts/phases.ts;
 * `getPhaseForWeek` → weekly-targets.ts/phases.ts).
 */

export interface PhaseRange {
  phase: Phase;
  startWeek: number;
  endWeek: number;
}

const VALID_PHASES: Phase[] = ['Base', 'Resistência', 'Pico', 'Polimento'];

/** ai-coach.js:869-881 */
export function buildPhaseDistribution(totalWeeks: number, taperWeeks: number): PhaseRange[] {
  const taper = clamp(Number(taperWeeks || 2), 1, Math.min(3, totalWeeks - 3));
  const peakEnd = totalWeeks - taper;
  const baseEnd = Math.max(2, Math.round(peakEnd * 0.38));
  const resistanceEnd = Math.max(baseEnd + 1, Math.round(peakEnd * 0.78));

  return (
    [
      { phase: 'Base', startWeek: 1, endWeek: baseEnd },
      { phase: 'Resistência', startWeek: baseEnd + 1, endWeek: resistanceEnd },
      { phase: 'Pico', startWeek: resistanceEnd + 1, endWeek: peakEnd },
      { phase: 'Polimento', startWeek: peakEnd + 1, endWeek: totalWeeks },
    ] as PhaseRange[]
  ).filter((p) => p.startWeek <= p.endWeek);
}

interface RawPhaseRange {
  phase?: unknown;
  startWeek?: unknown;
  endWeek?: unknown;
}

/** ai-coach.js:1169-1186 */
export function normalizePhaseDistribution(
  phases: RawPhaseRange[],
  totalWeeks: number,
  taperWeeks: number,
): PhaseRange[] {
  const clean = phases
    .filter(Boolean)
    .map(
      (p): PhaseRange => ({
        phase: VALID_PHASES.includes(p.phase as Phase) ? (p.phase as Phase) : 'Base',
        startWeek: clamp(Number(p.startWeek || 1), 1, totalWeeks),
        endWeek: clamp(Number(p.endWeek || totalWeeks), 1, totalWeeks),
      }),
    )
    .filter((p) => p.startWeek <= p.endWeek)
    .sort((a, b) => a.startWeek - b.startWeek);

  if (!clean.length || clean[0]?.startWeek !== 1 || clean[clean.length - 1]?.endWeek !== totalWeeks) {
    return buildPhaseDistribution(totalWeeks, taperWeeks);
  }

  return clean;
}

/** ai-coach.js:1189-1194 */
export function getPhaseForWeek(
  weekNumber: number,
  blueprint: { phaseDistribution: PhaseRange[]; strategy: { taperWeeks: number } },
  totalWeeks: number,
): Phase {
  const phase = blueprint.phaseDistribution.find((p) => weekNumber >= p.startWeek && weekNumber <= p.endWeek);
  if (phase) return phase.phase;
  if (weekNumber > totalWeeks - blueprint.strategy.taperWeeks) return 'Polimento';
  return 'Base';
}
