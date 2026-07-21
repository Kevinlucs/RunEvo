import { clamp } from './utils/math';
import { getDistanceKm } from './objective';
import { sumWeekKm, getPreviousNonRecoveryWeek } from './plan-metrics';
import type { Week } from './types';
import type { Plan } from './plan-generator';
import type { PlanBlueprint } from './blueprint';
import type { ValidationReport } from './validation';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — quality score (0 a 10).
 * Mapeamento: docs/legacy-audit.md §13.6 (`clampScore, phaseIdentityScore, calculatePlanQualityScore` → quality-score.ts).
 */

export interface QualityMetrics {
  variety: number;
  progression: number;
  longRunBalance: number;
  intensityDistribution: number;
  recovery: number;
  phaseIdentity: number;
}

export interface QualityDetails {
  raceType: string;
  isUltra: boolean;
  uniqueTitles: number;
  totalWorkouts: number;
  maxSameTitle: number;
  intenseRate: number;
  recoveryWeeks: number;
  validationPenalty: number;
  raceWeekIgnored: boolean;
  biggestTrainingLongRun: number;
  progressionFindings: string[];
  longRunFindings: string[];
}

export interface QualityScore {
  version: string;
  overall: number;
  status: 'excelente' | 'boa' | 'atenção' | 'revisar';
  adoptionAdvice: string;
  metrics: QualityMetrics;
  details: QualityDetails;
  insights: string[];
}

type QualityAthleteInput = { daysPerWeek?: number } & Parameters<typeof getDistanceKm>[0];

/** ai-coach.js:2288-2290 */
export function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(Number(value || 0) * 10) / 10));
}

/** ai-coach.js:2292-2305 */
export function phaseIdentityScore(weeks: Week[] = []): number {
  const phases: Record<string, Set<string>> = {};
  weeks.forEach((week) => {
    const phase = week.phase || 'Base';
    phases[phase] = phases[phase] || new Set();
    (week.workouts || []).forEach((workout) => {
      (phases[phase] as Set<string>).add(String(workout.dayType || workout.title || '').toLowerCase());
    });
  });

  const phaseScores = Object.values(phases).map((set) => Math.min(10, set.size * 2.5));
  if (!phaseScores.length) return 0;
  return clampScore(phaseScores.reduce((s, v) => s + v, 0) / phaseScores.length);
}

