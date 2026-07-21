import { parseNumber } from './utils/math';
import type { AthleteInput } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — perfil (só a parte pura; sanitizeProfileDraft/
 * saveProfile/loadProfile dependem de localStorage e ficam para repositories na Fase 3).
 * Mapeamento: docs/legacy-audit.md §13.1 (`calculateIMC` → `profile.ts`).
 */

/** ai-coach.js:100-109 */
export function calculateIMC(userData: Pick<AthleteInput, 'imc' | 'weight' | 'height'>): number | null {
  if (userData.imc) return parseNumber(userData.imc, null);

  const weight = parseNumber(userData.weight, 0);
  const heightCm = parseNumber(userData.height, 0);
  if (!weight || !heightCm) return null;

  const heightM = heightCm / 100;
  return Number((weight / (heightM * heightM)).toFixed(1));
}
