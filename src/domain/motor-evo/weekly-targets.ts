import { clamp, roundKm, interpolate, easeProgression } from './utils/math';
import { getPhaseForWeek, type PhaseRange } from './phases';
import { MONDAY_INDEXED_DAYS } from './dates';
import type { Phase } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — alvos semanais, dias de treino e limites de segurança.
 * Mapeamento: docs/legacy-audit.md §13.4/§13.5
 * (`getPeakTrainingLongRunLimit, getPeakWeeklyKmLimit` → weekly-targets.ts;
 * `getPhaseForWeek, calculateWeekTargets, getTrainingDays, allocateWorkoutDistances` → weekly-targets.ts).
 */

/** ai-coach.js:883-911 */
export function getPeakTrainingLongRunLimit(
  distanceKm: number,
  level = 'intermediario',
  daysPerWeek = 3,
  totalWeeks = 12,
  imc: number | null = null,
): number {
  const levelStr = String(level || '').toLowerCase();
  const isBeginner = levelStr.includes('inic') || levelStr.includes('begin');
  const isAdvanced = levelStr.includes('av') || levelStr.includes('avan');
  const days = clamp(Number(daysPerWeek || 3), 2, 6);
  const riskFactor = imc && imc >= 30 ? 0.88 : imc && imc >= 27 ? 0.94 : 1;

  let cap: number;
  if (distanceKm <= 5) {
    cap = isAdvanced ? 9 : isBeginner ? 6 : 7;
  } else if (distanceKm <= 10) {
    cap = isAdvanced ? 16 : isBeginner ? 10 : 13;
  } else if (distanceKm <= 21.1) {
    cap = isAdvanced ? 22 : isBeginner ? 16 : 19;
    if (totalWeeks >= 20 && !isBeginner) cap = Math.min(21, cap + 1);
  } else if (distanceKm <= 42.2) {
    cap = isAdvanced ? 34 : isBeginner ? 28 : 32;
    if (days <= 3) cap -= isBeginner ? 2 : 1;
    if (totalWeeks >= 24 && isAdvanced) cap = Math.min(35, cap + 1);
  } else {
    // Em ultra, o maior longão de treino raramente precisa ser a prova inteira.
    // O alvo é tolerância muscular + tempo de esforço, não "provar" a distância antes.
    cap = Math.round(distanceKm * (isAdvanced ? 0.72 : isBeginner ? 0.58 : 0.66));
    cap = clamp(cap, isBeginner ? 30 : 34, isAdvanced ? 46 : 42);
    if (days <= 3) cap = Math.min(cap, isAdvanced ? 44 : 40);
  }

  return Math.max(4, Math.round(cap * riskFactor));
}

/** ai-coach.js:913-933 */
export function getPeakWeeklyKmLimit(
  distanceKm: number,
  level = 'intermediario',
  daysPerWeek = 3,
  totalWeeks = 12,
  imc: number | null = null,
): number {
  const levelStr = String(level || '').toLowerCase();
  const isBeginner = levelStr.includes('inic') || levelStr.includes('begin');
  const isAdvanced = levelStr.includes('av') || levelStr.includes('avan');
  const days = clamp(Number(daysPerWeek || 3), 2, 6);
  const riskFactor = imc && imc >= 30 ? 0.88 : imc && imc >= 27 ? 0.94 : 1;

  let cap: number;
  if (distanceKm <= 10) {
    cap = days <= 3 ? (isAdvanced ? 42 : 34) : 50;
  } else if (distanceKm <= 21.1) {
    cap = days <= 3 ? (isAdvanced ? 42 : isBeginner ? 30 : 36) : 55;
  } else if (distanceKm <= 42.2) {
    cap = days <= 3 ? (isAdvanced ? 62 : isBeginner ? 46 : 56) : 75;
  } else {
    cap = days <= 3 ? (isAdvanced ? 76 : isBeginner ? 58 : 68) : 92;
  }

  if (totalWeeks >= 24 && !isBeginner) cap += distanceKm > 42 ? 4 : 2;
  return Math.round(cap * riskFactor);
}

