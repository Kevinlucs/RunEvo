import { trainingPlanRepository, workoutRepository } from '@/repositories';
import { rowsToPlan } from '@/mappers/plan.mapper';
import { arePlansIdentical } from '@/domain/motor-evo/fingerprint';
import type { Plan } from '@/domain/motor-evo/plan-generator';

/**
 * docs/fase-3-brief.md §4.3 — plano idêntico. Compara a planilha nova contra
 * a ativa do usuário (fingerprint, Fase 2 §17); usado antes de mostrar a
 * prévia normal e de novo antes de adotar de fato.
 */
export async function isIdenticalToActivePlan(userId: string, newPlan: Plan): Promise<boolean> {
  const activeRes = await trainingPlanRepository.getActive(userId);
  if (!activeRes.ok || !activeRes.value) return false;

  const workoutsRes = await workoutRepository.listByPlan(activeRes.value.id);
  if (!workoutsRes.ok) return false;

  const activePlan = rowsToPlan(activeRes.value, workoutsRes.value);
  return arePlansIdentical(activePlan, newPlan);
}
