/**
 * Gera `src/tests/motor-evo/golden/*.json` a partir do legado (`legacy/ai-coach.js`),
 * rodando `AICoach.generatePlan` no sandbox `vm` do `legacy-harness`. `fetch` rejeita
 * de propósito no harness, então todo golden é gerado pelo caminho do blueprint
 * local determinístico — nunca pelo caminho de IA.
 *
 * Uso: npm run motor-evo:golden
 *
 * Os arquivos gerados são commitados como contrato (fonte da verdade do legado
 * para os testes de equivalência). Rodar este script de novo e commitar a
 * diferença só é apropriado se o PRÓPRIO LEGADO mudar — nunca para "ajustar"
 * um golden que não bate com o motor novo.
 */
import fs from 'node:fs';
import path from 'node:path';

import { fixtures } from './fixtures';
import { loadLegacyAICoach, type UnknownRecord } from './legacy-harness';

const GOLDEN_DIR = path.join(__dirname, 'golden');

async function main(): Promise<void> {
  const AICoach = loadLegacyAICoach();
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });

  for (const fixture of fixtures) {
    const plan = await AICoach.generatePlan(fixture.input as unknown as UnknownRecord);
    const outPath = path.join(GOLDEN_DIR, `${fixture.id}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    // eslint-disable-next-line no-console -- script de terminal (`npm run motor-evo:golden`), console é a UI
    console.log(`golden gerado: ${fixture.id} -> ${path.relative(process.cwd(), outPath)}`);
  }
}

main().catch((error) => {
  console.error('Falha ao gerar golden files:', error);
  process.exitCode = 1;
});
