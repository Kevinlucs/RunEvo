import { clamp, roundKm } from './utils/math';
import { calculateWeeks, getStartDayOfWeek, MONDAY_INDEXED_DAYS } from './dates';
import { getDistanceKm, getDistanceLabel, getGoalContext } from './objective';
import { calculateIMC } from './profile';
import { buildFallbackBlueprint } from './blueprint';
import { getTrainingDays } from './weekly-targets';
import {
  parsePaceToSeconds,
  zoneRepresentativeSeconds,
  estimatePaceFromPrescription,
  buildSimpleZonePrescription,
  buildFartlekBlock,
  paceForWorkout,
} from './workout-prescription';
import { generateWorkoutWeek, type Plan } from './plan-generator';
import { calculatePlanQualityScore, type QualityScore } from './quality-score';
import { calculatePlanRiskLevel } from './risk';
import { sumWeekKm, getPreviousNonRecoveryWeek } from './plan-metrics';
import type { AthleteInput, DayType, Phase, ValidationIssue, Week, Workout } from './types';
import type { PlanBlueprint } from './blueprint';

/** docs/legacy-audit.md §13.6 lista `sumWeekKm` como de `validation.ts` — reexportado de `plan-metrics.ts` (ver ali o porquê). */
export { sumWeekKm };

/**
 * Porte 1:1 de `legacy/ai-coach.js` — validação e autocorreção.
 * Mapeamento: docs/legacy-audit.md §13.6 (validateAndFixPlan e helpers → validation.ts).
 */

const VALID_PHASES: Phase[] = ['Base', 'Resistência', 'Pico', 'Polimento'];
const VALID_DAY_TYPES: DayType[] = ['Qualidade', 'Base', 'Longão', 'Recuperação', 'Intervalado'];

export interface ValidationSummary {
  totalIssues: number;
  totalFixes: number;
  totalWarnings: number;
  varietyFixes?: number;
  totalKm?: number;
  initialWeeklyKm?: number;
  peakWeekKm?: number;
  peakWeeklyKm?: number;
  peakTrainingLongRunKm?: number;
  peakLongRunKm?: number;
  biggestTrainingLongRunKm?: number;
  biggestLongRunKm?: number;
  raceDistanceKm?: number;
  raceWeekIncludesGoal?: boolean;
  recoveryWeeks?: string[];
  taperWeeks?: string[];
  raceWeek?: string;
  totalWeeks?: number;
  daysPerWeek?: number;
  qualityScore?: number;
  qualityStatus?: string;
  riskLevel?: string;
  riskPoints?: number;
  riskReasons?: string[];
}

export interface ValidationReport {
  status: 'ok' | 'warning' | 'error';
  checkedAt: string;
  issues: ValidationIssue[];
  fixed: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: ValidationSummary;
  quality?: QualityScore;
}

/** ai-coach.js:1907-1920 */
export function createValidationReport(): ValidationReport {
  return {
    status: 'ok',
    checkedAt: new Date().toISOString(),
    issues: [],
    fixed: [],
    warnings: [],
    summary: {
      totalIssues: 0,
      totalFixes: 0,
      totalWarnings: 0,
    },
  };
}

/** ai-coach.js:1922-1943 */
export function addValidationIssue(
  report: ValidationReport,
  severity: ValidationIssue['severity'],
  code: string,
  message: string,
  path = '',
  fixed = false,
): void {
  const issue: ValidationIssue = {
    severity,
    code,
    message,
    path,
    fixed,
    at: new Date().toISOString(),
  };

  report.issues.push(issue);

  if (fixed) report.fixed.push(issue);
  if (severity === 'warning') report.warnings.push(issue);

  report.summary.totalIssues = report.issues.length;
  report.summary.totalFixes = report.fixed.length;
  report.summary.totalWarnings = report.warnings.length;

  if (severity === 'error' && !fixed) report.status = 'error';
  if (severity === 'warning' && report.status === 'ok') report.status = 'warning';
}

/** ai-coach.js:1945-1947 */
export function isValidDayName(dayName: unknown): boolean {
  return MONDAY_INDEXED_DAYS.includes(dayName as (typeof MONDAY_INDEXED_DAYS)[number]);
}

