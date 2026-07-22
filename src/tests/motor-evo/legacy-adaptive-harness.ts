/**
 * Sandbox de execução das funções de adaptive-training do legado `legacy/app.js`
 * (Node `vm`), usado só pelos testes de equivalência da Fase 2.
 *
 * Extração por RANGE DE LINHA (mesma técnica de `legacy-fingerprint-harness.ts`):
 *   getAdjustmentTitle (4763-4772), getLocalAdjustmentRecommendation (4721-4761),
 *   normalizeAICheckinRecommendation (4908-4968), roundHalf (4971-4973),
 *   applySkippedWorkoutRedistribution (4975-5043),
 *   applyAdjustmentToStoredPlan (5129-5173).
 *
 * Globais/helpers ausentes (fora do fechamento transitivo autorizado —
 * `getWorkoutStatus`, `AICoach.loadPlan`, `StorageService.savePlan`,
 * `AICoach.isPlanAdopted`, `applyAdoptedPlan`, `clamp`) são STUBADOS:
 * - `getWorkoutStatus(id)`: lê de um mapa controlado pelo teste (`setWorkoutStatuses`).
 * - `AICoach.loadPlan`: retorna o plano setado por `setTestPlan`.
 * - `StorageService.savePlan`: só grava em memória (`getLastSavedPlan`).
 * - `AICoach.isPlanAdopted`: sempre `false` (evita chamar `applyAdoptedPlan`, não extraído).
 * - `clamp`: idêntico a `ai-coach.js:86-88` (mesma fórmula, já usada nos Grupos A-D).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export type UnknownRecord = Record<string, unknown>;

export interface LegacyAdaptive {
  getAdjustmentTitle: (action: string) => string;
  getLocalAdjustmentRecommendation: (weekIndex: number, feedback: UnknownRecord) => UnknownRecord;
  normalizeAICheckinRecommendation: (ai: UnknownRecord | null, feedback: UnknownRecord, local: UnknownRecord) => UnknownRecord;
  roundHalf: (value: number) => number;
  applySkippedWorkoutRedistribution: (weekIndex: number, feedback: UnknownRecord) => UnknownRecord;
  applyAdjustmentToStoredPlan: (weekIndex: number, factor: number, action: string, weeksToAdjust: number) => boolean;
  setTestPlan: (plan: UnknownRecord) => void;
  setWorkoutStatuses: (statuses: Record<string, string>) => void;
  getLastSavedPlan: () => UnknownRecord | null;
}

const APP_JS_PATH = path.join(__dirname, '..', '..', '..', 'legacy', 'app.js');

const LINE_RANGES: [number, number][] = [
  [4721, 4761], // getLocalAdjustmentRecommendation
  [4763, 4772], // getAdjustmentTitle
  [4908, 4968], // normalizeAICheckinRecommendation
  [4971, 4973], // roundHalf
  [4975, 5043], // applySkippedWorkoutRedistribution
  [5129, 5173], // applyAdjustmentToStoredPlan
];

const EXPECTED_FIRST_LINES: Record<number, string> = {
  4721: 'function getLocalAdjustmentRecommendation(weekIndex, feedback) {',
  4763: 'function getAdjustmentTitle(action) {',
  4908: 'function normalizeAICheckinRecommendation(ai, feedback, localRecommendation) {',
  4971: 'function roundHalf(value) {',
  4975: 'function applySkippedWorkoutRedistribution(weekIndex, feedback) {',
  5129: 'function applyAdjustmentToStoredPlan(weekIndex, factor, action, weeksToAdjust) {',
};

let cached: LegacyAdaptive | null = null;

export function loadLegacyAdaptive(): LegacyAdaptive {
  if (cached) return cached;

  const lines = fs.readFileSync(APP_JS_PATH, 'utf8').split('\n');

  const chunks = LINE_RANGES.map(([start, end]) => {
    const expected = EXPECTED_FIRST_LINES[start];
    const actualFirstLine = lines[start - 1];
    if (expected && actualFirstLine?.trim() !== expected) {
      throw new Error(
        `legacy-adaptive-harness: legacy/app.js mudou de forma — linha ${start} era ` +
          `"${expected}", agora é "${actualFirstLine}". Reconfirme os ranges antes de continuar.`,
      );
    }
    return lines.slice(start - 1, end).join('\n');
  });

  const source = `${chunks.join('\n\n')}
this.getAdjustmentTitle = getAdjustmentTitle;
this.getLocalAdjustmentRecommendation = getLocalAdjustmentRecommendation;
this.normalizeAICheckinRecommendation = normalizeAICheckinRecommendation;
this.roundHalf = roundHalf;
this.applySkippedWorkoutRedistribution = applySkippedWorkoutRedistribution;
this.applyAdjustmentToStoredPlan = applyAdjustmentToStoredPlan;
`;

  let testPlan: UnknownRecord | null = null;
  let workoutStatuses: Record<string, string> = {};
  let lastSavedPlan: UnknownRecord | null = null;

  const sandbox: UnknownRecord = {
    console,
    clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    getWorkoutStatus: (id: string) => workoutStatuses[id] || 'pending',
    AICoach: {
      loadPlan: () => testPlan,
      isPlanAdopted: () => false,
    },
    StorageService: {
      savePlan: (plan: UnknownRecord) => {
        lastSavedPlan = plan;
      },
    },
    applyAdoptedPlan: () => {},
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'legacy/app.js (extrato adaptive-training)' });

  const result = sandbox as unknown as LegacyAdaptive;
  if (typeof result.applyAdjustmentToStoredPlan !== 'function') {
    throw new Error('legacy-adaptive-harness: extração falhou — applyAdjustmentToStoredPlan não é função.');
  }

  result.setTestPlan = (plan: UnknownRecord) => {
    testPlan = plan;
  };
  result.setWorkoutStatuses = (statuses: Record<string, string>) => {
    workoutStatuses = statuses;
  };
  result.getLastSavedPlan = () => lastSavedPlan;

  cached = result;
  return result;
}
