import { parseNumber } from './utils/math';
import { secondsToDuration, secondsToPace, timeToSeconds, paceToSeconds } from './pace';
import { getTerrainGuidance, type TerrainGuidance } from './terrain';
import type { AthleteInput, RaceType, ZoneStrategy } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — objetivo, distância e tipo de prova.
 * Mapeamento: docs/legacy-audit.md §13.1/§13.2
 * (`getDistanceKm, getDistanceLabel, raceDistanceKey, getRaceType` → distância/tipo;
 * `normalizeObjectiveText, parseTimeGoalFromObjective, getGoalTargetInfo,
 * inferGoalPaceSeconds, getPreviousRaceTimeSeconds, getPreviousTimesText,
 * inferBasePaceSeconds, getGoalContext` → objetivo).
 */

/** ai-coach.js:131-137 — string numérica crua, não a distância métrica real (ver types.ts). */
export function getDistanceKm(userData: Pick<AthleteInput, 'targetDistance' | 'customDistance'>): number {
  if (userData.targetDistance === 'ultra' || userData.targetDistance === 'custom') {
    return parseNumber(userData.customDistance, 0) || 50;
  }

  return parseNumber(userData.targetDistance, 42) || 42;
}

/** ai-coach.js:139-154 */
export function getDistanceLabel(userData: Pick<AthleteInput, 'targetDistance' | 'customDistance'>): string {
  const distLabels: Record<string, string> = {
    '5': '5 km',
    '10': '10 km',
    '21': 'Meia Maratona (21.1 km)',
    '42': 'Maratona (42.2 km)',
    ultra: 'Ultramaratona',
    custom: `${userData.customDistance || ''} km`.trim(),
  };

  if (userData.targetDistance === 'ultra' && userData.customDistance) {
    return `Ultramaratona (${userData.customDistance} km)`;
  }

  return distLabels[userData.targetDistance] || `${getDistanceKm(userData)} km`;
}

/** ai-coach.js:160-167 */
export function getPreviousTimesText(
  userData: Pick<AthleteInput, 'time5k' | 'time10k' | 'time21k' | 'time42k'>,
): string {
  let text = '';
  if (userData.time5k) text += `- Melhor tempo 5K: ${userData.time5k}\n`;
  if (userData.time10k) text += `- Melhor tempo 10K: ${userData.time10k}\n`;
  if (userData.time21k) text += `- Melhor tempo 21K: ${userData.time21k}\n`;
  if (userData.time42k) text += `- Melhor tempo 42K: ${userData.time42k}\n`;
  return text || '- Nenhum tempo anterior informado\n';
}

/** ai-coach.js:197-204 */
export function normalizeObjectiveText(value = ''): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ai-coach.js:206-212 */
export function raceDistanceKey(distanceKm: number): '5k' | '10k' | '21k' | '42k' | 'ultra' {
  if (distanceKm > 42.2) return 'ultra';
  if (distanceKm >= 42) return '42k';
  if (distanceKm >= 21) return '21k';
  if (distanceKm >= 10) return '10k';
  return '5k';
}

/** ai-coach.js:214-224 */
export function getPreviousRaceTimeSeconds(
  userData: Pick<AthleteInput, 'no5k' | 'time5k' | 'no10k' | 'time10k' | 'no21k' | 'time21k' | 'no42k' | 'time42k'>,
  distanceKm: number,
): number | null {
  const key = raceDistanceKey(distanceKm);
  const map: Record<string, string | undefined | null> = {
    '5k': userData?.no5k ? null : userData?.time5k,
    '10k': userData?.no10k ? null : userData?.time10k,
    '21k': userData?.no21k ? null : userData?.time21k,
    '42k': userData?.no42k ? null : userData?.time42k,
  };

  return timeToSeconds(map[key]);
}

export interface GoalTarget {
  source: 'objective_time' | 'previous_pr';
  totalSeconds: number;
  label: string;
  paceSeconds: number;
  distanceKm: number;
  previousSeconds?: number;
}

