import { calculateIMC } from '@/domain/motor-evo/profile';
import { calculateWeeks } from '@/domain/motor-evo/dates';
import { getDistanceKm, getGoalContext } from '@/domain/motor-evo/objective';
import { secondsToDuration, secondsToPace } from '@/domain/motor-evo/pace';
import type { AthleteInput } from '@/domain/motor-evo/types';

/**
 * docs/fase-8-brief.md Grupo 1 — classificador de viabilidade do objetivo,
 * FORA do motor (`src/domain/motor-evo/` está fechado nesta fase). Lê
 * valores que o motor já produz (testPace/goalPace via `getGoalContext`,
 * IMC via `calculateIMC`) e soma pontos por fator — mesmo desenho de
 * `calculatePlanRiskLevel` (src/domain/motor-evo/risk.ts). Determinístico,
 * puro, nunca lança. A IA (Grupo 2) só redige a explicação em cima do
 * `GoalViabilityResult` já decidido aqui — nunca decide o nível.
 *
 * Multifatorial por decisão de produto: nenhum fator isoladamente decide o
 * veredito, é a soma que pesa (ver limiares de `levels` abaixo — mesmo o
 * gap de pace no seu valor mais severo sozinho não alcança "fora de
 * alcance", precisa de reforço de outro fator).
 *
 * Nota de QA (não corrigida por instrução do usuário, Parada 1 da Fase 8):
 * o motor tem dois limiares de IMC diferentes para "risco" — 26/30 em
 * `risk.ts` (risco do plano) e 27/30 em `blueprint.ts` (dampening de
 * volume). Este classificador usa seu próprio limiar, independente e
 * ajustável em `VIABILITY_CONFIG.imc` abaixo.
 */

export type ViabilityLevel = 'realista' | 'ambicioso' | 'fora_de_alcance';

export type ViabilityFactorKey = 'pace_gap' | 'imc' | 'experience' | 'deadline' | 'distance';

/**
 * Todos os pesos, limiares e constantes do classificador, num só lugar —
 * pra recalibrar mudando um número aqui, sem caçar pelo código. Ponto de
 * partida definido pelo usuário (Fase 8, Parada 1); ajustável por testes
 * iterativos.
 */
export const VIABILITY_CONFIG = {
  /**
   * Fator 1 — gap de pace entre o objetivo e a capacidade testada (3km).
   * `gapPercent = (testPaceSeconds - goalPaceSeconds) / testPaceSeconds * 100`.
   * Positivo = o objetivo pede um pace MAIS RÁPIDO que a capacidade testada
   * (a direção que preocupa). Negativo/zero = objetivo mais lento ou igual
   * à capacidade (folga, direção confortável) — sempre 0 pontos.
   */
  paceGap: {
    /** Até este %, não pontua — objetivo dentro da capacidade testada. */
    comfortableThresholdPercent: 8,
    /** Acima de `comfortableThresholdPercent` e até este %: pontuação "ambicioso". */
    ambitiousThresholdPercent: 20,
    /** Pontos quando o gap fica entre os dois limiares acima. */
    ambitiousPoints: 2,
    /** Pontos quando o gap ultrapassa `ambitiousThresholdPercent`. */
    outOfReachPoints: 4,
  },
  /**
   * Fator 2 — IMC (peso ⟹ carga segura e impacto articular; nunca juízo
   * estético). Limiares próprios deste classificador — ver nota de QA acima.
   */
  imc: {
    moderateThreshold: 27,
    highThreshold: 30,
    moderatePoints: 1,
    highPoints: 2,
  },
  /**
   * Fator 3 — experiência prévia: o atleta já tem algum tempo registrado em
   * 5/10/21/42k? Ausência de qualquer histórico soma incerteza (pontos
   * baixos — é só um sinal a mais, não decide sozinho).
   */
  experience: {
    noPriorRacePoints: 1,
  },
  /**
   * Fator 4 — prazo até a prova, relativo à distância. Cada faixa de
   * distância (`maxDistanceKm`, em ordem crescente) tem um número de
   * semanas "confortável"; abaixo disso soma pontos, proporcional a quão
   * apertado está.
   */
  deadline: {
    comfortableWeeksByDistance: [
      { maxDistanceKm: 5, weeks: 6 },
      { maxDistanceKm: 10, weeks: 8 },
      { maxDistanceKm: 21.1, weeks: 12 },
      { maxDistanceKm: 42.2, weeks: 16 },
      { maxDistanceKm: Infinity, weeks: 20 },
    ] as { maxDistanceKm: number; weeks: number }[],
    /** < confortável × isto (e ≥ confortável): pontuação "justo". */
    tightMultiplier: 1.5,
    tightPoints: 1,
    /** < confortável (sem multiplicador): pontuação "muito justo". */
    veryTightPoints: 2,
  },
  /**
   * Fator 5 — distância do objetivo: provas longas (maratona/ultra) somam
   * risco de execução inerente (lesão, logística, tolerância muscular),
   * independente de pace ou prazo.
   */
  distance: {
    longDistanceKmThreshold: 42,
    longDistancePoints: 1,
  },
  /**
   * Faixas finais: soma de pontos de TODOS os fatores → nível. Desenhado
   * para que nenhum fator isolado, no seu valor mais severo, alcance
   * "fora_de_alcance" sozinho (ex.: gap de pace no máximo = 4 pontos, fica
   * em "ambicioso"; precisa de reforço de outro fator para passar de 5).
   */
  levels: {
    /** <= isto: realista. */
    realisticMaxPoints: 1,
    /** <= isto (e > realisticMaxPoints): ambicioso. > isto: fora de alcance. */
    ambitiousMaxPoints: 5,
  },
} as const;

