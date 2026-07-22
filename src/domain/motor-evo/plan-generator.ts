import { clamp } from './utils/math';
import { calculateWeeks, getStartDayOfWeek } from './dates';
import { getDistanceKm, getDistanceLabel, getGoalContext, type GoalContext } from './objective';
import { calculateIMC } from './profile';
import { calculateWeekTargets, getTrainingDays, allocateWorkoutDistances, type WeekTargetsBlueprint } from './weekly-targets';
import { getWorkoutTemplate } from './workout-library';
import {
  paceForWorkout,
  buildProfessionalWorkoutDescription,
  estimatePaceFromPrescription,
} from './workout-prescription';
import type { AthleteInput, Week } from './types';
import type { PlanBlueprint } from './blueprint';
import type { ValidationReport } from './validation';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — geração de semana(s) e montagem do plano
 * (pré-validação). `validateAndFixPlan` (validation.ts) não é importado aqui de
 * propósito: para não criar um ciclo de import em runtime, quem compõe
 * `assemblePlan` + `validateAndFixPlan` é a fachada `index.ts`.
 * Mapeamento: docs/legacy-audit.md §13.5/§13.7
 * (`generateWorkoutWeek` → plan-generator.ts; `generatePlan` → plan-generator.ts + index.ts).
 */

/** Forma completa do plano (docs/legacy-audit.md §3.2), acumulada por generatePlan → validateAndFixPlan. */
export interface Plan {
  planName: string;
  totalWeeks: number;
  raceName: string;
  raceDistance: string;
  raceDate: string;
  daysPerWeek: number;
  weeks: Week[];
  blueprint: PlanBlueprint;
  motorEvoContext: GoalContext;
  generatedAt: string;
  userData: AthleteInput & { imc: number | null };
  /** Só existe depois de `validateAndFixPlan` (validation.ts) rodar. */
  validation?: ValidationReport;
}

type GenerateWorkoutWeekInput = {
  weekNumber: number;
  totalWeeks: number;
  userData: Pick<AthleteInput, 'targetDistance' | 'customDistance' | 'daysPerWeek' | 'startDate'>;
  blueprint: PlanBlueprint;
};

/** ai-coach.js:1854-1901 */
export function generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint }: GenerateWorkoutWeekInput): Week {
  const distanceKm = getDistanceKm(userData);
  const daysPerWeek = clamp(Number(userData.daysPerWeek || 3), 2, 6);
  const startDOW = getStartDayOfWeek(userData);
  const isFirstWeek = weekNumber === 1;
  const isRaceWeek = weekNumber === totalWeeks;
  const targets = calculateWeekTargets(
    weekNumber,
    totalWeeks,
    { ...blueprint, userData } as unknown as WeekTargetsBlueprint,
    distanceKm,
  );
  const dayNames = getTrainingDays(daysPerWeek, startDOW, isFirstWeek);
  const distances = allocateWorkoutDistances(daysPerWeek, targets.weeklyKm, targets.longRunKm, isRaceWeek, distanceKm);

  const workouts = dayNames.map((dayOfWeek, index) => {
    const isLastWorkout = index === dayNames.length - 1;
    const template = getWorkoutTemplate(
      targets.phase,
      index,
      daysPerWeek,
      targets.off,
      isRaceWeek,
      isLastWorkout,
      blueprint,
      weekNumber,
      totalWeeks,
    );
    const zoneTarget =
      isRaceWeek && isLastWorkout ? blueprint.paceZones?.racePace || 'Z3' : paceForWorkout(template.dayType, blueprint);

    const km = distances[index] || 0;
    const desc = buildProfessionalWorkoutDescription({
      template,
      km,
      pace: zoneTarget,
      phase: targets.phase,
      blueprint,
      isRaceWeek,
      distanceKm,
    });

    const estimatedPace = estimatePaceFromPrescription(desc, blueprint.paceZones?.trainingZones ?? null) || zoneTarget;

    return {
      dayOfWeek,
      dayType: template.dayType,
      title: template.title,
      desc,
      km,
      pace: estimatedPace,
      zoneTarget,
    };
  });

  return {
    week: `S${weekNumber}`,
    phase: targets.phase,
    off: targets.off,
    workouts,
  };
}

type AssemblePlanInput = Pick<
  AthleteInput,
  | 'level'
  | 'daysPerWeek'
  | 'startDate'
  | 'raceDate'
  | 'targetDistance'
  | 'customDistance'
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

/**
 * ai-coach.js:2772-2800 (`generatePlan`) — só a parte de montagem (blueprint →
 * loop de semanas → objeto do plano). NÃO chama `validateAndFixPlan`: quem
 * compõe as duas etapas é a fachada `index.ts`, para evitar ciclo de import
 * entre plan-generator.ts e validation.ts (ver comentário no topo do arquivo).
 * A IA nunca decide a planilha final (docs/motor-evo-specification.md §1); aqui
 * o `blueprint` é sempre resolvido antes de chamar esta função (`buildFallbackBlueprint`
 * no caminho local, único testado nesta fase — ver blueprint.ts).
 */
export function assemblePlan(userData: AssemblePlanInput, blueprint: PlanBlueprint): Plan {
  const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
  const distLabel = getDistanceLabel(userData);

  const weeks: Week[] = [];
  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
    weeks.push(generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint }));
  }

  return {
    planName: `Plano ${distLabel} - ${userData.level || 'Personalizado'}`,
    totalWeeks,
    raceName: distLabel,
    raceDistance: distLabel,
    raceDate: userData.raceDate,
    daysPerWeek: Number(userData.daysPerWeek || 3),
    weeks,
    blueprint,
    motorEvoContext: blueprint.engineCalibration?.goalContext || blueprint.paceZones?.goalContext || getGoalContext(userData),
    generatedAt: new Date().toISOString(),
    userData: {
      ...userData,
      imc: calculateIMC(userData) || userData.imc || null,
    } as Plan['userData'],
  };
}