/** ai-coach.js:1949-1951 */
export function normalizePhaseValue(phase: unknown, fallbackPhase: Phase): Phase {
  return VALID_PHASES.includes(phase as Phase) ? (phase as Phase) : fallbackPhase;
}

/** ai-coach.js:1953-1955 */
export function normalizeDayTypeValue(dayType: unknown, fallbackDayType: DayType = 'Base'): DayType {
  return VALID_DAY_TYPES.includes(dayType as DayType) ? (dayType as DayType) : fallbackDayType;
}

/** ai-coach.js:1957-1998 */
export function normalizeWorkoutForValidation(
  workout: Partial<Workout> | null | undefined,
  fallbackWorkout: Partial<Workout> | null | undefined,
  report: ValidationReport,
  path: string,
): Workout {
  const source = workout || {};
  const fallback = fallbackWorkout || {};

  const sourceDesc = String(source.desc || '').trim();
  const fallbackDesc = String(fallback.desc || '').trim();
  const shouldUseFallbackDesc =
    !sourceDesc ||
    sourceDesc.length < 90 ||
    /alternar blocos|corrida leve|ritmo confortável|boa recuperação/i.test(sourceDesc);

  // ai-coach.js:1965-1972 — o objeto "clean" do legado NÃO inclui zoneTarget
  // (só dayOfWeek/dayType/title/desc/km/pace). zoneTarget só reaparece num
  // workout específico se enforceContextualPaceCoherence/enforceWorkoutVariety
  // o tocarem depois — daí ser opcional em `Workout` (types.ts).
  const clean: Workout = {
    dayOfWeek: isValidDayName(source.dayOfWeek) ? (source.dayOfWeek as string) : fallback.dayOfWeek || 'Terça',
    dayType: normalizeDayTypeValue(source.dayType, fallback.dayType || 'Base'),
    title: String(source.title || fallback.title || 'Treino').slice(0, 55),
    desc: String(shouldUseFallbackDesc ? fallbackDesc : sourceDesc).slice(0, 650),
    km: roundKm(source.km || fallback.km || 1),
    pace: source.pace || fallback.pace || '-',
  };

  if (!isValidDayName(source.dayOfWeek)) {
    addValidationIssue(
      report,
      'warning',
      'WORKOUT_DAY_FIXED',
      'Dia do treino ajustado para um dia válido.',
      `${path}.dayOfWeek`,
      true,
    );
  }

  if (!VALID_DAY_TYPES.includes(source.dayType as DayType)) {
    addValidationIssue(
      report,
      'warning',
      'WORKOUT_TYPE_FIXED',
      'Tipo do treino ajustado para um tipo válido.',
      `${path}.dayType`,
      true,
    );
  }

  if (!source.title) {
    addValidationIssue(
      report,
      'warning',
      'WORKOUT_TITLE_FIXED',
      'Título ausente preenchido automaticamente.',
      `${path}.title`,
      true,
    );
  }

  if (!Number.isFinite(Number(source.km)) || Number(source.km) <= 0) {
    addValidationIssue(
      report,
      'warning',
      'WORKOUT_KM_FIXED',
      'Distância inválida ajustada automaticamente.',
      `${path}.km`,
      true,
    );
  }

  return clean;
}

/** ai-coach.js:2004-2023 */
export function scaleWeekDistances(week: Week, targetKm: number, minimumKmPerWorkout = 1): Week {
  const workouts = week.workouts || [];
  const currentKm = sumWeekKm(week);
  if (!workouts.length || currentKm <= 0 || !Number.isFinite(targetKm)) return week;

  const factor = targetKm / currentKm;
  let accumulated = 0;

  workouts.forEach((workout, index) => {
    const isLast = index === workouts.length - 1;
    const km = isLast
      ? Math.max(minimumKmPerWorkout, Math.round(targetKm - accumulated))
      : Math.max(minimumKmPerWorkout, Math.round(Number(workout.km || 0) * factor));

    workout.km = km;
    accumulated += km;
  });

  return week;
}

