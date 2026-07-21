import type { AthleteInput } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — datas.
 * Mapeamento: docs/legacy-audit.md §13.1 (`parseLocalDate, addDays, calculateWeeks, getStartDayOfWeek` → `dates.ts`).
 */

/** ai-coach.js:11 — índice por `Date.getDay()` (0=Domingo). */
export const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

/** ai-coach.js:12 — segunda-indexado (usado por getTrainingDays/isValidDayName). */
export const MONDAY_INDEXED_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

/**
 * ai-coach.js:74-78 — parsing **local** (evita shift de UTC de `new Date('YYYY-MM-DD')`).
 */
export function parseLocalDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

/** ai-coach.js:80-84 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * ai-coach.js:111-129 — alinha início à segunda e prova ao domingo; diffWeeks
 * arredondado; clamp mín 4 / máx 52.
 */
export function calculateWeeks(startDateStr: string, raceDateStr: string): number {
  const race = parseLocalDate(raceDateStr);
  const start = parseLocalDate(startDateStr);
  start.setHours(0, 0, 0, 0);
  race.setHours(0, 0, 0, 0);

  const startDay = start.getDay() === 0 ? 6 : start.getDay() - 1;
  const startMonday = new Date(start);
  startMonday.setDate(start.getDate() - startDay);

  const raceDay = race.getDay() === 0 ? 0 : 7 - race.getDay();
  const raceSunday = new Date(race);
  raceSunday.setDate(race.getDate() + raceDay);

  const diffMs = raceSunday.getTime() - startMonday.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  return Math.max(4, Math.min(52, diffWeeks));
}

/** ai-coach.js:156-158 */
export function getStartDayOfWeek(userData: Pick<AthleteInput, 'startDate'>): string {
  return DAY_NAMES[parseLocalDate(userData.startDate).getDay()] as string;
}
