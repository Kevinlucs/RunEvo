import { secondsToPace } from './pace';
import type { TrainingZones } from './types';
import type { WorkoutTemplate } from './workout-library';
import type { LocalPaceZones } from './zones';
import type { Phase } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — prescrição de treino (zona a zona).
 * Mapeamento: docs/legacy-audit.md §13.5 (`paceForWorkout, .../buildProfessionalWorkoutDescription` → workout-prescription.ts).
 */

const DEFAULT_PACE_ZONES = {
  easy: 'Leve',
  moderate: 'Moderado',
  threshold: 'Forte controlado',
  interval: 'Forte',
  long: 'Leve',
  racePace: 'Ritmo de prova',
} as const;

interface PrescriptionBlueprint {
  paceZones?: Partial<LocalPaceZones> | null;
  engineCalibration?: {
    goalContext?: { raceType?: string };
    intensityBias?: string;
  };
}

/** ai-coach.js:1454-1461 */
export function paceForWorkout(dayType: string, blueprint: PrescriptionBlueprint): string {
  const zones = blueprint.paceZones || DEFAULT_PACE_ZONES;
  if (dayType === 'Intervalado') return zones.interval || DEFAULT_PACE_ZONES.interval;
  if (dayType === 'Qualidade') return zones.threshold || zones.moderate || DEFAULT_PACE_ZONES.threshold;
  if (dayType === 'Longão') return zones.long || zones.easy || DEFAULT_PACE_ZONES.long;
  if (dayType === 'Recuperação') return zones.easy || DEFAULT_PACE_ZONES.easy;
  return zones.moderate || zones.easy || DEFAULT_PACE_ZONES.moderate;
}

/** ai-coach.js:1463-1466 */
export function easyPaceForWorkout(blueprint: PrescriptionBlueprint): string {
  const zones = blueprint.paceZones || DEFAULT_PACE_ZONES;
  return zones.easy || DEFAULT_PACE_ZONES.easy;
}

/** ai-coach.js:1468-1471 */
export function moderatePaceForWorkout(blueprint: PrescriptionBlueprint): string {
  const zones = blueprint.paceZones || DEFAULT_PACE_ZONES;
  return zones.moderate || zones.threshold || DEFAULT_PACE_ZONES.moderate;
}

/** ai-coach.js:1473-1476 */
export function racePaceForWorkout(blueprint: PrescriptionBlueprint): string {
  const zones = blueprint.paceZones || DEFAULT_PACE_ZONES;
  return zones.racePace || zones.threshold || DEFAULT_PACE_ZONES.racePace;
}

/** ai-coach.js:1479-1481 */
export function stripPaceSuffix(value = ''): string {
  return String(value || '').replace('/km', '').trim();
}

/** ai-coach.js:1483-1488 */
export function parsePaceToSeconds(value = ''): number | null {
  const clean = stripPaceSuffix(value);
  const match = clean.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** ai-coach.js:1490-1509 */
export function zoneRepresentativeSeconds(zoneKey: string | null | undefined, trainingZones: TrainingZones | null): number | null {
  const zone = zoneKey ? trainingZones?.[zoneKey as keyof TrainingZones] : undefined;
  if (!zone || typeof zone !== 'object' || !('from' in zone)) return null;

  const from = parsePaceToSeconds(zone.from);
  const to = parsePaceToSeconds(zone.to);

  // Pace planejado conservador: usa sempre o meio termo da faixa da zona.
  // Ex.: Z1 5:16 até 6:40 => 5:58/km.
  if (from && to) {
    const fast = Math.min(from, to);
    const slow = Math.max(from, to);
    return Math.round((fast + slow) / 2);
  }

  if (to) return to;
  if (from) return from;

  return null;
}

/** ai-coach.js:1511-1520 */
export function parseDistanceTokenToKm(token = ''): number {
  const raw = String(token || '').trim().toLowerCase().replace(',', '.');
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(km|m)/i);
  if (!match) return 0;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;

  return match[2]?.toLowerCase() === 'm' ? value / 1000 : value;
}

