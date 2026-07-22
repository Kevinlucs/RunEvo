/**
 * Round-trip do mapper sobre os 10 golden da Fase 2
 * (`src/tests/motor-evo/golden/*.json`, saída real do legado).
 * `rowsToPlan(planToRows(golden))` deve reproduzir os campos mapeados
 * (docs/fase-3-brief.md §1.1). `zoneTarget` é opcional e não sobrevive
 * (nem sobrevive à validação do próprio motor — achado da Fase 2).
 */
/* eslint-disable import/first */
import { randomUUID } from 'node:crypto';

// expo-crypto exige o runtime RN/Metro (ESM) — fora do alcance do ts-jest
// genérico usado por src/tests/**. Mock local, não mexe no jest.config.js
// compartilhado; randomUUID (Node) só precisa gerar UUIDs v4 válidos.
// PRECISA vir antes do import de plan.mapper (ts-jest não faz hoist de
// jest.mock como o babel-jest faz) — não deixe o --fix reordenar isto.
jest.mock('@/utils/uuid', () => ({ newUuid: () => randomUUID() }));

import { planToRows, rowsToPlan } from '@/mappers/plan.mapper';
import type { Plan } from '@/domain/motor-evo/plan-generator';

import golden_f01 from '../motor-evo/golden/f01.json';
import golden_f02 from '../motor-evo/golden/f02.json';
import golden_f03 from '../motor-evo/golden/f03.json';
import golden_f04 from '../motor-evo/golden/f04.json';
import golden_f05 from '../motor-evo/golden/f05.json';
import golden_f06 from '../motor-evo/golden/f06.json';
import golden_f07 from '../motor-evo/golden/f07.json';
import golden_f08 from '../motor-evo/golden/f08.json';
import golden_f09 from '../motor-evo/golden/f09.json';
import golden_f10 from '../motor-evo/golden/f10.json';
/* eslint-enable import/first */

const goldens: [string, unknown][] = [
  ['f01', golden_f01],
  ['f02', golden_f02],
  ['f03', golden_f03],
  ['f04', golden_f04],
  ['f05', golden_f05],
  ['f06', golden_f06],
  ['f07', golden_f07],
  ['f08', golden_f08],
  ['f09', golden_f09],
  ['f10', golden_f10],
];

const USER_ID = '11111111-1111-4111-8111-111111111111';

function stripWorkout(w: { dayOfWeek: string; dayType: string; title: string; desc: string; km: number; pace: string }) {
  return { dayOfWeek: w.dayOfWeek, dayType: w.dayType, title: w.title, desc: w.desc, km: w.km, pace: w.pace };
}

describe('plan.mapper — round-trip vs. golden da Fase 2', () => {
  it.each(goldens)('%s: rowsToPlan(planToRows(golden)) reproduz campos mapeados', (_id, golden) => {
    const plan = golden as Plan;
    const { plan: planRow, workouts: workoutRows } = planToRows(plan, USER_ID);

    // UUIDs válidos, nunca IDs textuais tipo "S1-0"
    expect(planRow.id).toMatch(/^[0-9a-f-]{36}$/i);
    for (const w of workoutRows) expect(w.id).toMatch(/^[0-9a-f-]{36}$/i);

    const rebuilt = rowsToPlan(planRow, workoutRows);

    expect(rebuilt.planName).toBe(plan.planName);
    expect(rebuilt.totalWeeks).toBe(plan.totalWeeks);
    expect(rebuilt.raceDate).toBe(plan.raceDate);
    expect(rebuilt.daysPerWeek).toBe(plan.daysPerWeek);
    expect(rebuilt.weeks).toHaveLength(plan.weeks.length);

    plan.weeks.forEach((week, weekIndex) => {
      const rebuiltWeek = rebuilt.weeks[weekIndex]!;
      expect(rebuiltWeek.week).toBe(week.week);
      expect(rebuiltWeek.phase).toBe(week.phase);
      expect(rebuiltWeek.off).toBe(week.off);
      expect(rebuiltWeek.workouts.map(stripWorkout)).toEqual(week.workouts.map(stripWorkout));
    });
  });
});

describe('plan.mapper — datas reais por treino (f01)', () => {
  it('workout_date da semana 1 cai nos dias corretos e cresce monotonicamente', () => {
    const plan = golden_f01 as unknown as Plan;
    expect(plan.userData.startDate).toBe('2026-01-05'); // segunda-feira

    const { workouts } = planToRows(plan, USER_ID);
    const week1 = workouts.filter((w) => w.week_number === 1).sort((a, b) => a.week_index - b.week_index);

    expect(week1.length).toBeGreaterThan(0);

    // primeiro treino da semana 1 cai na própria data de início (semana não-parcial: já é segunda)
    expect(week1[0]?.workout_date).toBe('2026-01-05');

    // datas crescem monotonicamente dentro da semana
    const dates = week1.map((w) => w.workout_date as string);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);

    // todas as datas caem dentro da janela segunda(05)-domingo(11) da semana 1
    for (const d of dates) {
      expect(d >= '2026-01-05' && d <= '2026-01-11').toBe(true);
    }
  });

  it('datas por semana avançam ~7 dias', () => {
    const plan = golden_f01 as unknown as Plan;
    const { workouts } = planToRows(plan, USER_ID);

    const lastWorkoutDateOfWeek = (weekNumber: number): string | undefined =>
      workouts
        .filter((w) => w.week_number === weekNumber)
        .sort((a, b) => a.week_index - b.week_index)
        .slice(-1)[0]?.workout_date ?? undefined;

    const w1Long = lastWorkoutDateOfWeek(1);
    const w2Long = lastWorkoutDateOfWeek(2);
    expect(w1Long).toBeDefined();
    expect(w2Long).toBeDefined();
    const diffDays = (new Date(w2Long as string).getTime() - new Date(w1Long as string).getTime()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(1);
    expect(diffDays).toBeLessThanOrEqual(13);
  });
});
