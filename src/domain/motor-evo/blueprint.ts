import { clamp } from './utils/math';
import { calculateWeeks } from './dates';
import { calculateIMC } from './profile';
import { getDistanceKm, getGoalContext } from './objective';
import { buildLocalPaceZones, type LocalPaceZones } from './zones';
import { buildPhaseDistribution, type PhaseRange } from './phases';
import { getPeakTrainingLongRunLimit, getPeakWeeklyKmLimit } from './weekly-targets';
import type { AthleteInput } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — blueprint (só o caminho local/determinístico).
 * Mapeamento: docs/legacy-audit.md §13.4 (`buildFallbackBlueprint` → blueprint.ts).
 *
 * ESCOPO: só `buildFallbackBlueprint` (o caminho que os golden da Fase 2 exercitam —
 * harness rejeita `fetch` de propósito). `normalizeBlueprint` (reconciliação da
 * resposta de IA) e o `PlanBlueprintProvider` (`services/ai/*`) não são portados
 * aqui: dependem de um provider assíncrono/impuro (fora do domínio puro) e do
 * fluxo `parsePlanResponse`/colar blueprint manual, que não faz parte do caminho
 * testado nesta fase. Ficam como débito explícito para quando o serviço de IA
 * for implementado (fora da Fase 2).
 */

export interface BlueprintProfile {
  riskLevel: string;
  fitnessLevel: string;
  mainLimitation: string;
}

export interface AthleteAnalysis {
  detectedLevel: string;
  riskLevel: string;
  riskReasons?: string[];
  goalFeasibility: string;
  mainStrength: string;
  mainWeakness: string;
  focus: string;
  coachSummary: string;
}

export interface BlueprintStrategy {
  initialWeeklyKm: number;
  peakWeeklyKm: number;
  initialLongRunKm: number;
  peakLongRunKm: number;
  recoveryEveryWeeks: number;
  taperWeeks: number;
}

export interface EngineCalibration {
  source: string;
  version: string;
  goalContext: ReturnType<typeof getGoalContext>;
  raceType: string;
  zoneStrategy: string;
  speedReserve: string;
  terrain: string;
  progressionStyle: string;
  recoveryPriority: string;
  intensityBias: string;
  qualityFrequency: string;
}

export interface PlanBlueprint {
  profile: BlueprintProfile;
  athleteAnalysis: AthleteAnalysis;
  strategy: BlueprintStrategy;
  paceZones: LocalPaceZones;
  phaseDistribution: PhaseRange[];
  warnings: string[];
  engineCalibration: EngineCalibration;
  source: string;
}

type BlueprintAthleteInput = Pick<
  AthleteInput,
  | 'startDate'
  | 'raceDate'
  | 'targetDistance'
  | 'customDistance'
  | 'daysPerWeek'
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

