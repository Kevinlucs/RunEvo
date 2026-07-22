/**
 * Sandbox de execução das funções de fingerprint do legado `legacy/app.js`
 * (Node `vm`), usado só pelos testes de equivalência da Fase 2.
 *
 * Ao contrário de `legacy/ai-coach.js` (IIFE limpa, sem DOM), `app.js` tem
 * dependências de DOM e efeitos no escopo do módulo — carregar o arquivo
 * inteiro num `vm` quebraria. Em vez disso, extraímos por RANGE DE LINHA só
 * as 10 funções que `normalizeRunEvoComparablePlan`/`getRunEvoPlanFingerprint`/
 * `areRunEvoPlansIdentical` realmente precisam (fechamento transitivo
 * verificado por leitura manual — nenhuma delas toca DOM/localStorage):
 *
 *   formatKm (3571-3576), getPlanReviewSummary (3578-3603),
 *   getRiskLabelText (3612-3618), formatPlanScore (5993-5996),
 *   getPlanRisk (5998-6000), getPlanDistanceLabel (6002-6005),
 *   getCompactPlanSummary (6007-6019), normalizeRunEvoComparablePlan
 *   (6192-6224), getRunEvoPlanFingerprint (6226-6229),
 *   areRunEvoPlansIdentical (6231-6234).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export type UnknownRecord = Record<string, unknown>;

export interface LegacyFingerprint {
  normalizeRunEvoComparablePlan: (plan: UnknownRecord) => UnknownRecord;
  getRunEvoPlanFingerprint: (plan: UnknownRecord) => string;
  areRunEvoPlansIdentical: (currentPlan: UnknownRecord, newPlan: UnknownRecord) => boolean;
}

const APP_JS_PATH = path.join(__dirname, '..', '..', '..', 'legacy', 'app.js');

/** [start, end] 1-indexado, inclusive — mesma convenção do `Read` tool. */
const LINE_RANGES: [number, number][] = [
  [3571, 3576], // formatKm
  [3578, 3603], // getPlanReviewSummary
  [3612, 3618], // getRiskLabelText
  [5993, 5996], // formatPlanScore
  [5998, 6000], // getPlanRisk
  [6002, 6005], // getPlanDistanceLabel
  [6007, 6019], // getCompactPlanSummary
  [6192, 6224], // normalizeRunEvoComparablePlan
  [6226, 6229], // getRunEvoPlanFingerprint
  [6231, 6234], // areRunEvoPlansIdentical
];

const EXPECTED_FIRST_LINES: Record<number, string> = {
  3571: 'function formatKm(value) {',
  3578: 'function getPlanReviewSummary(plan) {',
  3612: 'function getRiskLabelText(riskLevel) {',
  5993: 'function formatPlanScore(plan) {',
  5998: 'function getPlanRisk(plan) {',
  6002: 'function getPlanDistanceLabel(plan) {',
  6007: 'function getCompactPlanSummary(plan) {',
  6192: 'function normalizeRunEvoComparablePlan(plan = {}) {',
  6226: 'function getRunEvoPlanFingerprint(plan = {}) {',
  6231: 'function areRunEvoPlansIdentical(currentPlan, newPlan) {',
};

let cached: LegacyFingerprint | null = null;

export function loadLegacyFingerprint(): LegacyFingerprint {
  if (cached) return cached;

  const lines = fs.readFileSync(APP_JS_PATH, 'utf8').split('\n');

  const chunks = LINE_RANGES.map(([start, end]) => {
    const expected = EXPECTED_FIRST_LINES[start];
    const actualFirstLine = lines[start - 1];
    if (expected && actualFirstLine?.trim() !== expected) {
      throw new Error(
        `legacy-fingerprint-harness: legacy/app.js mudou de forma — linha ${start} era ` +
          `"${expected}", agora é "${actualFirstLine}". Reconfirme os ranges antes de continuar.`,
      );
    }
    return lines.slice(start - 1, end).join('\n');
  });

  const source = `${chunks.join('\n\n')}\nthis.normalizeRunEvoComparablePlan = normalizeRunEvoComparablePlan;\nthis.getRunEvoPlanFingerprint = getRunEvoPlanFingerprint;\nthis.areRunEvoPlansIdentical = areRunEvoPlansIdentical;\n`;

  const sandbox: UnknownRecord = { console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'legacy/app.js (extrato de fingerprint)' });

  const result = sandbox as unknown as LegacyFingerprint;
  if (typeof result.areRunEvoPlansIdentical !== 'function') {
    throw new Error('legacy-fingerprint-harness: extração falhou — areRunEvoPlansIdentical não é função.');
  }

  cached = result;
  return result;
}
