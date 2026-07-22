import { trainingPlanRepository, workoutRepository, draftRepository } from '@/repositories';
import { planToRows } from '@/mappers/plan.mapper';
import { queryClient } from '@/store/query-client';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { Plan } from '@/domain/motor-evo/plan-generator';

/**
 * docs/fase-3-brief.md §4.4. Persistência só via repositories (offline-first
 * → outbox, funciona sem rede). Arquivamento do plano ativo acontece ANTES
 * do insert do novo — o índice único `uniq_active_plan_per_user` (só 1
 * `status='active'` por usuário) rejeitaria o insert se os dois estivessem
 * `active` ao mesmo tempo.
 *
 * Free e Plus arquivam da mesma forma (`status='archived'`, nunca apagado) —
 * a diferença de plano é sobre QUEM PODE VER o histórico depois (gate de UI
 * fora do escopo desta fase), não sobre este mecanismo de troca em si.
 */
export async function adoptPlan(plan: Plan, userId: string): Promise<Result<void>> {
  try {
    const activeRes = await trainingPlanRepository.getActive(userId);
    if (activeRes.ok && activeRes.value) {
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
    await queryClient.invalidateQueries();

    return ok(undefined);
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}
