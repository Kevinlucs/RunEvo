/**
 * Porte 1:1 de `legacy/ai-coach.js` — pace, duração e velocidade.
 * Mapeamento: docs/legacy-audit.md §13.1
 * (`paceToSeconds, timeToSeconds, secondsToDuration, secondsToPace, paceRange,
 * speedFromPaceSeconds, paceSecondsFromSpeed, formatSpeed` → `pace.ts`).
 */

/** ai-coach.js:170-175 — aceita "mm:ss" ou "mm h ss" (ex. pace "5:30" ou "5h30"). */
export function paceToSeconds(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const match = String(pace).match(/(\d{1,2})\s*[:h]\s*(\d{1,2})/i);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** ai-coach.js:177-184 — "mm:ss" ou "h:mm:ss". */
export function timeToSeconds(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = String(time).trim().split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) return (parts[0] as number) * 60 + (parts[1] as number);
  if (parts.length === 3) {
    return (parts[0] as number) * 3600 + (parts[1] as number) * 60 + (parts[2] as number);
  }
  return null;
}

/** ai-coach.js:186-195 */
export function secondsToDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '-';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** ai-coach.js:303-309 — piso 180s (3:00/km); formata "mm:ss/km". */
export function secondsToPace(seconds: number): string {
  if (!Number.isFinite(seconds)) return '-';
  const s = Math.max(180, Math.round(seconds));
  const min = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${min}:${sec}/km`;
}

/** ai-coach.js:311-314 */
export function paceRange(baseSeconds: number | null | undefined, minAdd: number, maxAdd: number): string {
  if (!baseSeconds) return '-';
  return `${secondsToPace(baseSeconds + minAdd)}-${secondsToPace(baseSeconds + maxAdd)}`;
}

/** ai-coach.js:494-497 */
export function speedFromPaceSeconds(seconds: number | null | undefined): number | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return 3600 / seconds;
}

/** ai-coach.js:499-502 */
export function paceSecondsFromSpeed(speedKmh: number | null | undefined): number | null {
  if (!speedKmh || !Number.isFinite(speedKmh)) return null;
  return 3600 / speedKmh;
}

/** ai-coach.js:504-507 */
export function formatSpeed(speed: number | null | undefined): string {
  if (!speed || !Number.isFinite(speed)) return '-';
  return `${String(Math.round(speed * 10) / 10).replace('.', ',')} km/h`;
}