export interface WeekTargets {
  phase: Phase;
  off: boolean;
  weeklyKm: number;
  longRunKm: number;
}

export interface WeekTargetsBlueprint {
  strategy: {
    initialWeeklyKm: number;
    peakWeeklyKm: number;
    initialLongRunKm: number;
    peakLongRunKm: number;
    recoveryEveryWeeks: number;
    taperWeeks: number;
  };
  engineCalibration?: { progressionStyle?: string; raceType?: string };
  phaseDistribution: PhaseRange[];
  userData?: { daysPerWeek?: number };
}

/** ai-coach.js:1200-1264 */
export function calculateWeekTargets(
  weekNumber: number,
  totalWeeks: number,
  blueprint: WeekTargetsBlueprint,
  distanceKm: number,
): WeekTargets {
  const s = blueprint.strategy;
  const phase = getPhaseForWeek(weekNumber, blueprint, totalWeeks);
  const taperStart = totalWeeks - s.taperWeeks + 1;
  const buildEnd = Math.max(1, taperStart - 1);
  const buildRatio = buildEnd <= 1 ? 1 : (weekNumber - 1) / (buildEnd - 1);
  const eased = easeProgression(buildRatio);

  const calibration = blueprint.engineCalibration || {};
  const progressionStyle = calibration.progressionStyle || 'equilibrada';
  const isUltra = distanceKm > 42.2 || calibration.raceType === 'ultra';
  const days = clamp(Number(blueprint?.userData?.daysPerWeek || 3), 2, 6);

  let weeklyKm = interpolate(s.initialWeeklyKm, s.peakWeeklyKm, eased);
  let longRunKm = interpolate(s.initialLongRunKm, s.peakLongRunKm, eased);
  let isRecovery = false;

  if (weekNumber < taperStart && progressionStyle === 'conservadora') {
    weeklyKm = s.initialWeeklyKm + (weeklyKm - s.initialWeeklyKm) * 0.94;
    longRunKm = s.initialLongRunKm + (longRunKm - s.initialLongRunKm) * 0.94;
  } else if (weekNumber < taperStart && progressionStyle === 'agressiva') {
    weeklyKm = s.initialWeeklyKm + (weeklyKm - s.initialWeeklyKm) * 1.03;
  }

  const recoveryEvery = clamp(Number(s.recoveryEveryWeeks || 4), 3, 5);
  if (weekNumber < taperStart && weekNumber % recoveryEvery === 0) {
    weeklyKm *= isUltra ? 0.78 : 0.75;
    longRunKm *= isUltra ? 0.8 : 0.76;
    isRecovery = true;
  }

  if (weekNumber >= taperStart) {
    const taperPosition = weekNumber - taperStart;
    const taperRatios = s.taperWeeks >= 3 ? [0.72, 0.52, 0.34, 0.25] : [0.62, 0.38, 0.25];
    const ratio = taperRatios[taperPosition] ?? 0.35;

    if (weekNumber === totalWeeks) {
      // Semana da prova: prova alvo + rodagens curtas pré-prova.
      weeklyKm = distanceKm + Math.max(6, Math.min(16, Math.round(s.peakWeeklyKm * 0.12)));
      longRunKm = distanceKm;
    } else {
      weeklyKm = Math.max(days * 3, s.peakWeeklyKm * ratio);
      longRunKm = Math.max(5, s.peakLongRunKm * ratio);
    }

    isRecovery = false;
  }

  // Segurança final: antes da semana da prova, longão de treino nunca vira a distância-alvo completa.
  if (weekNumber !== totalWeeks) {
    const maxTrainingLong = s.peakLongRunKm;
    longRunKm = Math.min(longRunKm, maxTrainingLong);
    const maxLongShare = isUltra ? (days <= 3 ? 0.7 : 0.64) : distanceKm >= 42 ? 0.6 : days <= 3 ? 0.55 : 0.5;
    if (longRunKm > weeklyKm * maxLongShare) {
      weeklyKm = Math.max(weeklyKm, Math.ceil(longRunKm / maxLongShare));
    }
  }

  return {
    phase,
    off: isRecovery,
    weeklyKm: roundKm(weeklyKm),
    longRunKm: roundKm(longRunKm),
  };
}

