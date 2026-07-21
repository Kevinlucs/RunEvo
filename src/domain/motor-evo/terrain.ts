/**
 * Porte 1:1 de `legacy/ai-coach.js` — terreno.
 * Mapeamento: docs/legacy-audit.md §13.3 (`getTerrainLabel, getTerrainGuidance` → `terrain.ts`).
 */

export interface TerrainGuidance {
  label: string;
  volumeFactor: number;
  longRunFactor: number;
  recoveryEvery: number;
  focus: string;
}

/** ai-coach.js:317-324 */
export function getTerrainLabel(value: string | undefined): string {
  const labels: Record<string, string> = {
    plano: 'Plano',
    misto: 'Misto',
    elevado: 'Elevado',
  };
  return (value !== undefined && labels[value]) || 'Plano';
}

/** ai-coach.js:326-352 */
export function getTerrainGuidance(value: string | undefined): TerrainGuidance {
  const guidance: Record<string, TerrainGuidance> = {
    plano: {
      label: 'terreno plano',
      volumeFactor: 1,
      longRunFactor: 1,
      recoveryEvery: 4,
      focus: 'ritmo contínuo, economia de corrida e progressão de volume/pace',
    },
    misto: {
      label: 'terreno misto',
      volumeFactor: 0.94,
      longRunFactor: 0.94,
      recoveryEvery: 3,
      focus: 'subidas leves/moderadas, controle por zona e fortalecimento específico',
    },
    elevado: {
      label: 'terreno elevado',
      volumeFactor: 0.88,
      longRunFactor: 0.88,
      recoveryEvery: 3,
      focus: 'subidas, técnica, esforço por zona, maior recuperação e menor agressividade de pace',
    },
  };

  return (value !== undefined && guidance[value]) || (guidance.plano as TerrainGuidance);
}
