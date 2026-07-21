/**
 * Porte 1:1 de `legacy/ai-coach.js` — helpers numéricos puros.
 * Mapeamento: docs/legacy-audit.md §13.1 (`clamp, roundKm, parseNumber, interpolate, easeProgression` → `utils/math.ts`).
 */

/** ai-coach.js:86-88 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** ai-coach.js:90-93 */
export function roundKm(value: number | string | null | undefined): number {
  const n = Number(value || 0);
  return Math.max(1, Math.round(n));
}

/** ai-coach.js:95-98 */
export function parseNumber(value: unknown, fallback = 0): number {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

/** ai-coach.js:1196-1198 */
export function interpolate(start: number, end: number, ratio: number): number {
  return start + (end - start) * clamp(ratio, 0, 1);
}

/** ai-coach.js:935-939 */
export function easeProgression(ratio: number): number {
  const r = clamp(Number(ratio || 0), 0, 1);
  return Math.pow(r, 0.88);
}
