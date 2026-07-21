import { secondsToPace, speedFromPaceSeconds, paceSecondsFromSpeed, formatSpeed } from './pace';
import { getGoalContext, inferBasePaceSeconds, type GoalContext } from './objective';
import type { AthleteInput, TrainingZones, Zone, ZoneStrategy } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — zonas de treino (Z1-Z5).
 * Mapeamento: docs/legacy-audit.md §13.3
 * (`zoneRangeFromSpeedPercent, buildZoneRangeFromPaces, buildGoalAnchoredZones,
 * buildTrainingZones, buildLocalPaceZones` → `zones.ts`).
 */

/** ai-coach.js:14-21 */
const DEFAULT_PACE_ZONES = {
  easy: 'Leve',
  moderate: 'Moderado',
  threshold: 'Forte controlado',
  interval: 'Forte',
  long: 'Leve',
  racePace: 'Ritmo de prova',
} as const;

export interface LocalPaceZones {
  easy: string;
  moderate: string;
  threshold: string;
  interval: string;
  long: string;
  racePace: string;
  trainingZones: TrainingZones | null;
  zoneMethod: ZoneStrategy;
  goalContext: GoalContext;
}

type AthleteZoneInput = Pick<
  AthleteInput,
  | 'objective'
  | 'targetDistance'
  | 'customDistance'
  | 'no5k'
  | 'time5k'
  | 'no10k'
  | 'time10k'
  | 'no21k'
  | 'time21k'
  | 'no42k'
  | 'time42k'
  | 'test3kmPace'
  | 'test3kmTime'
  | 'terrain'
  | 'terrainType'
>;

/** ai-coach.js:509-520 */
export function zoneRangeFromSpeedPercent(
  baseSeconds: number,
  minPercent: number,
  maxPercent: number,
): Pick<Zone, 'from' | 'to' | 'speedFrom' | 'speedTo'> {
  const baseSpeed = speedFromPaceSeconds(baseSeconds) as number;
  const fast = paceSecondsFromSpeed(baseSpeed * maxPercent) as number;
  const slow = paceSecondsFromSpeed(baseSpeed * minPercent) as number;

  return {
    from: secondsToPace(fast),
    to: secondsToPace(slow),
    speedFrom: formatSpeed(baseSpeed * maxPercent),
    speedTo: formatSpeed(baseSpeed * minPercent),
  };
}

/** ai-coach.js:522-531 */
export function buildZoneRangeFromPaces(
  fastSeconds: number,
  slowSeconds: number,
): Pick<Zone, 'from' | 'to' | 'speedFrom' | 'speedTo'> {
  const fast = Math.min(fastSeconds, slowSeconds);
  const slow = Math.max(fastSeconds, slowSeconds);
  return {
    from: secondsToPace(fast),
    to: secondsToPace(slow),
    speedFrom: formatSpeed(speedFromPaceSeconds(fast)),
    speedTo: formatSpeed(speedFromPaceSeconds(slow)),
  };
}

/** ai-coach.js:533-599 */
export function buildGoalAnchoredZones(userData: AthleteZoneInput, context: GoalContext): TrainingZones | null {
  const goal = context.goalPace;
  if (!goal) return null;

  const isUltra = context.raceType === 'ultra';
  const isMarathon = context.raceType === 'maratona';

  const offsets = isUltra
    ? { z1: [75, 135], z2: [25, 70], z3: [-10, 20], z4: [-45, -15], z5: [-75, -45] }
    : isMarathon
      ? { z1: [60, 120], z2: [20, 60], z3: [-10, 20], z4: [-40, -10], z5: [-70, -40] }
      : { z1: [45, 95], z2: [15, 45], z3: [-10, 15], z4: [-35, -10], z5: [-60, -35] };

  const test = context.testPace;

  function capFast(seconds: number, zoneKey: 'Z4' | 'Z5'): number {
    if (!test || !Number.isFinite(test)) return seconds;
    if (zoneKey === 'Z4') return Math.max(seconds, test + (isUltra ? 90 : 60));
    if (zoneKey === 'Z5') return Math.max(seconds, test + (isUltra ? 60 : 30));
    return seconds;
  }

  const z1 = offsets.z1 as [number, number];
  const z2 = offsets.z2 as [number, number];
  const z3 = offsets.z3 as [number, number];
  const z4 = offsets.z4 as [number, number];
  const z5 = offsets.z5 as [number, number];

  return {
    anchor: {
      label: isUltra ? 'Objetivo de ultra' : 'Objetivo da prova',
      pace: secondsToPace(goal),
      speed: formatSpeed(speedFromPaceSeconds(goal)),
      capacityPace: test ? secondsToPace(test) : null,
      method: 'goal_anchored',
    },
    Z1: {
      label: 'Z1',
      name: 'Regenerativo / muito leve',
      perception:
        'Ritmo bem leve para recuperar, aquecer, desaquecer e acumular volume sem estourar carga.',
      ...buildZoneRangeFromPaces(goal + z1[0], goal + z1[1]),
    },
    Z2: {
      label: 'Z2',
      name: 'Aeróbico confortável',
      perception: 'Base aeróbica confortável. Deve permitir conversa e sustentar longões com controle.',
      ...buildZoneRangeFromPaces(goal + z2[0], goal + z2[1]),
    },
    Z3: {
      label: 'Z3',
      name: isUltra ? 'Ritmo específico de prova' : 'Ritmo sustentado',
      perception: isUltra
        ? 'Blocos controlados próximos ao pace alvo da ultra. Não é tiro; é especificidade.'
        : 'Ritmo controlado próximo ao objetivo da prova.',
      ...buildZoneRangeFromPaces(goal + z3[0], goal + z3[1]),
    },
    Z4: {
      label: 'Z4',
      name: 'Forte controlado',
      perception: 'Estímulo curto e controlado para economia, técnica e subidas. Uso moderado.',
      ...buildZoneRangeFromPaces(capFast(goal + z4[0], 'Z4'), capFast(goal + z4[1], 'Z4')),
    },
    Z5: {
      label: 'Z5',
      name: 'Velocidade curta / strides',
      perception: 'Uso raro, curto e técnico. Não deve dominar preparação de provas longas.',
      from: 'Máximo',
      to: secondsToPace(capFast(goal + z5[1], 'Z5')),
      speedFrom: 'Máximo',
      speedTo: formatSpeed(speedFromPaceSeconds(capFast(goal + z5[1], 'Z5'))),
    },
  };
}

