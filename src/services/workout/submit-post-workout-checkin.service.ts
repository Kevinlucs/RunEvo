import { workoutRepository } from '@/repositories';
import { queryClient } from '@/store/query-client';
import { err, ok, toAppError, type Result } from '@/utils/result';
import type { Workout } from '@/domain/entities';

export type PostWorkoutFeeling = 'muito_facil' | 'facil' | 'ideal' | 'dificil' | 'muito_dificil';

export interface SubmitPostWorkoutCheckinInput {
  workoutId: string;
  effort: number;
  feeling: PostWorkoutFeeling;
  pain: boolean;
  notes?: string | null;
}

/**
 * Fecha o único passo humano que sobra após uma atividade sincronizada.
 * Os campos são os próprios campos de percepção já usados pelo RunEvo no
 * treino; assim o check-in semanal continua sendo a única porta do Adaptive
 * Training, sem criar um segundo motor de adaptação.
 */
export async function submitPostWorkoutCheckin(
  input: SubmitPostWorkoutCheckinInput,
): Promise<Result<Workout>> {
  try {
    if (!Number.isInteger(input.effort) || input.effort < 1 || input.effort > 10) {
      return err(toAppError(new Error('Informe um esforço entre 1 e 10.'), 'validation'));
    }

    const result = await workoutRepository.upsert({
      id: input.workoutId,
      perceived_effort: input.effort,
      feeling: input.feeling,
      pain: input.pain,
      feedback: input.notes?.trim() || null,
      check_in_status: 'completed',
    });
    if (!result.ok) return result;

    await queryClient.invalidateQueries();
    return ok(result.value);
  } catch (error) {
    return err(toAppError(error, 'storage'));
  }
}