/** ai-coach.js:2307-2519 */
// eslint-disable-next-line complexity -- porte 1:1 do legado; não simplificar.
export function calculatePlanQualityScore(
  plan: Pick<Plan, 'weeks' | 'daysPerWeek'>,
  userData: QualityAthleteInput,
  blueprint: PlanBlueprint,
  validationReport: ValidationReport,
): QualityScore {
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const ctx = blueprint?.engineCalibration?.goalContext;
  const distanceKm = getDistanceKm(userData);
  const raceType =
    ctx?.raceType || (distanceKm > 42.2 ? 'ultra' : distanceKm >= 42 ? 'maratona' : distanceKm >= 21 ? 'meia' : '10k');
  const isUltra = raceType === 'ultra' || distanceKm > 42.2;
  const daysPerWeek = clamp(Number(userData?.daysPerWeek || plan?.daysPerWeek || 3), 2, 6);

  const raceWeekIndex = weeks.findIndex((week) =>
    (week.workouts || []).some((workout) => String(workout.title || '').toLowerCase().includes('prova alvo')),
  );
  const trainingWeeks = weeks.filter((_, index) => index !== raceWeekIndex);
  const weekTotals = weeks.map(sumWeekKm).map((v) => (Number.isFinite(v) ? v : 0));
  const longRuns = weeks.map((week) => Number(week.workouts?.[week.workouts.length - 1]?.km || 0));
  const trainingLongRuns = weeks
    .map((week, index) => (index === raceWeekIndex ? null : Number(week.workouts?.[week.workouts.length - 1]?.km || 0)))
    .filter((v): v is number => Number.isFinite(v));

  const workouts = weeks.flatMap((week) =>
    (week.workouts || []).map((workout) => ({ ...workout, phase: week.phase, week: week.week, off: week.off })),
  );
  const trainingWorkouts = workouts.filter((workout) => String(workout.title || '').toLowerCase() !== 'prova alvo');

  const titleCounts = trainingWorkouts.reduce<Record<string, number>>((acc, workout) => {
    const key = String(workout.title || '').trim().toLowerCase();
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const typeCounts = trainingWorkouts.reduce<Record<string, number>>((acc, workout) => {
    const key = String(workout.dayType || '').trim().toLowerCase();
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const uniqueTitles = Object.keys(titleCounts).length;
  const uniqueTypes = Object.keys(typeCounts).length;
  const totalWorkouts = trainingWorkouts.length || 1;
  const titleDensity = uniqueTitles / Math.min(totalWorkouts, isUltra ? 12 : 16);
  const typeDensity = uniqueTypes / 4;
  const maxSameTitle = Math.max(0, ...Object.values(titleCounts));
  const allowedRepeat = isUltra ? Math.ceil(trainingWeeks.length / 3) : Math.ceil(trainingWeeks.length / 4);
  const repeatPenalty = Math.max(0, maxSameTitle - allowedRepeat) * (isUltra ? 0.25 : 0.42);
  const varietyFloor = isUltra ? 5.8 : distanceKm >= 21 ? 5.8 : 4.8;
  const varietyRaw = Math.min(1, titleDensity) * 7.2 + Math.min(1, typeDensity) * 2.8 - repeatPenalty;
  const varietyScore = clampScore(Math.max(varietyFloor, varietyRaw));

  let progressionPenalty = 0;
  const progressionFindings: string[] = [];

  for (let i = 1; i < weekTotals.length; i++) {
    if (i === raceWeekIndex) continue;

    const prevWeek = weeks[i - 1];
    const currentWeek = weeks[i] as Week;
    const prev = weekTotals[i - 1] || 1;
    const current = weekTotals[i] || 0;

    if (currentWeek?.off || currentWeek?.phase === 'Polimento') continue;

    const previousWasRecovery = prevWeek?.off === true;
    const referenceWeek = previousWasRecovery ? getPreviousNonRecoveryWeek(weeks, i) : prevWeek;
    const referenceKm = sumWeekKm(referenceWeek || (prevWeek as Week)) || prev;
    if (previousWasRecovery && current <= referenceKm * (isUltra ? 1.12 : 1.1)) continue;

    const jump = (current - referenceKm) / referenceKm;
    const severeJump = isUltra ? 0.26 : 0.24;
    const moderateJump = isUltra ? 0.18 : 0.16;

    if (jump > moderateJump) {
      progressionPenalty += isUltra ? 0.65 : 1.2;
      progressionFindings.push(`${currentWeek.week || `S${i + 1}`}: salto de volume de ${Math.round(jump * 100)}%`);
    }

    if (jump > severeJump) {
      progressionPenalty += isUltra ? 0.85 : 1.5;
    }

    // (currentWeek.phase as string): o `continue` acima já filtrou 'Polimento' — TS
    // provaria a checagem sempre-verdadeira, mas o legado a repete defensivamente
    // (ai-coach.js:2382) e o porte preserva a mesma checagem redundante.
    if (current < prev * 0.55 && !currentWeek?.off && (currentWeek?.phase as string) !== 'Polimento') {
      progressionPenalty += isUltra ? 0.35 : 0.8;
    }
  }

  const progressionScore = clampScore(10 - progressionPenalty);

  let longRunPenalty = 0;
  const longRunFindings: string[] = [];

  weeks.forEach((week, index) => {
    if (index === raceWeekIndex) return;

    const total = weekTotals[index] || 0;
    const long = longRuns[index] || 0;
    const share = total ? long / total : 0;

    const maxShare = isUltra
      ? daysPerWeek <= 3
        ? 0.82
        : 0.74
      : distanceKm >= 42
        ? 0.64
        : daysPerWeek <= 3
          ? 0.56
          : 0.5;

    if (share > maxShare) {
      longRunPenalty += (share - maxShare) * (isUltra ? 5 : 12);
      longRunFindings.push(`${week.week || `S${index + 1}`}: longão concentra ${Math.round(share * 100)}% do volume`);
    }

    const prevLong = longRuns[index - 1] || 0;
    if (index > 0 && index - 1 !== raceWeekIndex && long > prevLong * (isUltra ? 1.5 : 1.35) && week.phase !== 'Polimento') {
      longRunPenalty += isUltra ? 0.35 : 0.8;
    }
  });

  const biggestTrainingLongRun = Math.max(0, ...trainingLongRuns);
  const expectedBigLongRun = isUltra ? Math.max(28, Math.min(distanceKm * 0.72, distanceKm - 8)) : Math.min(distanceKm * 0.95, 36);
  if (isUltra && biggestTrainingLongRun < expectedBigLongRun * 0.62 && trainingWeeks.length >= 12) {
    longRunPenalty += 0.8;
    longRunFindings.push(`maior longão de treino parece baixo para ultra (${Math.round(biggestTrainingLongRun)} km)`);
  }

  const longRunScore = clampScore(10 - longRunPenalty);

  const intenseTypes = new Set(['Qualidade', 'Intervalado']);
  const intenseCount = trainingWorkouts.filter((w) => intenseTypes.has(w.dayType)).length;
  const intenseRate = intenseCount / totalWorkouts;
  const desiredMax = isUltra ? 0.24 : distanceKm >= 21 ? 0.3 : 0.38;
  const desiredMin = isUltra ? 0.06 : distanceKm <= 10 ? 0.18 : 0.1;
  let intensityPenalty = 0;
  if (intenseRate > desiredMax) intensityPenalty += (intenseRate - desiredMax) * (isUltra ? 14 : 18);
  if (intenseRate < desiredMin && totalWorkouts >= 8) intensityPenalty += (desiredMin - intenseRate) * (isUltra ? 6 : 10);
  const intensityScore = clampScore(10 - intensityPenalty);

  const recoveryWeeks = weeks.filter((week) => week.off).length;
  const expectedRecovery = Math.max(1, Math.floor(weeks.length / (isUltra ? 5 : 5)));
  const hasTaper = weeks.slice(-Math.min(3, weeks.length)).some((week) => week.phase === 'Polimento');
  let recoveryPenalty = 0;
  if (weeks.length >= 8 && recoveryWeeks < expectedRecovery - 1) recoveryPenalty += isUltra ? 1.1 : 1.5;
  if (weeks.length >= 6 && !hasTaper) recoveryPenalty += 1.2;
  const recoveryScore = clampScore(10 - recoveryPenalty);

  const phaseScore = phaseIdentityScore(weeks);
  const validationPenalty = Math.min(
    isUltra ? 1.4 : 2.5,
    (validationReport?.warnings || []).filter((i) => !i.fixed).length * (isUltra ? 0.18 : 0.35),
  );

  const weights = isUltra
    ? { variety: 0.14, progression: 0.25, longRun: 0.24, intensity: 0.12, recovery: 0.15, phase: 0.1 }
    : { variety: 0.22, progression: 0.22, longRun: 0.18, intensity: 0.16, recovery: 0.12, phase: 0.1 };

  const overall = clampScore(
    varietyScore * weights.variety +
      progressionScore * weights.progression +
      longRunScore * weights.longRun +
      intensityScore * weights.intensity +
      recoveryScore * weights.recovery +
      phaseScore * weights.phase -
      validationPenalty,
  );

  const status = overall >= 8.2 ? 'excelente' : overall >= 7 ? 'boa' : overall >= 5.8 ? 'atenção' : 'revisar';

  const insights: string[] = [];
  if (isUltra) {
    insights.push('Auditoria calibrada para ultramaratona: longões e volume são avaliados com tolerância específica.');
  }

  if (varietyScore < 7) {
    insights.push(
      isUltra
        ? 'Variedade moderada: em ultra isso é aceitável, mas ainda deve alternar base, longão, ritmo alvo e técnica.'
        : 'A variedade de estímulos ficou limitada; revise repetição de títulos e descrições.',
    );
  } else insights.push('Boa alternância entre estímulos, evitando planilha repetitiva.');

  if (progressionScore < 7) {
    insights.push(
      `Progressão exige atenção${progressionFindings.length ? `: ${progressionFindings.slice(0, 2).join('; ')}` : ' por possíveis saltos de volume'}.`,
    );
  } else insights.push('Progressão de volume dentro de faixa segura.');

  if (intensityScore < 7) insights.push('Distribuição de intensidade precisa de cautela para não ficar leve ou forte demais.');
  else insights.push('Intensidade compatível com objetivo e perfil informado.');

  if (longRunScore < 7) {
    insights.push(
      `Longões merecem revisão${longRunFindings.length ? `: ${longRunFindings.slice(0, 2).join('; ')}` : ' para não concentrar carga demais na semana'}.`,
    );
  } else insights.push('Longões proporcionais ao volume semanal e ao tipo de prova.');

  if (recoveryScore < 7) insights.push('Recuperação/polimento podem ser reforçados.');
  else insights.push('Recuperação e polimento presentes na estrutura.');

  const adoptionAdvice =
    overall >= 8
      ? 'Planilha tecnicamente forte para adoção.'
      : overall >= 7
        ? 'Planilha adotável com atenção aos alertas.'
        : overall >= 5.8
          ? 'Planilha pode ser adotada apenas com revisão dos pontos destacados.'
          : 'Não recomendado adotar antes de revisar progressão, longões ou variedade.';

  return {
    version: 'v120',
    overall,
    status,
    adoptionAdvice,
    metrics: {
      variety: varietyScore,
      progression: progressionScore,
      longRunBalance: longRunScore,
      intensityDistribution: intensityScore,
      recovery: recoveryScore,
      phaseIdentity: phaseScore,
    },
    details: {
      raceType,
      isUltra,
      uniqueTitles,
      totalWorkouts,
      maxSameTitle,
      intenseRate: Math.round(intenseRate * 100),
      recoveryWeeks,
      validationPenalty: Math.round(validationPenalty * 10) / 10,
      raceWeekIgnored: raceWeekIndex >= 0,
      biggestTrainingLongRun: Math.round(biggestTrainingLongRun),
      progressionFindings: progressionFindings.slice(0, 5),
      longRunFindings: longRunFindings.slice(0, 5),
    },
    insights,
  };
}
