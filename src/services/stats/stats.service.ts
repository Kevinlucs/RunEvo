import { summarizeWorkoutsForWeek } from '@/services/plan/week-summary.service';
import type { Workout } from '@/domain/entities';

export interface WeeklyStatPoint {
  weekNumber: number;
  label: string;
  plannedKm: number;
  completedKm: number;
  completionRate: number;
  resolved: number;
  total: number;
  skipped: number;
}

/**
 * docs/fase-6-brief.md Grupo 2 (§31) — agregação pura por semana, em cima do
 * que `summarizeWeek` (motor-evo, fechado) já produz. Nenhuma regra nova de
 * treino: só mapeia por `week_number` e lê os campos existentes.
 */
export function computeWeeklyStats(workouts: Workout[]): WeeklyStatPoint[] {
  const weekNumbers = Array.from(new Set(workouts.map((w) => w.week_number))).sort((a, b) => a - b);
  return weekNumbers.map((weekNumber) => {
    const summary = summarizeWorkoutsForWeek(workouts, weekNumber);
    return {
      weekNumber,
      label: `S${weekNumber}`,
      plannedKm: summary.plannedKm,
      completedKm: summary.completedKm,
      completionRate: summary.completionRate,
      resolved: summary.resolved,
      total: summary.total,
      skipped: summary.skipped,
    };
  });
}

/**
 * "Semanas seguidas" — conta, de trás para frente a partir da última semana
 * já totalmente resolvida, quantas semanas consecutivas não tiveram nenhum
 * treino pulado. Semanas sem treino (`total === 0`) ou ainda em andamento
 * (`resolved < total`, ex.: a semana atual) não contam nem quebram a
 * sequência — só semanas fechadas decidem o streak.
 */
export function computeWeeksStreak(weeklyStats: WeeklyStatPoint[]): number {
  let streak = 0;
  for (let i = weeklyStats.length - 1; i >= 0; i--) {
    const week = weeklyStats[i];
    if (!week || week.total === 0 || week.resolved < week.total) continue;
    if (week.skipped > 0) break;
    streak++;
  }
  return streak;
}

/**
 * Classificação de IMC (docs/legacy-audit.md §13.1, `getIMCLabel` em
 * legacy/app.js:5716-5725) — texto idêntico ao legado; cor fica a cargo do
 * chamador (tokens §36 não têm uma escala de severidade, só `neon`/`success`/
 * `error`, então aqui devolvemos só o rótulo, sem cor).
 */
export function classifyImc(imc: number | null | undefined): string {
  if (!imc) return '-';
  if (imc <= 18.5) return 'Abaixo do normal';
  if (imc <= 24.9) return 'Normal';
  if (imc <= 29.9) return 'Sobrepeso';
  if (imc <= 34.9) return 'Obesidade grau I';
  if (imc <= 39.9) return 'Obesidade grau II';
  return 'Obesidade grau III';
}
