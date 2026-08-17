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
 * Gate de adoção — regra INVIOLÁVEL: primeira adoção NUNCA mostra paywall.
 *
 * Lógica:
 * - Plus: SEMPRE permitido.
 * - Free SEM planos arquivados: SEMPRE permitido (trial / primeira planilha).
 * - Free COM planos arquivados: bloqueado (já usou trial, precisa Plus).
 * - __DEV__: logs de debug para diagnóstico no Metro.
 *
 * Se RevenueCat falhar (Expo Go), isPlus = false → não bloqueia primeira
 * adoção (sem arquivados). Trial = min(8, floor(totalWeeks/2)).
 */
export async function adoptPlan(plan: Plan, userId: string, isPlus: boolean): Promise<Result<AdoptResult>> {
  try {
    const activeRes = await trainingPlanRepository.getActive(userId);
    if (!activeRes.ok) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[ADOPT] getActive FAILED:', activeRes.error);
      return err(activeRes.error);
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[ADOPT] activePlan:', activeRes.value?.id ?? 'null', '| isPlus:', isPlus);

    // Gate: checa planos ARQUIVADOS (evidência de trial já usado).
    if (!isPlus) {
      const archivedRes = await trainingPlanRepository.listArchived(userId);
      const archivedCount = archivedRes.ok ? archivedRes.value.length : 0;

      if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[ADOPT] archivedPlans:', archivedCount, '| decision:', archivedCount > 0 ? 'BLOCK' : 'ALLOW');

      if (archivedCount > 0) {
        return err(new AppError('entitlement', 'Gerar uma nova planilha requer RunEvo+.'));
      }
    }

    // Se havia plano ativo, arquiva antes de inserir o novo.
    if (activeRes.value) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[ADOPT] Archiving active plan:', activeRes.value.id);
      const archiveRes = await trainingPlanRepository.upsert({ ...activeRes.value, status: 'archived' });
      if (!archiveRes.ok) return err(archiveRes.error);
    }

    const { plan: planRow, workouts } = planToRows(plan, userId);
    const planRes = await trainingPlanRepository.upsert({ ...planRow, status: 'active' });
    if (!planRes.ok) return err(planRes.error);

    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[ADOPT] Plan saved as active. Saving', workouts.length, 'workouts...');

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
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[ADOPT] SUCCESS. trialWeeks:', trialWeeks);
    return ok({ trialWeeks });
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}
