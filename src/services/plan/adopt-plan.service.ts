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
 * - Free SEM planos arquivados: SEMPRE permitido (é trial / primeira planilha).
 *   Não importa se há plano ativo (pode ser dado residual de sync).
 * - Free COM planos arquivados: bloqueado (já usou o trial, precisa de Plus).
 *
 * O gate checa planos ARQUIVADOS, não ativos. Plano ativo pode ser dado
 * residual, plano gerado via sync, etc. — não é prova de que o trial expirou.
 * Plano arquivado = o usuário JÁ adotou E substituiu antes = trial usado.
 *
 * Se RevenueCat falhar (Expo Go), isPlus = false → não bloqueia primeira
 * adoção (sem arquivados). Trial = min(8, floor(totalWeeks/2)).
 */
export async function adoptPlan(plan: Plan, userId: string, isPlus: boolean): Promise<Result<AdoptResult>> {
  try {
    const activeRes = await trainingPlanRepository.getActive(userId);
    if (!activeRes.ok) return err(activeRes.error);

    // Gate: checa planos ARQUIVADOS (evidência de que trial já foi usado).
    // Free sem histórico arquivado = primeira adoção = trial = permitido.
    if (!isPlus) {
      const archivedRes = await trainingPlanRepository.listArchived(userId);
      const hasArchivedPlans = archivedRes.ok && archivedRes.value.length > 0;
      if (hasArchivedPlans) {
        return err(new AppError('entitlement', 'Gerar uma nova planilha requer RunEvo+.'));
      }
    }

    // Se havia plano ativo, arquiva antes de inserir o novo.
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
