import { workoutRepository, checkinRepository } from '@/repositories';
import { queryClient } from '@/store/query-client';
import { isRaceWorkout } from '@/services/workout/workout-detail.service';
import { err, ok, toAppError, type Result } from '@/utils/result';
import type { Workout } from '@/domain/entities';

const RACE_LOCKED_MESSAGE = 'O treino da prova não pode ser editado, removido ou reordenado.';

/**
 * docs/fase-5-brief.md Grupo 4 (§22). Invalida (não apaga) qualquer check-in
 * não invalidado da semana afetada — o atleta precisa refazer. Mantém a
 * linha como histórico, com o motivo.
 */
async function invalidateCheckinForWeek(planId: string, weekNumber: number, reason: string): Promise<Result<void>> {
  const listRes = await checkinRepository.listByPlan(planId);
  if (!listRes.ok) return err(listRes.error);

  const affected = listRes.value.filter((c) => c.week_number === weekNumber && !c.invalidated);
  for (const checkin of affected) {
    const res = await checkinRepository.upsert({
      id: checkin.id,
      invalidated: true,
      invalidated_reason: reason,
    });
    if (!res.ok) return err(res.error);
  }
  return ok(undefined);
}

async function loadWeekWorkouts(planId: string, weekNumber: number): Promise<Result<Workout[]>> {
  const res = await workoutRepository.listByPlan(planId);
  if (!res.ok) return err(res.error);
  return ok(res.value.filter((w) => w.week_number === weekNumber).sort((a, b) => a.week_index - b.week_index));
}

export interface UpdateWorkoutInput {
  workoutId: string;
  title?: string;
  description?: string;
  dayType?: string;
  dayLabel?: string;
  workoutDate?: string | null;
  plannedKm?: number;
  plannedPace?: string;
}

/** Edita um treino pendente. Nunca o treino da prova (§22). Invalida o check-in da semana, se houver. */
export async function updateWorkout(input: UpdateWorkoutInput): Promise<Result<Workout>> {
  try {
    const currentRes = await workoutRepository.findById(input.workoutId);
    if (!currentRes.ok) return err(currentRes.error);
    if (!currentRes.value) return err(toAppError(new Error('Treino não encontrado.'), 'not_found'));
    const current = currentRes.value;
    if (isRaceWorkout(current)) return err(toAppError(new Error(RACE_LOCKED_MESSAGE), 'validation'));

    const updateRes = await workoutRepository.upsert({
      id: input.workoutId,
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.dayType !== undefined && { day_type: input.dayType }),
      ...(input.dayLabel !== undefined && { day_label: input.dayLabel }),
      ...(input.workoutDate !== undefined && { workout_date: input.workoutDate }),
      ...(input.plannedKm !== undefined && { planned_km: input.plannedKm }),
      ...(input.plannedPace !== undefined && { planned_pace: input.plannedPace }),
    });
    if (!updateRes.ok) return err(updateRes.error);

    const invalidateRes = await invalidateCheckinForWeek(
      current.plan_id,
      current.week_number,
      'Treino editado manualmente após o check-in.',
    );
    if (!invalidateRes.ok) return err(invalidateRes.error);

    await queryClient.invalidateQueries();
    return updateRes;
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}