/**
 * Labels de exibição — nunca "impossível" (regra de tom da Fase 8). "Fora de
 * alcance por ora" é o mais duro que se diz, sempre com o "por ora" que
 * enquadra como etapa, não rejeição.
 */
export const VIABILITY_LEVEL_LABELS: Record<ViabilityLevel, string> = {
  realista: 'Realista',
  ambicioso: 'Ambicioso',
  fora_de_alcance: 'Fora de alcance por ora',
};

export interface ViabilityFactor {
  key: ViabilityFactorKey;
  points: number;
  reason: string;
}

/** Alvo intermediário ancorado na capacidade real, só quando level === 'fora_de_alcance'. */
export interface AnchoredTarget {
  paceSecondsPerKm: number;
  paceLabel: string;
  projectedTotalSeconds: number;
  projectedTimeLabel: string;
}

export interface GoalViabilityResult {
  level: ViabilityLevel;
  points: number;
  factors: ViabilityFactor[];
  /** Só presente quando level === 'fora_de_alcance'. */
  anchoredTarget: AnchoredTarget | null;
  /** Objetivo original do atleta (texto livre), para a "jornada em etapas" na comunicação (Grupo 2). */
  originalGoalLabel: string | null;
}

export type ViabilityAthleteInput = Pick<
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
  | 'startDate'
  | 'raceDate'
  | 'imc'
  | 'weight'
  | 'height'
>;