/** ai-coach.js:2025-2047 */
export function alignWorkoutDays(
  week: Week,
  weekNumber: number,
  userData: Pick<AthleteInput, 'daysPerWeek' | 'startDate'>,
  report: ValidationReport,
): Week {
  const daysPerWeek = clamp(Number(userData.daysPerWeek || 3), 2, 6);
  const expectedDays = getTrainingDays(daysPerWeek, getStartDayOfWeek(userData), weekNumber === 1);

  week.workouts.forEach((workout, index) => {
    const expectedDay = expectedDays[index] || expectedDays[expectedDays.length - 1] || 'Sábado';

    if (workout.dayOfWeek !== expectedDay) {
      addValidationIssue(
        report,
        'warning',
        'WORKOUT_DAY_ALIGNED',
        `Dia do treino alinhado para ${expectedDay}.`,
        `weeks[${weekNumber - 1}].workouts[${index}].dayOfWeek`,
        true,
      );

      workout.dayOfWeek = expectedDay;
    }
  });

  return week;
}

type ValidationAthleteInput = Pick<
  AthleteInput,
  | 'daysPerWeek'
  | 'startDate'
  | 'raceDate'
  | 'targetDistance'
  | 'customDistance'
  | 'level'
  | 'imc'
  | 'weight'
  | 'height'
  | 'objective'
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

/** ai-coach.js:2049-2094 */
export function ensureLongRunIsLast(
  week: Week,
  weekNumber: number,
  totalWeeks: number,
  userData: ValidationAthleteInput,
  blueprint: PlanBlueprint,
  report: ValidationReport,
): Week {
  const workouts = week.workouts || [];
  if (!workouts.length) return week;

  const lastIndex = workouts.length - 1;
  const isRaceWeek = weekNumber === totalWeeks;
  const lastWorkout = workouts[lastIndex] as Workout;

  if (isRaceWeek) {
    const distanceKm = getDistanceKm(userData);

    lastWorkout.dayType = 'Longão';
    lastWorkout.title = 'Prova alvo';
    lastWorkout.desc =
      'Prova alvo: iniciar controlado, estabilizar no ritmo planejado e evitar acelerar antes da metade final. Fechar progressivo apenas se estiver confortável.';
    lastWorkout.km = roundKm(distanceKm);
    lastWorkout.pace = blueprint?.paceZones?.racePace || 'Ritmo de prova';

    addValidationIssue(
      report,
      'warning',
      'RACE_WEEK_ENFORCED',
      'Última semana ajustada para terminar com a prova.',
      `weeks[${weekNumber - 1}]`,
      true,
    );
    return week;
  }

  if (lastWorkout.dayType === 'Longão') return week;

  const longRunIndex = workouts.findIndex((workout) => workout.dayType === 'Longão');

  if (longRunIndex >= 0 && longRunIndex !== lastIndex) {
    const tmp = workouts[lastIndex] as Workout;
    workouts[lastIndex] = workouts[longRunIndex] as Workout;
    workouts[longRunIndex] = tmp;

    addValidationIssue(
      report,
      'warning',
      'LONG_RUN_MOVED',
      'Longão movido para o último treino da semana.',
      `weeks[${weekNumber - 1}].workouts`,
      true,
    );
  } else {
    const generated = generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint });
    const generatedLong = generated.workouts[generated.workouts.length - 1];

    lastWorkout.dayType = 'Longão';
    lastWorkout.title = generatedLong?.title || 'Longão progressivo';
    lastWorkout.desc = generatedLong?.desc || 'Longão em ritmo leve a moderado.';
    lastWorkout.pace = generatedLong?.pace || paceForWorkout('Longão', blueprint);
    lastWorkout.km = Math.max(lastWorkout.km, generatedLong?.km || lastWorkout.km);

    addValidationIssue(
      report,
      'warning',
      'LONG_RUN_CREATED',
      'Último treino ajustado como longão.',
      `weeks[${weekNumber - 1}].workouts[${lastIndex}]`,
      true,
    );
  }

  return week;
}

