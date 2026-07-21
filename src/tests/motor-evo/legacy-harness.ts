/**
 * Sandbox de execução do legado `legacy/ai-coach.js` (Node `vm`), usado apenas
 * pelos testes de equivalência da Fase 2 (nunca pelo app em runtime).
 *
 * `fetch` sempre rejeita de propósito: isso força `generateBlueprint` (legado)
 * a cair no catch e usar `buildFallbackBlueprint` — o caminho do blueprint
 * local determinístico, que é o único comparado nesta fase (não o caminho de IA).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export type UnknownRecord = Record<string, unknown>;

export interface LegacyAICoach {
  generatePlan: (userData: UnknownRecord) => Promise<UnknownRecord>;
  calculateWeeks: (startDate: string, raceDate: string) => number;
  buildTrainingZones: (userData: UnknownRecord) => unknown;
  buildLocalPaceZones: (userData: UnknownRecord) => unknown;
  buildPrompt: (userData: UnknownRecord) => string;
  parsePlanResponse: (text: string, userData: UnknownRecord) => UnknownRecord;
  saveProfile: (data: UnknownRecord) => void;
  loadProfile: () => UnknownRecord | null;
  clearProfileDraft: () => void;
  savePlan: (plan: UnknownRecord) => unknown;
  loadPlan: () => unknown;
  clearPlan: () => void;
  adoptPlan: () => boolean;
  unadoptPlan: () => void;
  isPlanAdopted: () => boolean;
  getAdoptedWorkouts: () => unknown;
}

const LEGACY_ENTRY_PATH = path.join(__dirname, '..', '..', '..', 'legacy', 'ai-coach.js');

function createLocalStorageStub(): Storage {
  const store = new Map<string, string>();
  const stub = {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
  Object.defineProperty(stub, 'length', { get: () => store.size });
  return stub as unknown as Storage;
}

function createStorageServiceStub(): UnknownRecord {
  let plan: unknown = null;
  let adopted = false;

  return {
    keys: () => ({ plan: 'ai_plan', adopted: 'ai_adopted' }),
    getCurrentUser: () => 'motor-evo-golden-harness',
    savePlan: (value: unknown) => {
      plan = value;
    },
    loadPlan: () => plan,
    clearPlan: () => {
      plan = null;
    },
    setPlanAdopted: (value: boolean) => {
      adopted = value;
    },
    isPlanAdopted: () => adopted,
  };
}

/** Cache em nível de módulo: um único sandbox `vm` por processo de teste. */
let cachedAICoach: LegacyAICoach | null = null;

export function loadLegacyAICoach(): LegacyAICoach {
  if (cachedAICoach) return cachedAICoach;

  // O legado declara `const AICoach = (() => {...})();` no topo do arquivo.
  // Uma `const` de topo NÃO vira propriedade do objeto global mesmo dentro de
  // um contexto `vm` — só `var`/funções ficam. Precisamos empurrar o valor
  // para `this` (o global do contexto, em modo não-estrito) explicitamente.
  const source = `${fs.readFileSync(LEGACY_ENTRY_PATH, 'utf8')}\nthis.AICoach = AICoach;\n`;

  const sandbox: UnknownRecord = {
    console,
    localStorage: createLocalStorageStub(),
    StorageService: createStorageServiceStub(),
    fetch: () =>
      Promise.reject(
        new Error(
          'rede desabilitada no legacy-harness de propósito — força o blueprint local determinístico',
        ),
      ),
    setTimeout,
    clearTimeout,
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'legacy/ai-coach.js' });

  const AICoach = sandbox.AICoach as LegacyAICoach | undefined;
  if (!AICoach || typeof AICoach.generatePlan !== 'function') {
    throw new Error('legacy-harness: AICoach não foi exposto corretamente pelo legado.');
  }

  (globalThis as UnknownRecord).__AICoach = AICoach;
  cachedAICoach = AICoach;
  return AICoach;
}
