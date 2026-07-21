/**
 * Testes de equivalência do Motor RunEvo (Fase 2) — TS novo vs. golden do legado.
 *
 * Grupos A+B (types/utils/dates/pace/objective/terrain/zones) e C+D
 * (profile/phases/blueprint/weekly-targets/workout-library/workout-prescription/
 * plan-generator/validation/quality-score/risk) estão portados. `index.ts`
 * (`generatePlan`) compõe `assemblePlan` + `validateAndFixPlan`, sempre pelo
 * caminho local/determinístico (só o testado pelos golden desta fase).
 *
 * Cenário §39 9 (blueprint.source) já ativo. Cenário 10 (arePlansIdentical)
 * ainda `test.todo`: depende de fingerprint.ts (Grupo F), não portado ainda.
 */
import { calculateWeeks } from '../../domain/motor-evo/dates';
import { getGoalContext } from '../../domain/motor-evo/objective';
import { buildLocalPaceZones } from '../../domain/motor-evo/zones';
import { generatePlan } from '../../domain/motor-evo/index';
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

/** Formato completo do plano do legado (docs/legacy-audit.md §3.2/§3.4). */
interface GoldenPlan {
  totalWeeks: number;
  motorEvoContext: unknown;
  blueprint: { paceZones: unknown; source: string };
  weeks: unknown[];
  validation: {
    status: string;
    summary: {
      qualityScore: number;
      qualityStatus: string;
      riskLevel: string;
      riskPoints: number;
      riskReasons: string[];
    };
  };
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

/** Remove timestamps não-determinísticos (generatedAt/checkedAt/issue.at) antes de comparar. */
function omitVolatile<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key: string, v: unknown) => (key === 'generatedAt' || key === 'checkedAt' || key === 'at' ? undefined : v)),
  ) as T;
}

describe('Motor RunEvo — equivalência TS novo vs. legado (Grupos A-D)', () => {
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

    describe('generatePlan (plano completo)', () => {
      const newPlan = generatePlan(fixture.input);

      it('semanas (fases, off, treinos: dayType/title/desc/km/pace/dayOfWeek) batem com o golden', () => {
        expect(omitVolatile(newPlan.weeks)).toEqual(omitVolatile(goldenPlan.weeks));
      });

      it('validation.status bate com o golden', () => {
        expect(newPlan.validation?.status).toBe(goldenPlan.validation.status);
      });

      it('validation.summary (qualityScore/qualityStatus/riskLevel/riskPoints/riskReasons) bate com o golden', () => {
        const summary = newPlan.validation?.summary;
        expect(summary?.qualityScore).toBe(goldenPlan.validation.summary.qualityScore);
        expect(summary?.qualityStatus).toBe(goldenPlan.validation.summary.qualityStatus);
        expect(summary?.riskLevel).toBe(goldenPlan.validation.summary.riskLevel);
        expect(summary?.riskPoints).toBe(goldenPlan.validation.summary.riskPoints);
        expect(summary?.riskReasons).toEqual(goldenPlan.validation.summary.riskReasons);
      });

      it('validation completo (issues/fixed/warnings, sem timestamps) bate com o golden', () => {
        expect(omitVolatile(newPlan.validation)).toEqual(omitVolatile(goldenPlan.validation));
      });
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

    it('f05 (ultra 61km, elevado, 3d, "abaixo de 7 horas"): pace-alvo 413s/km, goal_anchored com tabela de offsets de ultra', () => {
      const ctx = getGoalContext(fixtures.find((f) => f.id === 'f05')!.input);
      expect(ctx.goalPace).toBe(413);
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

  // Cenário §39 9: fonte do blueprint quando a IA está indisponível.
  // `blueprint.source` é um enum limpo ('ai'|'local') por decisão consciente —
  // diverge do legado de propósito (vazava a mensagem de erro do fetch nesse
  // campo). Não compara contra `golden.blueprint.source` (que ainda tem a
  // string suja) — ver docs/motor-equivalence-report.md.
  it('cenário §39 9 (f09) — blueprint.source === "local" quando IA indisponível (todas as fixtures, caminho local)', () => {
    for (const fixture of fixtures) {
      const plan = generatePlan(fixture.input);
      expect(plan.blueprint.source).toBe('local');
    }
  });

  // ===== Pendente — depende de fingerprint.ts (Grupo F), ainda não portado =====
  test.todo('cenário §39 10 (f10) — arePlansIdentical(plano, mesmo plano) === true — depende de fingerprint.ts');
});