/** ai-coach.js:2096-2170 */
export function enforceWeeklyProgression(
  plan: Plan,
  userData: ValidationAthleteInput,
  blueprint: PlanBlueprint,
  report: ValidationReport,
): Plan {
  const weeks = plan.weeks || [];
  const totalWeeks = weeks.length;
  const taperWeeks = blueprint?.strategy?.taperWeeks || 2;
  const taperStart = Math.max(1, totalWeeks - taperWeeks + 1);
  const distanceKm = getDistanceKm(userData);
  const isUltra = distanceKm > 42.2 || blueprint?.engineCalibration?.raceType === 'ultra';
  const maxGrowth = isUltra ? 1.18 : 1.15;
  const maxPostRecoveryGrowth = isUltra ? 1.12 : 1.1;

  for (let index = 1; index < weeks.length; index++) {
    const currentWeekNumber = index + 1;
    const previous = weeks[index - 1] as Week;
    const current = weeks[index] as Week;
    const previousKm = sumWeekKm(previous);
    const currentKm = sumWeekKm(current);

    if (!previousKm || !currentKm) continue;

    const isTaper = currentWeekNumber >= taperStart;
    const isRecovery = current.off === true;
    const isRaceWeek = currentWeekNumber === totalWeeks;
    const previousWasRecovery = previous.off === true;

    if (!isTaper && !isRecovery && !isRaceWeek) {
      const referenceWeek = previousWasRecovery ? getPreviousNonRecoveryWeek(weeks, index) : previous;
      const referenceKm = sumWeekKm(referenceWeek || previous);
      const allowedGrowth = previousWasRecovery ? maxPostRecoveryGrowth : maxGrowth;

      if (referenceKm && currentKm > Math.round(referenceKm * allowedGrowth)) {
        const targetKm = Math.round(referenceKm * allowedGrowth);
        scaleWeekDistances(current, targetKm, 1);

        addValidationIssue(
          report,
          'warning',
          previousWasRecovery ? 'POST_RECOVERY_VOLUME_CAPPED' : 'WEEKLY_VOLUME_CAPPED',
          `Volume semanal limitado para progressão sustentável (${currentKm}km → ${targetKm}km).`,
          `weeks[${index}]`,
          true,
        );
      }
    }

    if (isRecovery && currentKm >= previousKm) {
      const targetKm = Math.max(3, Math.round(previousKm * (isUltra ? 0.8 : 0.75)));
      scaleWeekDistances(current, targetKm, 1);

      addValidationIssue(
        report,
        'warning',
        'RECOVERY_WEEK_REDUCED',
        `Semana de recuperação reduzida (${currentKm}km → ${targetKm}km).`,
        `weeks[${index}]`,
        true,
      );
    }

    if (isTaper && !isRaceWeek && currentKm > previousKm) {
      const targetKm = Math.max(3, Math.round(previousKm * 0.85));
      scaleWeekDistances(current, targetKm, 1);

      addValidationIssue(
        report,
        'warning',
        'TAPER_WEEK_REDUCED',
        `Semana de polimento ajustada para reduzir carga (${currentKm}km → ${targetKm}km).`,
        `weeks[${index}]`,
        true,
      );
    }
  }

  return plan;
}

/** ai-coach.js:2174-2178 */
export function zoneKeyFromPaceValue(value = ''): string | null {
  const str = String(value || '').toUpperCase();
  const match = str.match(/Z[1-5]/);
  return match ? match[0] : null;
}

/** ai-coach.js:2180-2185 */
export function plannedPaceSecondsForWorkout(workout: Pick<Workout, 'zoneTarget' | 'pace'>, blueprint: PlanBlueprint): number | null {
  const zone = zoneKeyFromPaceValue(workout.zoneTarget || workout.pace || '');
  const zones = blueprint?.paceZones?.trainingZones;
  if (zone && zones) return zoneRepresentativeSeconds(zone, zones);
  return parsePaceToSeconds(workout.pace);
}