const PREFERRED_DAYS_BY_COUNT: Record<number, string[]> = {
  2: ['Terça', 'Sábado'],
  3: ['Terça', 'Quinta', 'Sábado'],
  4: ['Segunda', 'Terça', 'Quinta', 'Sábado'],
  5: ['Segunda', 'Terça', 'Quarta', 'Sexta', 'Sábado'],
  6: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sábado', 'Domingo'],
};

const OFFSET_BY_DAYS: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 4, 6],
  5: [0, 1, 2, 4, 6],
  6: [0, 1, 2, 3, 5, 6],
};

/** ai-coach.js:1266-1305 */
export function getTrainingDays(daysPerWeek: number, startDOW: string, isFirstWeek = false): string[] {
  const days = clamp(Number(daysPerWeek || 3), 2, 6);

  if (!isFirstWeek) return PREFERRED_DAYS_BY_COUNT[clamp(days, 2, 6)] || (PREFERRED_DAYS_BY_COUNT[3] as string[]);

  const startIndex = MONDAY_INDEXED_DAYS.indexOf(startDOW as (typeof MONDAY_INDEXED_DAYS)[number]);
  if (startIndex === -1) return PREFERRED_DAYS_BY_COUNT[clamp(days, 2, 6)] || (PREFERRED_DAYS_BY_COUNT[3] as string[]);

  // Primeira semana: o primeiro treino cai na data de início e os demais seguem espaçamento mínimo.
  // Ex.: início no sábado com 3x/semana => Sábado, Segunda e Quarta (16, 18 e 20), nunca sábado/domingo/segunda.
  const offsets = OFFSET_BY_DAYS[days] || (OFFSET_BY_DAYS[3] as number[]);
  const slots: string[] = [];

  offsets.forEach((offset) => {
    const name = MONDAY_INDEXED_DAYS[(startIndex + offset) % 7] as string;
    if (!slots.includes(name)) slots.push(name);
  });

  for (const d of PREFERRED_DAYS_BY_COUNT[days] || (PREFERRED_DAYS_BY_COUNT[3] as string[])) {
    if (slots.length >= days) break;
    if (!slots.includes(d)) slots.push(d);
  }

  return slots.slice(0, days);
}

/** ai-coach.js:1817-1852 */
export function allocateWorkoutDistances(
  daysPerWeek: number,
  weeklyKm: number,
  longRunKm: number,
  isRaceWeek: boolean,
  distanceKm: number,
): number[] {
  const days = clamp(Number(daysPerWeek || 3), 2, 6);
  const distances: number[] = [];

  if (isRaceWeek) {
    const remaining = Math.max(days - 1, 1);
    const preRaceKm = Math.max(3, Math.round(Math.min(weeklyKm - distanceKm, 18) / remaining));
    for (let i = 0; i < days - 1; i++) distances.push(preRaceKm);
    distances.push(roundKm(distanceKm));
    return distances;
  }

  const longKm = Math.min(roundKm(longRunKm), Math.max(1, weeklyKm - (days - 1) * 3));
  const remainingKm = Math.max(days - 1, weeklyKm - longKm);

  const weightsByDays: Record<number, number[]> = {
    2: [1],
    3: [0.45, 0.55],
    4: [0.3, 0.35, 0.35],
    5: [0.22, 0.28, 0.2, 0.3],
    6: [0.18, 0.22, 0.16, 0.2, 0.24],
  };

  const weights = weightsByDays[days] || (weightsByDays[3] as number[]);
  let accumulated = 0;

  for (let i = 0; i < days - 1; i++) {
    const isLastRegular = i === days - 2;
    const km = isLastRegular
      ? Math.max(1, remainingKm - accumulated)
      : roundKm(remainingKm * (weights[i] as number));
    distances.push(km);
    accumulated += km;
  }

  distances.push(longKm);
  return distances.map(roundKm);
}
