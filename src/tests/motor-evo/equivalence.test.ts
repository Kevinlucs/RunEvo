/**
 * Testes de equivalência do Motor RunEvo (Fase 2) — TS novo vs. golden do legado.
 *
 * ESCOPO DESTA RODADA (Grupos A e B só): `src/domain/motor-evo/` hoje só tem
 * types, utils/math, dates, pace, objective, terrain e zones. Não existem
 * ainda phases.ts, weekly-targets.ts, workout-library.ts,
 * workout-prescription.ts, plan-generator.ts, validation.ts,
 * quality-score.ts, risk.ts nem fingerprint.ts (Grupos C em diante).
 *
 * Por isso, o que este arquivo REALMENTE testa (com asserts de verdade,
 * comparando contra os golden gerados pelo legado em
 * src/tests/motor-evo/golden/*.json) é só o que os Grupos A/B produzem:
 * - nº de semanas (calculateWeeks)
 * - motorEvoContext (getGoalContext — estratégia de zona, pace alvo, pace de
 *   teste, speedReserve, resumo)
 * - blueprint.paceZones (buildLocalPaceZones — método de zona e faixas Z1-Z5)
 *
 * As comparações de fases/flags off/treinos/validation/qualityStatus/
 * riskLevel/fingerprint pedidas no enunciado da Fase 2 ficam como
 * `test.todo(...)` explícitos, cada um citando o módulo que falta —
 * não fabricamos asserts sobre código que ainda não existe.
 */
import { calculateWeeks } from '../../domain/motor-evo/dates';
import { getGoalContext } from '../../domain/motor-evo/objective';
import { buildLocalPaceZones } from '../../domain/motor-evo/zones';
import { fixtures } from './fixtures';

import golden_f01 from './golden/f01.json';
import golden_f02 from './golden/f02.json';
import golden_f03 from './golden/f03.json';
import golden_f04 from './golden/f04.json';
import golden_f05 from './golden/f05.json';
import golden_f06 from './golden/f06.json';
import golden_f07 from './golden/f07.json';
import golden_f08 from './golden/f08.json';
import golden_f09 from './golden/f09.json';
import golden_f10 from './golden/f10.json';

/** Só o subconjunto do plano do legado que os Grupos A/B conseguem produzir hoje. */
interface GoldenPlan {
  totalWeeks: number;
  motorEvoContext: unknown;
  blueprint: { paceZones: unknown };
}

const golden: Record<string, GoldenPlan> = {
  f01: golden_f01,
  f02: golden_f02,
  f03: golden_f03,
  f04: golden_f04,
  f05: golden_f05,
  f06: golden_f06,
  f07: golden_f07,
  f08: golden_f08,
  f09: golden_f09,
  f10: golden_f10,
};

describe('Motor RunEvo — equivalência TS novo vs. legado (Grupos A+B)', () => {
  describe.each(fixtures)('$id — $description', (fixture) => {
    const goldenPlan = golden[fixture.id];
    if (!goldenPlan) throw new Error(`golden ausente para ${fixture.id}`);

    it('nº de semanas (calculateWeeks) bate com o golden', () => {
      expect(calculateWeeks(fixture.input.startDate, fixture.input.raceDate)).toBe(goldenPlan.totalWeeks);
    });

    it('motorEvoContext (getGoalContext) bate com o golden', () => {
      expect(getGoalContext(fixture.input)).toEqual(goldenPlan.motorEvoContext);
    });

    it('blueprint.paceZones (buildLocalPaceZones) bate com o golden', () => {
      expect(buildLocalPaceZones(fixture.input)).toEqual(goldenPlan.blueprint.paceZones);
    });
  });

  // Pedidos explícitos do relato da Fase 2: estratégia de zona escolhida e
  // pace-alvo interpretado nos cenários de heurística de objetivo pt-BR.
  describe('Casos de atenção — interpretação de objetivo e estratégia de zona', () => {
    it('f02 (10k, "sub 50"): pace-alvo 300s/km (5:00/km), mas continua capacity_anchored (distanceKm < 21)', () => {
      const ctx = getGoalContext(fixtures.find((f) => f.id === 'f02')!.input);
      expect(ctx.goalPace).toBe(300);
      expect(ctx.zoneStrategy).toBe('capacity_anchored');
    });

    it('f04 (42k, "abaixo de 4 horas"): pace-alvo ~343s/km, teste forte dispara goal_anchored (regra de conflito)', () => {
      const ctx = getGoalContext(fixtures.find((f) => f.id === 'f04')!.input);
      expect(ctx.goalPace).toBe(343);
      expect(ctx.zoneStrategy).toBe('goal_anchored');
    });

    it('f05 (ultra 60km, "abaixo de 7 horas"): pace-alvo 420s/km, goal_anchored com tabela de offsets de ultra', () => {
      const ctx = getGoalContext(fixtures.find((f) => f.id === 'f05')!.input);
      expect(ctx.goalPace).toBe(420);
      expect(ctx.raceType).toBe('ultra');
      expect(ctx.zoneStrategy).toBe('goal_anchored');
    });

    it('f03 (21k PR) vs. f09 (42k PR): mesma heurística de PR, estratégias diferentes pelo limiar de 60s', () => {
      const f03 = getGoalContext(fixtures.find((f) => f.id === 'f03')!.input);
      const f09 = getGoalContext(fixtures.find((f) => f.id === 'f09')!.input);
      expect(f03.zoneStrategy).toBe('mixed_goal_capacity');
      expect(f09.zoneStrategy).toBe('capacity_anchored');
    });
  });

  // ===== Pendente — depende de módulos ainda não portados (Grupos C+) =====
  test.todo('fases por semana (Base/Resistência/Pico/Polimento) — depende de phases.ts (Grupo C)');
  test.todo('flags "off" (semanas de recuperação) — depende de weekly-targets.ts (Grupo C)');
  test.todo(
    'por treino: dayType/title/km/dayOfWeek — depende de workout-library.ts + workout-prescription.ts + plan-generator.ts (Grupos C-E)',
  );
  test.todo('validation.status e issues (códigos/fixed) — depende de validation.ts (Grupo F)');
  test.todo('qualityStatus (quality score 0-10) — depende de quality-score.ts (Grupo F)');
  test.todo('riskLevel (+ razões) — depende de risk.ts (Grupo F)');
  test.todo('fingerprint estrutural do plano — depende de fingerprint.ts (Grupo G)');
});