/** ai-coach.js:2187-2229 */
export function enforceContextualPaceCoherence(
  plan: Plan,
  userData: ValidationAthleteInput,
  blueprint: PlanBlueprint,
  report: ValidationReport,
): void {
  const ctx = blueprint?.engineCalibration?.goalContext || getGoalContext(userData);
  if (!ctx?.goalPace || ctx.raceType !== 'ultra') return;
  const goalPace = ctx.goalPace;

  (plan.weeks || []).forEach((week, weekIndex) => {
    (week.workouts || []).forEach((workout, workoutIndex) => {
      const planned = plannedPaceSecondsForWorkout(workout, blueprint);
      if (!planned) return;

      const path = `weeks[${weekIndex}].workouts[${workoutIndex}].pace`;
      const dayType = workout.dayType;

      if ((dayType === 'Longão' || dayType === 'Recuperação' || dayType === 'Base') && planned < goalPace) {
        workout.zoneTarget = dayType === 'Longão' ? 'Z2' : 'Z1';
        workout.pace =
          estimatePaceFromPrescription(workout.desc, blueprint.paceZones?.trainingZones ?? null) || workout.zoneTarget;
        addValidationIssue(
          report,
          'warning',
          'CONTEXTUAL_PACE_GUARD',
          'Motor Evo ajustou a prescrição para não deixar treino aeróbico mais rápido que o pace alvo da ultra.',
          path,
          true,
        );
      }

      if (dayType === 'Intervalado' && ctx.qualityFrequency === 'rara e curta') {
        workout.dayType = 'Qualidade';
        workout.title = 'Fartlek técnico leve';
        workout.desc = buildSimpleZonePrescription(buildFartlekBlock(workout.km || 6));
        workout.zoneTarget = 'Z3';
        workout.pace = estimatePaceFromPrescription(workout.desc, blueprint.paceZones?.trainingZones ?? null) || 'Z3';
        addValidationIssue(
          report,
          'warning',
          'ULTRA_INTERVAL_REDUCED',
          'Intervalado agressivo substituído por fartlek técnico leve para respeitar objetivo de ultra.',
          path,
          true,
        );
      }
    });
  });
}

/** ai-coach.js:2232-2234 — nunca chamada no legado (dead code); portada por fidelidade. */
export function workoutSignature(workout: Partial<Workout> = {}): string {
  return `${String(workout.dayType || '').toLowerCase()}|${String(workout.title || '').toLowerCase()}`;
}

/** ai-coach.js:2236-2285 */
export function enforceWorkoutVariety(
  plan: Plan,
  userData: ValidationAthleteInput,
  blueprint: PlanBlueprint,
  report: ValidationReport,
): void {
  const totalWeeks = plan.totalWeeks || (plan.weeks || []).length;
  let changes = 0;

  (plan.weeks || []).forEach((week, weekIndex) => {
    const generatedWeek = generateWorkoutWeek({
      weekNumber: weekIndex + 1,
      totalWeeks,
      userData,
      blueprint,
    });

    const titlesInWeek = new Set<string>();

    (week.workouts || []).forEach((workout, workoutIndex) => {
      const previousWeekWorkout = plan.weeks?.[weekIndex - 1]?.workouts?.[workoutIndex];
      const generated = generatedWeek.workouts?.[workoutIndex];
      const title = String(workout.title || '').trim().toLowerCase();
      const prevTitle = String(previousWeekWorkout?.title || '').trim().toLowerCase();
      const repeatedSameSlot = Boolean(previousWeekWorkout) && Boolean(title) && title === prevTitle;
      const repeatedInsideWeek = Boolean(title) && titlesInWeek.has(title);
      const genericDesc = /rodagem leve com controle|volume em z1\/z2|sem forçar ritmo|corrida leve/i.test(
        workout.desc || '',
      );

      titlesInWeek.add(title);

      if (generated && (repeatedSameSlot || repeatedInsideWeek || genericDesc)) {
        workout.dayType = generated.dayType;
        workout.title = generated.title;
        workout.desc = generated.desc;
        workout.zoneTarget = generated.zoneTarget;
        workout.pace = generated.pace;
        changes += 1;

        addValidationIssue(
          report,
          'warning',
          'WORKOUT_VARIETY_FIXED',
          `Treino ${week.week || `S${weekIndex + 1}`} ajustado para evitar repetição excessiva.`,
          `weeks[${weekIndex}].workouts[${workoutIndex}]`,
          true,
        );
      }
    });
  });

  if (changes > 0) {
    report.summary.varietyFixes = changes;
  }
}

