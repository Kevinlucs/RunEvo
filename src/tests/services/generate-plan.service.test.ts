/**
 * generatePlanWithProgress deve produzir o MESMO plano que
 * `src/domain/motor-evo/index.ts`'s `generatePlan` (já provado contra o
 * legado, 117 testes da Fase 2) quando o blueprint resolve 100% local —
 * já que ambos os caminhos chamam buildFallbackBlueprint → assemblePlan →
 * validateAndFixPlan, só que via composição diferente (index.ts fixo no
 * local; aqui via resolveBlueprint injetável).
 */
/* eslint-disable import/first */
// remoto sempre indisponível de propósito nestes testes — força o caminho
// local, o único comparável byte a byte contra `generatePlan` (index.ts).
const invokeMock = jest.fn().mockRejectedValue(new Error('IA desabilitada de propósito neste teste'));
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: invokeMock } } }));

import { generatePlanWithProgress, type GenerationStep } from '@/services/plan/generate-plan.service';
import { generatePlan } from '@/domain/motor-evo/index';
import { fixtures } from '../motor-evo/fixtures';
/* eslint-enable import/first */

/** Remove timestamps não-determinísticos (generatedAt/checkedAt/issue.at) antes de comparar. */
function omitVolatile<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key: string, v: unknown) => (key === 'generatedAt' || key === 'checkedAt' || key === 'at' ? undefined : v)),
  ) as T;
}

describe('generatePlanWithProgress vs. generatePlan (caminho 100% local)', () => {
  it.each(fixtures)('$id — plano idêntico ao index.ts (buildFallbackBlueprint)', async (fixture) => {
    const steps: GenerationStep[] = [];
    const result = await generatePlanWithProgress(fixture.input, (s) => steps.push(s));
    const expected = generatePlan(fixture.input);

    expect(omitVolatile(result)).toEqual(omitVolatile(expected));
    expect(steps).toEqual(['analisando', 'construindo', 'validando']);
  });
});