/** ai-coach.js:1522-1562 */
export function estimatePaceFromPrescription(desc = '', trainingZones: TrainingZones | null = null): string | null {
  if (!trainingZones) return null;

  const text = String(desc || '');
  let weightedSeconds = 0;
  let totalKm = 0;

  const processSegment = (distanceToken: string, zoneToken: string | undefined, multiplier = 1): void => {
    const km = parseDistanceTokenToKm(distanceToken) * multiplier;
    const zone = String(zoneToken || '').toUpperCase().match(/Z[1-5]/)?.[0];
    const seconds = zoneRepresentativeSeconds(zone, trainingZones);

    if (!km || !seconds) return;

    weightedSeconds += km * seconds;
    totalKm += km;
  };

  // Repetition blocks: 3x (1km em Z3 + 1km em Z1)
  const repRegex = /(\d+)\s*x\s*\(([^)]+)\)/gi;
  const withoutRepeats = text.replace(repRegex, (_full, reps: string, inside: string) => {
    const multiplier = Number(reps) || 1;
    const segmentRegex = /(\d+(?:[,.]\d+)?\s*(?:km|m))\s*em\s*(Z[1-5])/gi;
    let seg: RegExpExecArray | null;
    while ((seg = segmentRegex.exec(inside)) !== null) {
      processSegment(seg[1] as string, seg[2], multiplier);
    }
    return ' ';
  });

  const simpleRegex = /(\d+(?:[,.]\d+)?\s*(?:km|m))\s*em\s*(Z[1-5])/gi;
  let simple: RegExpExecArray | null;
  while ((simple = simpleRegex.exec(withoutRepeats)) !== null) {
    processSegment(simple[1] as string, simple[2], 1);
  }

  if (!totalKm) return null;

  return secondsToPace(Math.round(weightedSeconds / totalKm));
}

/** ai-coach.js:1565-1569 */
export function kmPart(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.5, Math.round(n * 10) / 10);
}

/** ai-coach.js:1571-1574 */
export function formatKmValue(value: unknown): string {
  const n = kmPart(value);
  return Number.isInteger(n) ? `${n}km` : `${String(n).replace('.', ',')}km`;
}

/** ai-coach.js:1576-1581 */
export function buildSimpleZonePrescription(rows: unknown[]): string {
  return rows
    .filter(Boolean)
    .map((row) => String(row).trim())
    .join('\n');
}

export interface DistanceSplit {
  total: number;
  warm: number;
  main: number;
  cool: number;
}

/** ai-coach.js:1583-1589 */
export function splitDistance(totalKm: number, warmDefault = 1, coolDefault = 1): DistanceSplit {
  const total = kmPart(totalKm);
  const warm = total >= 10 ? 2 : total >= 7 ? 1 : warmDefault;
  const cool = total >= 10 ? 2 : total >= 7 ? 1 : coolDefault;
  const main = Math.max(1, kmPart(total - warm - cool));
  return { total, warm, main, cool };
}

/** ai-coach.js:1591-1606 */
export function buildFartlekBlock(totalKm: number): string[] {
  const warm = 1;
  const cool = 1;
  const main = Math.max(2, kmPart(totalKm - warm - cool));
  const reps = Math.max(1, Math.floor(main / 2));
  const leftover = kmPart(main - reps * 2);

  const rows = [`${formatKmValue(warm)} em Z1`, `${reps}x (1km em Z3 + 1km em Z1)`];

  if (leftover >= 0.5) rows.push(`${formatKmValue(leftover)} em Z2`);
  rows.push(`${formatKmValue(cool)} em Z1`);
  return rows;
}

export interface WorkoutDescriptionInput {
  template: WorkoutTemplate;
  km: number;
  pace: string;
  phase: Phase;
  blueprint: PrescriptionBlueprint;
  isRaceWeek: boolean;
  distanceKm: number;
}