/** ai-coach.js:601-655 */
export function buildTrainingZones(userData: AthleteZoneInput): TrainingZones | null {
  const context = getGoalContext(userData);
  const base = inferBasePaceSeconds(userData);

  if (context.zoneStrategy === 'goal_anchored') {
    const goalZones = buildGoalAnchoredZones(userData, context);
    if (goalZones) return goalZones;
  }

  if (!base) return null;

  const baseSpeed = speedFromPaceSeconds(base) as number;

  return {
    anchor: {
      label: 'Teste 3km',
      pace: secondsToPace(base),
      speed: formatSpeed(baseSpeed),
      method: 'capacity_anchored',
    },
    Z1: {
      label: 'Z1',
      name: 'Recuperação / muito leve',
      perception: 'Ritmo muito confortável para aquecer, desacelerar e recuperar.',
      ...zoneRangeFromSpeedPercent(base, 0.6, 0.76),
    },
    Z2: {
      label: 'Z2',
      name: 'Leve confortável',
      perception: 'Ritmo leve e sustentável, um pouco mais forte que Z1.',
      ...zoneRangeFromSpeedPercent(base, 0.76, 0.87),
    },
    Z3: {
      label: 'Z3',
      name: 'Moderado / referência do teste',
      perception: 'Ritmo controlado e confortável forte. Usado com cautela conforme objetivo.',
      ...zoneRangeFromSpeedPercent(base, 0.93, 1.0),
    },
    Z4: {
      label: 'Z4',
      name: 'Forte controlado',
      perception: 'Ritmo forte para fartleks, tiros longos e blocos de qualidade.',
      ...zoneRangeFromSpeedPercent(base, 1.02, 1.15),
    },
    Z5: {
      label: 'Z5',
      name: 'Máximo / tiro',
      perception: 'Ritmo máximo para estímulos curtos. Usar com cautela.',
      from: 'Máximo',
      to: secondsToPace(paceSecondsFromSpeed(baseSpeed * 1.15) as number),
      speedFrom: 'Máximo',
      speedTo: formatSpeed(baseSpeed * 1.15),
    },
  };
}

/** ai-coach.js:657-683 */
export function buildLocalPaceZones(userData: AthleteZoneInput): LocalPaceZones {
  const trainingZones = buildTrainingZones(userData);
  const context = getGoalContext(userData);

  if (!trainingZones) {
    return {
      ...DEFAULT_PACE_ZONES,
      trainingZones: null,
      zoneMethod: 'fallback',
      goalContext: context,
    };
  }

  // ai-coach.js:670,675-676 — `endurance` só alimenta dois ternários cujos dois
  // ramos são idênticos ('Z3'/'Z3' e 'Z4'/'Z4'): no-op preservado do legado
  // de propósito (fidelidade > "limpeza"), não é lógica nova.
  const endurance = context.zoneStrategy === 'goal_anchored';

  return {
    easy: 'Z1',
    moderate: 'Z2',
    threshold: endurance ? 'Z3' : 'Z3',
    interval: endurance && context.raceType === 'ultra' ? 'Z4' : 'Z4',
    long: 'Z2',
    racePace: 'Z3',
    trainingZones,
    zoneMethod: context.zoneStrategy,
    goalContext: context,
  };
}
