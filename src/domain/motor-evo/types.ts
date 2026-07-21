/**
 * Contrato de tipos do Motor RunEvo (docs/motor-evo-specification.md §2).
 * Domínio puro: nenhum import de react-native, expo-*, @/services ou @/app.
 */

/**
 * Codificação real do legado (ai-coach.js:131-153): `getDistanceKm`/`getDistanceLabel`
 * leem `targetDistance` como STRING NUMÉRICA CRUA via `parseNumber` (ex.: '21', não
 * '21k'). `docs/motor-evo-specification.md` §2 documenta `'5k'|'10k'|'21k'|'42k'`, mas
 * isso quebraria `parseNumber` (`Number('21k')` é `NaN`, cai no fallback 42). Seguimos
 * o legado, não a abreviação do doc — ver nota em `src/tests/motor-evo/fixtures.ts`.
 */
export type TargetDistance = '5' | '10' | '21' | '42' | 'ultra' | 'custom';

export type Terrain = 'plano' | 'misto' | 'elevado';
export type Phase = 'Base' | 'Resistência' | 'Pico' | 'Polimento';
export type DayType = 'Base' | 'Qualidade' | 'Longão' | 'Recuperação' | 'Intervalado';
export type RaceType = '5k' | '10k' | 'meia' | 'maratona' | 'ultra';
export type ZoneStrategy = 'capacity_anchored' | 'goal_anchored' | 'mixed_goal_capacity' | 'fallback';
export type RiskLevel = 'baixo' | 'médio' | 'alto' | 'muito alto';

/** "userData" — entrada do atleta (docs/motor-evo-specification.md §2). */
export interface AthleteInput {
  name?: string;
  age?: number;
  height?: number;
  weight?: number;
  imc?: number;
  /** Nível pt-BR tolerante ("iniciante"|"intermediário"|"avançado"), parsing tolerante. */
  level?: string;
  targetDistance: TargetDistance;
  customDistance?: number;
  terrain?: Terrain;
  terrainType?: Terrain;
  startDate: string;
  raceDate: string;
  daysPerWeek?: number;
  time5k?: string;
  no5k?: boolean;
  time10k?: string;
  no10k?: boolean;
  time21k?: string;
  no21k?: boolean;
  time42k?: string;
  no42k?: boolean;
  test3kmTime?: string;
  test3kmPace?: string;
  objective?: string;
}

export interface Zone {
  label: string;
  name: string;
  perception: string;
  from: string;
  to: string;
  speedFrom: string;
  speedTo: string;
}

export interface TrainingZonesAnchor {
  label: string;
  pace: string;
  speed: string;
  method: 'goal_anchored' | 'capacity_anchored';
  capacityPace?: string | null;
}

export interface TrainingZones {
  anchor: TrainingZonesAnchor;
  Z1: Zone;
  Z2: Zone;
  Z3: Zone;
  Z4: Zone;
  Z5: Zone;
}

export interface Workout {
  dayOfWeek: string;
  dayType: DayType;
  title: string;
  desc: string;
  km: number;
  pace: string;
  zoneTarget: string;
  redistributedFromSkipped?: boolean;
  redistributedKm?: number;
}

export interface Week {
  /** Formato do legado: `"S{n}"` (ex. "S1", "S12"). A conversão para colunas do banco é da Fase 3. */
  week: string;
  phase: Phase;
  off: boolean;
  workouts: Workout[];
}

export interface ValidationIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  week?: number;
  workoutId?: string;
  message: string;
  fixed: boolean;
}