/** ai-coach.js:1608-1815 */
// eslint-disable-next-line complexity -- porte 1:1 da árvore de decisão do legado; não simplificar.
export function buildProfessionalWorkoutDescription({
  template,
  km,
  phase,
  blueprint,
  isRaceWeek,
}: WorkoutDescriptionInput): string {
  const totalKm = kmPart(km);
  const dayType = template.dayType;
  const title = String(template.title || '').toLowerCase();

  if (isRaceWeek && dayType === 'Longão') {
    const goalCtx = blueprint?.engineCalibration?.goalContext;
    if (goalCtx?.raceType === 'ultra') {
      return buildSimpleZonePrescription([
        `${formatKmValue(Math.max(3, Math.round(totalKm * 0.2)))} em Z1`,
        `${formatKmValue(Math.max(5, Math.round(totalKm * 0.65)))} em Z2`,
        `${formatKmValue(Math.max(2, Math.round(totalKm * 0.15)))} em Z3 controlado se estiver bem`,
      ]);
    }

    return buildSimpleZonePrescription([
      `${formatKmValue(Math.max(2, Math.round(totalKm * 0.2)))} em Z1`,
      `${formatKmValue(Math.max(3, Math.round(totalKm * 0.6)))} em Z3`,
      `${formatKmValue(Math.max(1, Math.round(totalKm * 0.2)))} progressivo se estiver bem`,
    ]);
  }

  if (dayType === 'Recuperação') {
    const { warm, main, cool } = splitDistance(totalKm, 1, 1);
    if (title.includes('técnico') || title.includes('tecnico')) {
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `6x (20s educativo técnico + 60s trote em Z1)`,
        `${formatKmValue(Math.max(1, main - 1))} em Z1`,
        `${formatKmValue(cool)} em Z1`,
      ]);
    }
    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${formatKmValue(main)} em Z1`,
      `${formatKmValue(cool)} em Z1`,
    ]);
  }

  if (dayType === 'Base') {
    if (phase === 'Polimento' || title.includes('ativação')) {
      return buildSimpleZonePrescription([
        `${formatKmValue(Math.min(2, Math.max(1, totalKm * 0.35)))} em Z1`,
        `4x (15s em Z4 + 60s em Z1)`,
        `${formatKmValue(Math.min(2, Math.max(1, totalKm * 0.35)))} em Z1`,
      ]);
    }

    if (title.includes('técnica') || title.includes('tecnica') || title.includes('educativo')) {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `6x (30s educativo técnico + 60s trote em Z1)`,
        `${formatKmValue(Math.max(1, main - 1))} em Z2 confortável`,
        `${formatKmValue(cool)} em Z1`,
      ]);
    }

    if (title.includes('strides')) {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(Math.max(1, main - 1))} em Z2 confortável`,
        `6x (20s em Z4 relaxado + 70s em Z1)`,
        `${formatKmValue(cool)} em Z1`,
      ]);
    }

    if (title.includes('econômica') || title.includes('economica')) {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(main)} em Z2 com foco em cadência e postura`,
        `${formatKmValue(cool)} em Z1`,
      ]);
    }

    const { warm, main, cool } = splitDistance(totalKm, 1, 1);
    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${formatKmValue(main)} em Z2`,
      `${formatKmValue(cool)} em Z1`,
    ]);
  }

  if (dayType === 'Qualidade' && title.includes('subida')) {
    const { warm, main, cool } = splitDistance(totalKm, 1, 1);
    const reps = totalKm >= 8 ? 8 : 6;
    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${reps}x (45s subida em Z3/Z4 controlado + descida/trote em Z1)`,
      `${formatKmValue(Math.max(1, main - 2))} em Z2 confortável`,
      `${formatKmValue(cool)} em Z1`,
    ]);
  }

  if (dayType === 'Qualidade' && title.includes('fartlek')) {
    if (title.includes('leve') || title.includes('técnico') || title.includes('tecnico')) {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      const reps = totalKm >= 9 ? 6 : 5;
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${reps}x (2min em Z3 controlado + 2min em Z1)`,
        `${formatKmValue(Math.max(1, main - 3))} em Z2 se sobrar distância`,
        `${formatKmValue(cool)} em Z1`,
      ]);
    }
    return buildSimpleZonePrescription(buildFartlekBlock(totalKm));
  }

  if (dayType === 'Qualidade' && (title.includes('tempo') || title.includes('limiar'))) {
    const { warm, main, cool } = splitDistance(totalKm, 1, 1);
    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${formatKmValue(Math.max(1, main * 0.65))} em Z3`,
      `${formatKmValue(Math.max(1, main * 0.35))} em Z2`,
      `${formatKmValue(cool)} em Z1`,
    ]);
  }

  if (title.includes('progressivo')) {
    const { warm, main, cool } = splitDistance(totalKm, 1, 1);
    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${formatKmValue(Math.max(1, main / 2))} em Z2`,
      `${formatKmValue(Math.max(1, main / 2))} em Z3 controlado`,
      `${formatKmValue(cool)} em Z1`,
    ]);
  }

  if (dayType === 'Qualidade' && (title.includes('ritmo') || title.includes('prova') || title.includes('alvo'))) {
    const { warm, main, cool } = splitDistance(totalKm, 1, 1);
    if (title.includes('curto')) {
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `3x (${formatKmValue(Math.max(1, Math.round(main / 4)))} em Z3 + 500m em Z1)`,
        `${formatKmValue(cool)} em Z1`,
      ]);
    }
    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${formatKmValue(main)} em Z3 controlado`,
      `${formatKmValue(cool)} em Z1`,
    ]);
  }

  if (dayType === 'Intervalado') {
    const { warm, cool } = splitDistance(totalKm, 1, 1);
    const reps = title.includes('curto') ? (totalKm >= 8 ? 8 : 6) : totalKm >= 10 ? 6 : totalKm >= 7 ? 5 : 4;
    const shot = title.includes('curto') ? '400m' : totalKm >= 9 ? '800m' : '600m';
    const recovery = title.includes('curto') ? '300m' : totalKm >= 9 ? '400m' : '300m';

    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${reps}x (${shot} em Z4 + ${recovery} em Z1)`,
      `${formatKmValue(cool)} em Z1`,
    ]);
  }

  if (dayType === 'Longão') {
    const total = kmPart(totalKm);
    const warm = Math.max(1, Math.round(total * 0.15));
    const main = Math.max(2, Math.round(total * 0.7));
    const final = Math.max(1, kmPart(total - warm - main));

    if (phase === 'Polimento') {
      return buildSimpleZonePrescription([`${formatKmValue(warm)} em Z1`, `${formatKmValue(main + final)} em Z2`, `1km em Z1`]);
    }

    const goalCtx = blueprint?.engineCalibration?.goalContext;
    const lowIntensity = blueprint?.engineCalibration?.intensityBias === 'baixo' || goalCtx?.raceType === 'ultra';

    if (title.includes('ritmo alvo') || title.includes('específico') || title.includes('especifico')) {
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(Math.max(2, Math.round(main * 0.7)))} em Z2`,
        `${formatKmValue(Math.max(1, Math.round(main * 0.3)))} em Z3 controlado`,
        `${formatKmValue(final)} em Z1`,
      ]);
    }

    if (title.includes('progressivo')) {
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(Math.max(2, Math.round(main * 0.65)))} em Z2`,
        `${formatKmValue(Math.max(1, Math.round(main * 0.35)))} em ${lowIntensity ? 'Z2 firme' : 'Z3 se estiver bem'}`,
        `${formatKmValue(final)} em Z1`,
      ]);
    }

    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${formatKmValue(main)} em Z2`,
      `${formatKmValue(final)} em ${lowIntensity ? 'Z2' : 'Z3 se estiver bem'}`,
    ]);
  }

  const { warm, main, cool } = splitDistance(totalKm, 1, 1);
  return buildSimpleZonePrescription([
    `${formatKmValue(warm)} em Z1`,
    `${formatKmValue(main)} em Z2`,
    `${formatKmValue(cool)} em Z1`,
  ]);
}