/** ai-coach.js:2602-2770 */
export function validateAndFixPlan(plan: Plan, userData: ValidationAthleteInput): Plan {
  const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
  const daysPerWeek = clamp(Number(userData.daysPerWeek || 3), 2, 6);
  const blueprint = plan.blueprint || buildFallbackBlueprint(userData, 'validation fallback');
  const report = createValidationReport();
  const originalWeeks = Array.isArray(plan.weeks) ? plan.weeks : [];

  if (!Array.isArray(plan.weeks)) {
    addValidationIssue(
      report,
      'warning',
      'WEEKS_ARRAY_CREATED',
      'Array de semanas ausente criado automaticamente.',
      'weeks',
      true,
    );
  }

  const fixedWeeks: Week[] = [];

  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
    const weekIndex = weekNumber - 1;
    const generatedWeek = generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint });
    const sourceWeek = originalWeeks[weekIndex];

    if (!sourceWeek) {
      addValidationIssue(
        report,
        'warning',
        'WEEK_CREATED',
        `Semana S${weekNumber} ausente criada automaticamente.`,
        `weeks[${weekIndex}]`,
        true,
      );
    }

    const fallbackPhase = generatedWeek.phase;
    const cleanWeek: Week = {
      week: `S${weekNumber}`,
      phase: normalizePhaseValue(sourceWeek?.phase, fallbackPhase),
      off: typeof sourceWeek?.off === 'boolean' ? sourceWeek.off : Boolean(generatedWeek.off),
      workouts: [],
    };

    if (!VALID_PHASES.includes(sourceWeek?.phase as Phase)) {
      addValidationIssue(
        report,
        'warning',
        'PHASE_FIXED',
        `Fase da semana S${weekNumber} ajustada para ${cleanWeek.phase}.`,
        `weeks[${weekIndex}].phase`,
        true,
      );
    }

    const sourceWorkouts = Array.isArray(sourceWeek?.workouts) ? (sourceWeek?.workouts as Workout[]) : [];

    if (sourceWorkouts.length !== daysPerWeek) {
      addValidationIssue(
        report,
        'warning',
        'WORKOUT_COUNT_FIXED',
        `Semana S${weekNumber} ajustada para ${daysPerWeek} treinos.`,
        `weeks[${weekIndex}].workouts`,
        true,
      );
    }

    for (let workoutIndex = 0; workoutIndex < daysPerWeek; workoutIndex++) {
      cleanWeek.workouts.push(
        normalizeWorkoutForValidation(
          sourceWorkouts[workoutIndex],
          generatedWeek.workouts[workoutIndex],
          report,
          `weeks[${weekIndex}].workouts[${workoutIndex}]`,
        ),
      );
    }

    alignWorkoutDays(cleanWeek, weekNumber, userData, report);
    ensureLongRunIsLast(cleanWeek, weekNumber, totalWeeks, userData, blueprint, report);

    const weekKm = sumWeekKm(cleanWeek);
    const longRunKm = cleanWeek.workouts[cleanWeek.workouts.length - 1]?.km || 0;
    const longRunShare = weekKm > 0 ? longRunKm / weekKm : 0;
    const distanceKm = getDistanceKm(userData);
    const maxLongRunShare = distanceKm > 42 ? 0.7 : daysPerWeek <= 3 ? 0.55 : 0.5;

    if (weekNumber !== totalWeeks && longRunShare > maxLongRunShare) {
      addValidationIssue(
        report,
        'warning',
        'LONG_RUN_SHARE_HIGH',
        `Longão representa ${Math.round(longRunShare * 100)}% da semana. Verifique coerência da carga.`,
        `weeks[${weekIndex}].workouts[${daysPerWeek - 1}].km`,
        false,
      );
    }

    fixedWeeks.push(cleanWeek);
  }

  plan.weeks = fixedWeeks;
  plan.totalWeeks = totalWeeks;
  plan.daysPerWeek = daysPerWeek;
  plan.raceDistance = plan.raceDistance || getDistanceLabel(userData);
  plan.raceName = plan.raceName || getDistanceLabel(userData);
  plan.raceDate = plan.raceDate || userData.raceDate;
  plan.userData = {
    ...userData,
    imc: calculateIMC(userData) || userData.imc || null,
  };
  plan.blueprint = blueprint;

  enforceWeeklyProgression(plan, plan.userData, blueprint, report);
  enforceContextualPaceCoherence(plan, plan.userData, blueprint, report);
  enforceWorkoutVariety(plan, plan.userData, blueprint, report);

  const weekTotals = plan.weeks.map(sumWeekKm);
  const raceWeekIndex = plan.weeks.findIndex((week) =>
    (week.workouts || []).some((workout) => String(workout.title || '').toLowerCase().includes('prova alvo')),
  );
  const trainingWeekTotals = weekTotals.filter((_, index) => index !== raceWeekIndex);
  const longRunTotals = plan.weeks.map((week) => week.workouts[week.workouts.length - 1]?.km || 0);
  const trainingLongRunTotals = longRunTotals.filter((_, index) => index !== raceWeekIndex);
  const distanceKm = getDistanceKm(plan.userData || userData);

  report.summary.totalKm = weekTotals.reduce((sum, km) => sum + km, 0);
  report.summary.initialWeeklyKm = weekTotals[0] || 0;
  report.summary.peakWeekKm = Math.max(...trainingWeekTotals, 0);
  report.summary.peakWeeklyKm = report.summary.peakWeekKm;
  report.summary.peakTrainingLongRunKm = Math.max(...trainingLongRunTotals, 0);
  report.summary.peakLongRunKm = report.summary.peakTrainingLongRunKm;
  report.summary.biggestTrainingLongRunKm = report.summary.peakTrainingLongRunKm;
  report.summary.biggestLongRunKm = report.summary.peakTrainingLongRunKm;
  report.summary.raceDistanceKm = distanceKm;
  report.summary.raceWeekIncludesGoal = raceWeekIndex >= 0;
  report.summary.recoveryWeeks = plan.weeks.filter((week) => week.off).map((week) => week.week);
  report.summary.taperWeeks = plan.weeks.filter((week) => week.phase === 'Polimento').map((week) => week.week);
  report.summary.raceWeek = plan.weeks[plan.weeks.length - 1]?.week || `S${totalWeeks}`;
  report.summary.totalWeeks = totalWeeks;
  report.summary.daysPerWeek = daysPerWeek;

  report.quality = calculatePlanQualityScore(plan, plan.userData, blueprint, report);
  report.summary.qualityScore = report.quality.overall;
  report.summary.qualityStatus = report.quality.status;

  const refinedRisk = calculatePlanRiskLevel(plan, plan.userData, blueprint, report.quality);
  report.summary.riskLevel = refinedRisk.level;
  report.summary.riskPoints = refinedRisk.points;
  report.summary.riskReasons = refinedRisk.reasons;

  blueprint.profile = blueprint.profile || ({} as PlanBlueprint['profile']);
  blueprint.athleteAnalysis = blueprint.athleteAnalysis || ({} as PlanBlueprint['athleteAnalysis']);
  blueprint.profile.riskLevel = refinedRisk.level;
  blueprint.athleteAnalysis.riskLevel = refinedRisk.level;
  blueprint.athleteAnalysis.riskReasons = refinedRisk.reasons;
  plan.blueprint = blueprint;

  const qualityWarningThreshold = report.quality.details?.isUltra ? 5.8 : 6.5;
  if (report.quality.overall < qualityWarningThreshold) {
    addValidationIssue(
      report,
      'warning',
      'QUALITY_SCORE_LOW',
      `Pontuação técnica ${report.quality.overall}/10. ${report.quality.adoptionAdvice}`,
      'validation.quality',
      false,
    );
  }

  report.status = report.status === 'error' ? 'error' : report.summary.totalWarnings > 0 ? 'warning' : 'ok';

  plan.validation = report;

  if (report.status === 'error') {
    throw new Error('O plano gerado não passou na validação técnica.');
  }

  return plan;
}