export function classifyGoalViability(userData: ViabilityAthleteInput): GoalViabilityResult {
  const goalContext = getGoalContext(userData);
  const distanceKm = getDistanceKm(userData);
  const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
  const imc = calculateIMC(userData);
  const { testPace, goalPace } = goalContext;

  const factors: ViabilityFactor[] = [];
  let points = 0;

  // Fator 1 — gap de pace.
  const { comfortableThresholdPercent, ambitiousThresholdPercent, ambitiousPoints, outOfReachPoints } =
    VIABILITY_CONFIG.paceGap;
  if (testPace && goalPace) {
    const gapPercent = ((testPace - goalPace) / testPace) * 100;
    if (gapPercent > ambitiousThresholdPercent) {
      points += outOfReachPoints;
      factors.push({
        key: 'pace_gap',
        points: outOfReachPoints,
        reason: `objetivo pede pace ${Math.round(gapPercent)}% mais rápido que a capacidade testada`,
      });
    } else if (gapPercent > comfortableThresholdPercent) {
      points += ambitiousPoints;
      factors.push({
        key: 'pace_gap',
        points: ambitiousPoints,
        reason: `objetivo pede pace ${Math.round(gapPercent)}% mais rápido que a capacidade testada`,
      });
    } else {
      factors.push({ key: 'pace_gap', points: 0, reason: 'pace do objetivo dentro da capacidade testada' });
    }
  } else {
    factors.push({
      key: 'pace_gap',
      points: 0,
      reason: 'sem pace-alvo textual ou teste de 3km suficiente para medir o gap',
    });
  }

  // Fator 2 — IMC.
  const { moderateThreshold, highThreshold, moderatePoints, highPoints } = VIABILITY_CONFIG.imc;
  if (imc && imc >= highThreshold) {
    points += highPoints;
    factors.push({ key: 'imc', points: highPoints, reason: `IMC ${imc.toFixed(1)} pede carga mais conservadora` });
  } else if (imc && imc >= moderateThreshold) {
    points += moderatePoints;
    factors.push({
      key: 'imc',
      points: moderatePoints,
      reason: `IMC ${imc.toFixed(1)} acima do ideal para carga alta`,
    });
  } else {
    factors.push({
      key: 'imc',
      points: 0,
      reason: imc ? `IMC ${imc.toFixed(1)} dentro da faixa confortável` : 'IMC não informado',
    });
  }

  // Fator 3 — experiência prévia.
  const hasPriorRace = Boolean(
    (!userData.no5k && userData.time5k) ||
      (!userData.no10k && userData.time10k) ||
      (!userData.no21k && userData.time21k) ||
      (!userData.no42k && userData.time42k),
  );
  if (!hasPriorRace) {
    points += VIABILITY_CONFIG.experience.noPriorRacePoints;
    factors.push({
      key: 'experience',
      points: VIABILITY_CONFIG.experience.noPriorRacePoints,
      reason: 'sem histórico de provas anteriores registrado',
    });
  } else {
    factors.push({ key: 'experience', points: 0, reason: 'já tem tempo registrado em prova anterior' });
  }

  // Fator 4 — prazo x distância.
  const { comfortableWeeksByDistance, tightMultiplier, tightPoints, veryTightPoints } = VIABILITY_CONFIG.deadline;
  const comfortableWeeks =
    comfortableWeeksByDistance.find((bucket) => distanceKm <= bucket.maxDistanceKm)?.weeks ??
    comfortableWeeksByDistance[comfortableWeeksByDistance.length - 1]!.weeks;
  if (totalWeeks < comfortableWeeks) {
    points += veryTightPoints;
    factors.push({
      key: 'deadline',
      points: veryTightPoints,
      reason: `prazo de ${totalWeeks} semanas é curto para ${distanceKm}km`,
    });
  } else if (totalWeeks < comfortableWeeks * tightMultiplier) {
    points += tightPoints;
    factors.push({
      key: 'deadline',
      points: tightPoints,
      reason: `prazo de ${totalWeeks} semanas é justo para ${distanceKm}km`,
    });
  } else {
    factors.push({
      key: 'deadline',
      points: 0,
      reason: `prazo de ${totalWeeks} semanas é confortável para ${distanceKm}km`,
    });
  }

  // Fator 5 — distância do objetivo.
  if (distanceKm >= VIABILITY_CONFIG.distance.longDistanceKmThreshold) {
    points += VIABILITY_CONFIG.distance.longDistancePoints;
    factors.push({
      key: 'distance',
      points: VIABILITY_CONFIG.distance.longDistancePoints,
      reason: 'distância longa (maratona/ultra) exige mais margem de segurança',
    });
  } else {
    factors.push({ key: 'distance', points: 0, reason: 'distância não exige margem extra' });
  }

  let level: ViabilityLevel = 'realista';
  if (points > VIABILITY_CONFIG.levels.ambitiousMaxPoints) level = 'fora_de_alcance';
  else if (points > VIABILITY_CONFIG.levels.realisticMaxPoints) level = 'ambicioso';

  let anchoredTarget: AnchoredTarget | null = null;
  if (level === 'fora_de_alcance' && testPace) {
    const projectedTotalSeconds = Math.round(testPace * distanceKm);
    anchoredTarget = {
      paceSecondsPerKm: testPace,
      paceLabel: secondsToPace(testPace),
      projectedTotalSeconds,
      projectedTimeLabel: secondsToDuration(projectedTotalSeconds),
    };
  }

  return {
    level,
    points: Math.round(points * 10) / 10,
    factors,
    anchoredTarget,
    originalGoalLabel: userData.objective?.trim() || null,
  };
}
