import { clamp } from './utils/math';
import { calculateWeeks } from './dates';
import { calculateIMC } from './profile';
import { getDistanceKm, getGoalContext } from './objective';
import type { Plan } from './plan-generator';
import type { PlanBlueprint } from './blueprint';
import type { QualityScore } from './quality-score';
import type { AthleteInput } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — risco do plano.
 * Mapeamento: docs/legacy-audit.md §13.6 (`calculatePlanRiskLevel` → risk.ts).
 * `normalizeRiskLabel` (ai-coach.js:2522-2528) não foi portada: nunca é chamada
 * em lugar nenhum do legado (código morto) — omitida por decisão explícita
 * (ver docs/motor-equivalence-report.md). Os 82/82 testes de equivalência
 * passam sem ela.
 */

export interface RiskResult {
  level: 'baixo' | 'médio' | 'alto' | 'muito alto';
  points: number;
  reasons: string[];
}

type RiskAthleteInput = Pick<AthleteInput, 'startDate' | 'raceDate' | 'daysPerWeek'> &
  Parameters<typeof getDistanceKm>[0] &
  Parameters<typeof calculateIMC>[0];

/** ai-coach.js:2530-2599 */
export function calculatePlanRiskLevel(
  plan: Pick<Plan, 'totalWeeks' | 'daysPerWeek' | 'validation'>,
  userData: RiskAthleteInput,
  blueprint: PlanBlueprint,
  quality: Pick<QualityScore, 'overall'>,
): RiskResult {
  const imc = calculateIMC(userData);
  const distanceKm = getDistanceKm(userData);
  const days = clamp(Number(userData?.daysPerWeek || plan?.daysPerWeek || 3), 2, 6);
  const totalWeeks = plan?.totalWeeks || calculateWeeks(userData.startDate, userData.raceDate);
  const ctx = blueprint?.engineCalibration?.goalContext || getGoalContext(userData);
  const score = Number(quality?.overall || 0);

  let points = 0;
  const reasons: string[] = [];

  if (score < 5.8) {
    points += 3;
    reasons.push('score técnico baixo');
  } else if (score < 7) {
    points += 2;
    reasons.push('score técnico exige revisão');
  } else if (score < 8) {
    points += 1;
    reasons.push('score técnico pede atenção');
  }

  if (imc && imc >= 30) {
    points += 2;
    reasons.push(`IMC ${imc.toFixed(1)} elevado`);
  } else if (imc && imc >= 26) {
    points += 1;
    reasons.push(`IMC ${imc.toFixed(1)} acima do ideal para carga alta`);
  }

  if (days <= 3 && distanceKm >= 42.2) {
    points += 1;
    reasons.push('apenas 3 treinos/semana para prova longa');
  }

  if (distanceKm > 42.2) {
    points += 1;
    reasons.push('ultramaratona exige alta tolerância muscular');
  }

  if (totalWeeks < 12 && distanceKm >= 21.1) {
    points += 2;
    reasons.push('prazo curto para a distância');
  } else if (totalWeeks < 20 && distanceKm > 42.2) {
    points += 1;
    reasons.push('prazo enxuto para ultra');
  }

  const warningCount = (plan?.validation?.warnings || []).filter((w) => !w.fixed).length;
  if (warningCount >= 3) {
    points += 1;
    reasons.push('alertas técnicos pendentes');
  }

  if (ctx?.speedReserve === 'muito alta' && distanceKm >= 21.1) {
    points += 0.5;
    reasons.push('velocidade curta acima do ritmo alvo exige controle');
  }

  let level: RiskResult['level'] = 'baixo';
  if (points >= 6) level = 'muito alto';
  else if (points >= 4) level = 'alto';
  else if (points >= 2) level = 'médio';

  return {
    level,
    points: Math.round(points * 10) / 10,
    reasons: reasons.slice(0, 4),
  };
}