/** ai-coach.js:949-1049 */
export function buildFallbackBlueprint(userData: BlueprintAthleteInput, reason = ''): PlanBlueprint {
  const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
  const distanceKm = getDistanceKm(userData);
  const days = clamp(Number(userData.daysPerWeek || 3), 2, 6);
  const level = String(userData.level || 'iniciante').toLowerCase();
  const imc = calculateIMC(userData);

  const isBeginner = level.includes('inic') || level.includes('begin');
  const isAdvanced = level.includes('av') || level.includes('avan');
  const isUltra = distanceKm > 42;
  const imcRisk = imc && imc >= 30 ? 0.85 : imc && imc >= 27 ? 0.93 : 1;
  const goalContext = getGoalContext(userData);

  let initialLongRunKm: number;
  let peakLongRunKm: number;

  if (distanceKm <= 5) {
    initialLongRunKm = isBeginner ? 3 : 5;
    peakLongRunKm = isAdvanced ? 9 : 7;
  } else if (distanceKm <= 10) {
    initialLongRunKm = isBeginner ? 5 : 7;
    peakLongRunKm = isAdvanced ? 16 : 13;
  } else if (distanceKm <= 21.1) {
    initialLongRunKm = isBeginner ? 7 : 10;
    peakLongRunKm = isAdvanced ? 24 : 20;
  } else if (distanceKm <= 42.2) {
    initialLongRunKm = isBeginner ? 10 : 14;
    peakLongRunKm = getPeakTrainingLongRunLimit(distanceKm, level, days, totalWeeks, imc);
  } else {
    initialLongRunKm = isBeginner ? 10 : isAdvanced ? 18 : 14;
    peakLongRunKm = getPeakTrainingLongRunLimit(distanceKm, level, days, totalWeeks, imc);
  }

  initialLongRunKm = Math.max(3, Math.round(initialLongRunKm * imcRisk));
  peakLongRunKm = Math.max(
    initialLongRunKm + 4,
    Math.round(Math.min(peakLongRunKm, peakLongRunKm * goalContext.longRunFactor)),
  );

  const longShareInitial = days <= 3 ? 0.42 : days === 4 ? 0.36 : 0.32;
  const longSharePeak = days <= 3 ? 0.45 : days === 4 ? 0.38 : 0.34;

  const initialWeeklyKm = Math.max(
    days * 3,
    Math.round((initialLongRunKm / longShareInitial) * goalContext.volumeFactor),
  );
  const peakWeeklyRaw = Math.max(
    initialWeeklyKm + 8,
    Math.round((peakLongRunKm / longSharePeak) * goalContext.volumeFactor),
  );
  const peakWeeklyKm = Math.min(peakWeeklyRaw, getPeakWeeklyKmLimit(distanceKm, level, days, totalWeeks, imc));
  const taperWeeks = totalWeeks >= 18 ? 3 : 2;

  const riskLevel = imc && imc >= 30 ? 'alto' : imc && imc >= 27 ? 'moderado' : 'baixo';
  const fitnessLevel = isAdvanced ? 'avançado' : isBeginner ? 'iniciante' : 'intermediário';
  const goalFeasibility =
    riskLevel === 'alto' ? 'viável com progressão conservadora' : isUltra && totalWeeks < 20 ? 'agressivo' : 'viável';

  return {
    profile: {
      riskLevel,
      fitnessLevel,
      mainLimitation: isUltra ? 'Resistência muscular e tolerância a volume' : 'Progressão gradual de volume',
    },
    athleteAnalysis: {
      detectedLevel: fitnessLevel,
      riskLevel,
      goalFeasibility,
      mainStrength:
        goalContext.speedReserve === 'alta' || goalContext.speedReserve === 'muito alta'
          ? 'Boa reserva de velocidade; o foco será transformar isso em resistência sustentável.'
          : isAdvanced
            ? 'Boa base de ritmo para suportar treinos de qualidade.'
            : 'Boa janela para evolução gradual.',
      mainWeakness: isUltra
        ? 'Resistência específica, tolerância muscular e recuperação serão os limitadores principais.'
        : 'Construção segura de volume semanal.',
      focus:
        goalContext.type === 'endurance_goal'
          ? 'Resistência aeróbica, longões, consistência e execução no ritmo alvo'
          : isUltra
            ? 'Resistência aeróbica, longões progressivos e consistência'
            : 'Base aeróbica, técnica e progressão controlada',
      coachSummary:
        goalContext.type === 'endurance_goal'
          ? `O teste de 3km mostra velocidade, mas o objetivo pede resistência. ${goalContext.targetSummary ? `Alvo detectado: ${goalContext.targetSummary}. ` : ''}O plano usa zonas ancoradas no objetivo.`
          : isUltra
            ? 'O plano prioriza consistência e adaptação muscular antes do pico, evitando saltos bruscos de carga.'
            : 'O plano usa progressão gradual, semanas de recuperação e paces coerentes com o nível informado.',
    },
    strategy: {
      initialWeeklyKm,
      peakWeeklyKm,
      initialLongRunKm,
      peakLongRunKm,
      recoveryEveryWeeks: isBeginner || (imc && imc >= 27) ? 3 : 4,
      taperWeeks,
    },
    paceZones: buildLocalPaceZones(userData),
    phaseDistribution: buildPhaseDistribution(totalWeeks, taperWeeks),
    warnings: [
      'Respeite sinais de dor e reduza carga se houver desconforto persistente.',
      'Evite compensar treinos perdidos acumulando volume em poucos dias.',
    ],
    engineCalibration: {
      source: 'Motor Evo Contextual',
      version: 'v107',
      goalContext,
      raceType: goalContext.raceType,
      zoneStrategy: goalContext.zoneStrategy,
      speedReserve: goalContext.speedReserve,
      terrain: goalContext.terrain?.label || 'terreno plano',
      progressionStyle: riskLevel === 'alto' ? 'conservadora' : goalContext.progressionStyle,
      recoveryPriority: riskLevel === 'alto' ? 'alta' : goalContext.recoveryPriority,
      intensityBias: goalContext.intensityBias,
      qualityFrequency: goalContext.qualityFrequency,
    },
    source: reason ? `fallback: ${reason}` : 'fallback local',
  };
}