/** ai-coach.js:226-300 */
export function parseTimeGoalFromObjective(
  userData: Pick<AthleteInput, 'objective' | 'targetDistance' | 'customDistance' | 'no5k' | 'time5k' | 'no10k' | 'time10k' | 'no21k' | 'time21k' | 'no42k' | 'time42k'>,
): GoalTarget | null {
  const distanceKm = getDistanceKm(userData);
  const objective = normalizeObjectiveText(userData?.objective || '');
  if (!objective || !distanceKm) return null;

  const explicitRaceTimePatterns = [
    /(?:em|para|pra|por volta de|abaixo de|menos de|sub)\s*(\d{1,2})\s*h\s*(?:e\s*)?(\d{1,2})?\s*(?:min|mins|minutos)?/,
    /(?:em|para|pra|abaixo de|menos de|sub)\s*(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?/,
    /(?:fechar|terminar|completar|finalizar|fazer|bater|buscar).*?(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?/,
    /(?:sub|abaixo de|menos de)\s*(\d{2,3})(?:\s*(?:min|minutos))?/,
  ];

  for (const pattern of explicitRaceTimePatterns) {
    const match = objective.match(pattern);
    if (!match) continue;

    let totalSeconds: number | null = null;
    let label = '';

    if (pattern.source.includes('h')) {
      const hours = Number(match[1] || 0);
      const minutes = Number(match[2] || 0);
      totalSeconds = hours * 3600 + minutes * 60;
      label = `${hours}h${minutes ? String(minutes).padStart(2, '0') : ''}`;
    } else if (match[3] !== undefined) {
      const a = Number(match[1]);
      const b = Number(match[2]);
      const c = Number(match[3] || 0);

      // Para distâncias longas, 6:30 geralmente significa 6h30. Para 5/10K, 48:35 significa mm:ss.
      if (distanceKm >= 21 && c === 0 && a <= 12) {
        totalSeconds = a * 3600 + b * 60;
      } else if (c > 0) {
        totalSeconds = a * 3600 + b * 60 + c;
      } else {
        totalSeconds = a * 60 + b;
      }

      label = secondsToDuration(totalSeconds);
    } else {
      const minutes = Number(match[1]);
      totalSeconds = minutes * 60;
      label = `sub ${minutes}min`;
    }

    if (!totalSeconds || totalSeconds < 4 * 60) continue;

    return {
      source: 'objective_time',
      totalSeconds,
      label,
      paceSeconds: Math.round(totalSeconds / distanceKm),
      distanceKm,
    };
  }

  const wantsPR =
    /\b(pr|rp|recorde|record|melhor marca|melhor tempo|baixar tempo|bater meu tempo|bater meu recorde)\b/.test(
      objective,
    );
  if (wantsPR) {
    const previous = getPreviousRaceTimeSeconds(userData, distanceKm);
    if (previous) {
      const improvementFactor = distanceKm >= 42 ? 0.985 : distanceKm >= 21 ? 0.98 : 0.975;
      const target = Math.round(previous * improvementFactor);
      return {
        source: 'previous_pr',
        totalSeconds: target,
        previousSeconds: previous,
        label: `${secondsToDuration(target)} estimado para buscar RP`,
        paceSeconds: Math.round(target / distanceKm),
        distanceKm,
      };
    }
  }

  return null;
}

export interface GoalTargetInfo {
  source: 'objective_pace' | 'objective_time' | 'previous_pr';
  paceSeconds: number;
  label: string;
  confidence: 'alta' | 'moderada';
  totalSeconds?: number;
  distanceKm?: number;
  previousSeconds?: number;
}

/** ai-coach.js:367-400 */
export function getGoalTargetInfo(
  userData: Pick<AthleteInput, 'objective' | 'targetDistance' | 'customDistance' | 'no5k' | 'time5k' | 'no10k' | 'time10k' | 'no21k' | 'time21k' | 'no42k' | 'time42k'>,
): GoalTargetInfo | null {
  const objective = String(userData?.objective || '').toLowerCase();

  const pacePatterns = [
    /(\d{1,2})\s*[:h]\s*(\d{2})\s*(?:de\s*)?pace/,
    /pace\s*(?:de|para|pra|por volta de)?\s*(\d{1,2})\s*[:h]\s*(\d{2})/,
    /(\d{1,2})['’](\d{2})/,
  ];

  for (const pattern of pacePatterns) {
    const match = objective.match(pattern);
    if (match) {
      const paceSeconds = Number(match[1]) * 60 + Number(match[2]);
      return {
        source: 'objective_pace',
        paceSeconds,
        label: secondsToPace(paceSeconds),
        confidence: 'alta',
      };
    }
  }

  const timeGoal = parseTimeGoalFromObjective(userData);
  if (timeGoal?.paceSeconds) {
    return {
      ...timeGoal,
      paceSeconds: timeGoal.paceSeconds,
      label: `${timeGoal.label} (${secondsToPace(timeGoal.paceSeconds)})`,
      confidence: timeGoal.source === 'previous_pr' ? 'moderada' : 'alta',
    };
  }

  return null;
}

/** ai-coach.js:402-404 */
export function inferGoalPaceSeconds(
  userData: Pick<AthleteInput, 'objective' | 'targetDistance' | 'customDistance' | 'no5k' | 'time5k' | 'no10k' | 'time10k' | 'no21k' | 'time21k' | 'no42k' | 'time42k'>,
): number | null {
  return getGoalTargetInfo(userData)?.paceSeconds || null;
}

/** ai-coach.js:406-412 */
export function getRaceType(distanceKm: number): RaceType {
  if (distanceKm > 42.2) return 'ultra';
  if (distanceKm >= 42) return 'maratona';
  if (distanceKm >= 21) return 'meia';
  if (distanceKm >= 10) return '10k';
  return '5k';
}

/** ai-coach.js:355-364 */
export function inferBasePaceSeconds(userData: Pick<AthleteInput, 'test3kmPace' | 'test3kmTime'>): number | null {
  const fromPace = paceToSeconds(userData.test3kmPace);
  if (fromPace) return fromPace;

  const testTime = timeToSeconds(userData.test3kmTime);
  if (testTime) return Math.round(testTime / 3);

  return null;
}

export interface GoalContext {
  type: 'endurance_goal' | 'performance_goal';
  raceType: RaceType;
  goalPace: number | null;
  goalTarget: GoalTargetInfo | null;
  testPace: number | null;
  distanceKm: number;
  terrain: TerrainGuidance;
  speedReserve: 'não calculada' | 'baixa' | 'moderada' | 'alta' | 'muito alta';
  zoneStrategy: ZoneStrategy;
  intensityBias: string;
  progressionStyle: string;
  recoveryPriority: string;
  volumeFactor: number;
  longRunFactor: number;
  qualityFrequency: string;
  targetSummary: string | null;
  targetSource: string | null;
  summary: string;
}

/** ai-coach.js:414-491 */
export function getGoalContext(
  userData: Pick<
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
  >,
): GoalContext {
  const testPace = inferBasePaceSeconds(userData);
  const goalTarget = getGoalTargetInfo(userData);
  const goalPace = goalTarget?.paceSeconds || null;
  const distanceKm = getDistanceKm(userData);
  const raceType = getRaceType(distanceKm);
  const objective = String(userData?.objective || '').toLowerCase();
  const terrain = getTerrainGuidance(userData?.terrainType || userData?.terrain || 'plano');

  const enduranceWords =
    /completar|terminar|sem parar|resist[eê]ncia|concluir|longa dist[aâ]ncia|seguran[çc]a|sem lesionar|const[aâ]ncia|ultra|maratona|long[aã]o/.test(
      objective,
    );
  const longDistance = distanceKm >= 21;
  const veryLongDistance = distanceKm > 42.2;
  const muchSlowerGoal = Boolean(testPace && goalPace && goalPace - testPace >= (veryLongDistance ? 45 : 60));
  const goalAnchored = Boolean(goalPace && (veryLongDistance || (longDistance && (enduranceWords || muchSlowerGoal))));

  const testAdvantageSeconds = testPace && goalPace ? goalPace - testPace : null;
  const speedReserve =
    testAdvantageSeconds == null
      ? 'não calculada'
      : testAdvantageSeconds >= 120
        ? 'muito alta'
        : testAdvantageSeconds >= 60
          ? 'alta'
          : testAdvantageSeconds >= 20
            ? 'moderada'
            : 'baixa';

  let zoneStrategy: ZoneStrategy = 'capacity_anchored';
  let intensityBias = 'moderado';
  let progressionStyle = 'equilibrada';
  let recoveryPriority = 'média';
  let volumeFactor = 1;
  let longRunFactor = 1;
  let qualityFrequency = 'normal';
  let summary = 'Objetivo permite equilíbrio entre base, qualidade e especificidade.';

  if (goalAnchored) {
    zoneStrategy = 'goal_anchored';
    intensityBias = veryLongDistance ? 'baixo' : 'baixo/moderado';
    progressionStyle = veryLongDistance ? 'conservadora' : 'controlada';
    recoveryPriority = veryLongDistance ? 'alta' : 'média/alta';
    volumeFactor = veryLongDistance ? 0.92 : 0.96;
    longRunFactor = veryLongDistance ? 0.94 : 0.98;
    qualityFrequency = veryLongDistance ? 'rara e curta' : 'moderada';
    summary = veryLongDistance
      ? 'Ultra detectada: o pace alvo e a resistência específica mandam na planilha. O teste de 3km mede velocidade, mas não define o ritmo dos longões.'
      : 'Prova longa detectada: o pace alvo e a resistência têm prioridade sobre a velocidade curta do teste de 3km.';
  } else if (raceType === 'meia') {
    zoneStrategy = goalPace ? 'mixed_goal_capacity' : 'capacity_anchored';
    intensityBias = 'moderado';
    progressionStyle = 'controlada';
    recoveryPriority = 'média';
    volumeFactor = 0.98;
    longRunFactor = 1;
    qualityFrequency = 'moderada';
    summary = 'Meia maratona: equilíbrio entre resistência, ritmo sustentado e blocos próximos ao objetivo.';
  }

  return {
    type: goalAnchored ? 'endurance_goal' : 'performance_goal',
    raceType,
    goalPace,
    goalTarget,
    testPace,
    distanceKm,
    terrain,
    speedReserve,
    zoneStrategy,
    intensityBias,
    progressionStyle,
    recoveryPriority,
    volumeFactor,
    longRunFactor,
    qualityFrequency,
    targetSummary: goalTarget?.label || null,
    targetSource: goalTarget?.source || null,
    summary,
  };
}
