import { trainingPlanRepository, workoutRepository, draftRepository, athleteProfileRepository } from '@/repositories';
import { planToRows } from '@/mappers/plan.mapper';
import { queryClient } from '@/store/query-client';
import { calculateTrialWeeks } from './plan-trial.service';
import { ok, err, toAppError, AppError, type Result } from '@/utils/result';
import type { Plan } from '@/domain/motor-evo/plan-generator';

export interface AdoptResult {
  /** Semanas de trial ativadas (só na primeira adoção Free). null se Plus. */
  trialWeeks: number | null;
}

/**
 * docs/fase-3-brief.md §4.4 + docs/fase-8-brief.md Grupo 3.
 *
 * Gate de adoção (entitlement decidido no serviço, nunca na UI):
 * - Primeira adoção (sem planos arquivados): SEMPRE permitida, ativa trial.
 *   Não importa se isPlus é false — trial se ativa automaticamente.
 * - Substituição (já tem planos arquivados): requer Plus.
 * - Plus: sempre permitido.
 *
 * Paywall NUNCA aparece na primeira adoção. Trial = min(8, floor(totalWeeks/2)).
 */
export async function adoptPlan(plan: Plan, userId: string, isPlus: boolean): Promise<Result<AdoptResult>> {
  try {
    const activeRes = await trainingPlanRepository.getActive(userId);
    if (!activeRes.ok) return err(activeRes.error);

    // Checa se é substituição (já arquivou plano antes).
    const archivedRes = await trainingPlanRepository.listArchived(userId);
    const hasArchivedPlans = archivedRes.ok && archivedRes.value.length > 0;

    // Gate: substituição de plano (já tem histórico) requer Plus.
    // Primeira adoção (sem histórico) SEMPRE passa — é o trial.
    if (hasArchivedPlans && !isPlus) {
      return err(new AppError('entitlement', 'Gerar uma nova planilha requer RunEvo+.'));
    }

    if (activeRes.value) {
      const archiveRes = await trainingPlanRepository.upsert({ ...activeRes.value, status: 'archived' });
      if (!archiveRes.ok) return err(archiveRes.error);
    }

    const { plan: planRow, workouts } = planToRows(plan, userId);
    const planRes = await trainingPlanRepository.upsert({ ...planRow, status: 'active' });
    if (!planRes.ok) return err(planRes.error);

    for (const workout of workouts) {
      const workoutRes = await workoutRepository.upsert(workout);
      if (!workoutRes.ok) return err(workoutRes.error);
    }

    await draftRepository.clear(userId);

    const { height, weight, imc } = plan.userData;
    if (height !== undefined || weight !== undefined || imc !== undefined) {
      await athleteProfileRepository.upsert({
        id: userId,
        ...(height !== undefined && { height_cm: height }),
        ...(weight !== undefined && { current_weight_kg: weight }),
        ...(imc !== undefined && imc !== null && { imc }),
      });
    }

    await queryClient.invalidateQueries();

    // Trial ativado automaticamente na primeira adoção Free.
    const trialWeeks = isPlus ? null : calculateTrialWeeks(plan.totalWeeks);
    return ok({ trialWeeks });
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}
