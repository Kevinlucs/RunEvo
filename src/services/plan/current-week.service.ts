import { parseLocalDate, addDays } from '@/domain/motor-evo/dates';

/**
 * docs/fase-4-brief.md Grupo 1.2 (`useCurrentWeek`) — não é um port do
 * legado (o app antigo não recalculava a semana corrente a partir de
 * `start_date`; ele guardava `weekIndex` no estado). Reusa só os primitivos
 * de `dates.ts` (motor fechado): mesmo alinhamento a segunda-feira usado em
 * `calculateWeeks`/`plan.mapper.ts#computeWorkoutDates`, aplicado a "hoje" em
 * vez da data da prova — mantém a primeira semana parcial coerente com como
 * as datas dos treinos foram geradas.
 */
function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return addDays(d, -dayIndex);
}

/** Retorna o `week_number` (1-based) correspondente a `today` dado o início do plano. */
export function computeCurrentWeekNumber(startDateStr: string, today: Date = new Date()): number {
  const startMonday = mondayOf(parseLocalDate(startDateStr));
  const todayMonday = mondayOf(today);
  const diffWeeks = Math.round((todayMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diffWeeks + 1);
}