/** Remove (soft-delete) um treino pendente. Nunca o treino da prova (§22). */
export async function removeWorkout(workoutId: string): Promise<Result<void>> {
  try {
    const currentRes = await workoutRepository.findById(workoutId);
    if (!currentRes.ok) return err(currentRes.error);
    if (!currentRes.value) return err(toAppError(new Error('Treino não encontrado.'), 'not_found'));
    const current = currentRes.value;
    if (isRaceWorkout(current)) return err(toAppError(new Error(RACE_LOCKED_MESSAGE), 'validation'));

    const removeRes = await workoutRepository.remove(workoutId);
    if (!removeRes.ok) return err(removeRes.error);

    const invalidateRes = await invalidateCheckinForWeek(
      current.plan_id,
      current.week_number,
      'Treino removido manualmente após o check-in.',
    );
    if (!invalidateRes.ok) return err(invalidateRes.error);

    await queryClient.invalidateQueries();
    return ok(undefined);
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}

export interface AddWorkoutInput {
  planId: string;
  userId: string;
  weekNumber: number;
  phase: string;
  title: string;
  description?: string;
  dayType: string;
  dayLabel: string;
  workoutDate?: string | null;
  plannedKm: number;
  plannedPace?: string;
}

/** Adiciona um treino à semana. Se a semana tiver o treino da prova, ele continua sendo o último (§22). */
export async function addWorkout(input: AddWorkoutInput): Promise<Result<Workout>> {
  try {
    const weekRes = await loadWeekWorkouts(input.planId, input.weekNumber);
    if (!weekRes.ok) return err(weekRes.error);
    const week = weekRes.value;

    const race = week.find(isRaceWorkout);
    const nonRace = week.filter((w) => !isRaceWorkout(w));
    const newIndex = nonRace.length ? Math.max(...nonRace.map((w) => w.week_index)) + 1 : 0;

    if (race) {
      const bumpRes = await workoutRepository.upsert({ id: race.id, week_index: newIndex + 1 });
      if (!bumpRes.ok) return err(bumpRes.error);
    }

    const createRes = await workoutRepository.upsert({
      plan_id: input.planId,
      user_id: input.userId,
      week_number: input.weekNumber,
      week_index: newIndex,
      phase: input.phase,
      workout_date: input.workoutDate ?? null,
      day_label: input.dayLabel,
      day_type: input.dayType,
      title: input.title,
      description: input.description ?? '',
      planned_km: input.plannedKm,
      planned_pace: input.plannedPace ?? '-',
      status: 'pending',
    });
    if (!createRes.ok) return err(createRes.error);

    const invalidateRes = await invalidateCheckinForWeek(
      input.planId,
      input.weekNumber,
      'Treino adicionado manualmente após o check-in.',
    );
    if (!invalidateRes.ok) return err(invalidateRes.error);

    await queryClient.invalidateQueries();
    return createRes;
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}

/** Move um treino um passo para cima/baixo dentro da semana. O treino da prova nunca se move nem é ultrapassado (§22). */
export async function moveWorkout(workoutId: string, direction: 'up' | 'down'): Promise<Result<void>> {
  try {
    const currentRes = await workoutRepository.findById(workoutId);
    if (!currentRes.ok) return err(currentRes.error);
    if (!currentRes.value) return err(toAppError(new Error('Treino não encontrado.'), 'not_found'));
    const current = currentRes.value;
    if (isRaceWorkout(current)) return err(toAppError(new Error(RACE_LOCKED_MESSAGE), 'validation'));

    const weekRes = await loadWeekWorkouts(current.plan_id, current.week_number);
    if (!weekRes.ok) return err(weekRes.error);
    const week = weekRes.value;

    const idx = week.findIndex((w) => w.id === workoutId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= week.length) {
      return err(toAppError(new Error('Não é possível mover o treino nessa direção.'), 'validation'));
    }
    const target = week[swapIdx];
    if (!target) return err(toAppError(new Error('Treino não encontrado.'), 'not_found'));
    if (isRaceWorkout(target)) return err(toAppError(new Error(RACE_LOCKED_MESSAGE), 'validation'));

    const res1 = await workoutRepository.upsert({ id: current.id, week_index: target.week_index });
    if (!res1.ok) return err(res1.error);
    const res2 = await workoutRepository.upsert({ id: target.id, week_index: current.week_index });
    if (!res2.ok) return err(res2.error);

    const invalidateRes = await invalidateCheckinForWeek(
      current.plan_id,
      current.week_number,
      'Treinos reordenados manualmente após o check-in.',
    );
    if (!invalidateRes.ok) return err(invalidateRes.error);

    await queryClient.invalidateQueries();
    return ok(undefined);
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}

