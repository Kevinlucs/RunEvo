/**
 * Porte 1:1 de `legacy/ai-coach.js` — terreno.
 * Mapeamento: docs/legacy-audit.md §13.3 (`getTerrainLabel, getTerrainGuidance` → `terrain.ts`).
 * Expandido para 4 terrenos (plano, ondulado, moderado, montanhoso) com backward-compat.
 */

export interface TerrainGuidance {
  label: string;
  volumeFactor: number;
  longRunFactor: number;
  recoveryEvery: number;
  focus: string;
}

export function getTerrainLabel(value: string | undefined): string {
  const labels: Record<string, string> = {
    plano: 'Plano',
    ondulado: 'Ondulado',
    moderado: 'Moderado',
    montanhoso: 'Montanhoso',
    // Backward-compat com dados antigos no banco:
    misto: 'Ondulado',
    elevado: 'Montanhoso',
  };
  return (value !== undefined && labels[value]) || 'Plano';
}

export function getTerrainGuidance(value: string | undefined): TerrainGuidance {
  const guidance: Record<string, TerrainGuidance> = {
    plano: {
      label: 'terreno plano',
      volumeFactor: 1,
      longRunFactor: 1,
      recoveryEvery: 4,
      focus: 'ritmo contínuo, economia de corrida e progressão de volume/pace',
    },
    ondulado: {
      label: 'terreno ondulado',
      volumeFactor: 0.96,
      longRunFactor: 0.96,
      recoveryEvery: 3,
      focus: 'subidas leves, controle de esforço por zona e economia em descida',
    },
    moderado: {
      label: 'terreno moderado',
      volumeFactor: 0.92,
      longRunFactor: 0.92,
      recoveryEvery: 3,
      focus: 'subidas moderadas, fortalecimento específico e controle de pace em aclive',
    },
    montanhoso: {
      label: 'terreno montanhoso',
      volumeFactor: 0.86,
      longRunFactor: 0.86,
      recoveryEvery: 2,
      focus: 'subidas longas, técnica de montanha, esforço por zona, maior recuperação e menor agressividade de pace',
    },
    // Backward-compat: dados antigos salvos no banco como 'misto' ou 'elevado'
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
