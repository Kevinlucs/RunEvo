import { workoutRepository, shoeRepository } from '@/repositories';
import { queryClient } from '@/store/query-client';
import { nowIso } from '@/utils/time';
import { err, toAppError, type Result } from '@/utils/result';
import type { Workout } from '@/domain/entities';

/**
 * docs/fase-4-brief.md Grupo 1.3. Persistência só via repositories (offline
 * → outbox). §33: concluir com tênis incrementa `current_km` do tênis na
 * mesma operação lógica (2 upserts sequenciais — cada um já é local+outbox
 * por si só via BaseRepository; não há transação cross-tabela no SQLite
 * aqui, mas ambos ficam pendentes no outbox mesmo se um dos dois falhar
 * depois do outro ter sido enfileirado, então o sync eventualmente consolida).
 */
export interface CompleteWorkoutInput {
  workoutId: string;
  completedKm: number;
  shoeId?: string | null;
  perceivedEffort: number;
  feedback?: string | null;
}

export async function completeWorkout(input: CompleteWorkoutInput): Promise<Result<Workout>> {
  try {
    const workoutRes = await workoutRepository.upsert({
      id: input.workoutId,
      status: 'completed',
      completed_km: input.completedKm,
      perceived_effort: input.perceivedEffort,
      feedback: input.feedback ?? null,
      shoe_id: input.shoeId ?? null,
      completed_at: nowIso(),
    });
    if (!workoutRes.ok) return workoutRes;

    if (input.shoeId) {
      const shoeRes = await shoeRepository.findById(input.shoeId);
      if (shoeRes.ok && shoeRes.value) {
        const shoeUpsertRes = await shoeRepository.upsert({
          id: input.shoeId,
          current_km: shoeRes.value.current_km + input.completedKm,
        });
        if (!shoeUpsertRes.ok) return err(shoeUpsertRes.error);
      }
    }

    await queryClient.invalidateQueries();
    return workoutRes;
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}

export interface SkipWorkoutInput {
  workoutId: string;
  reason?: string | null;
}

/** Pular não abre formulário de conclusão — nunca grava completed_km/tênis. */
export async function skipWorkout(input: SkipWorkoutInput): Promise<Result<Workout>> {
  try {
    const res = await workoutRepository.upsert({
      id: input.workoutId,
      status: 'skipped',
      feedback: input.reason ?? null,
    });
    if (!res.ok) return res;

    await queryClient.invalidateQueries();
    return res;
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}
