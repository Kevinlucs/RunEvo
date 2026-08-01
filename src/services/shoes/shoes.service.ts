import { shoeRepository } from '@/repositories';
import { queryClient } from '@/store/query-client';
import { nowIso } from '@/utils/time';
import { err, toAppError, type Result } from '@/utils/result';
import type { Shoe } from '@/domain/entities';

/**
 * docs/fase-6-brief.md §33. Persistência só via repository (offline-first).
 * Km atual/incremento por treino já é responsabilidade de
 * complete-workout.service.ts (Fase 4) — este service cobre só o CRUD de
 * cadastro (criar/editar/aposentar/reativar).
 */
export interface ShoeFormInput {
  id?: string;
  userId: string;
  brand: string | null;
  model: string;
  nickname: string | null;
  initialKm: number;
  currentKm: number;
  maxKm: number;
}

export async function saveShoe(input: ShoeFormInput): Promise<Result<Shoe>> {
  try {
    const res = await shoeRepository.upsert({
      id: input.id,
      user_id: input.userId,
      brand: input.brand,
      model: input.model,
      nickname: input.nickname,
      initial_km: input.initialKm,
      current_km: input.currentKm,
      max_km: input.maxKm,
      is_active: true,
    });
    if (!res.ok) return res;
    await queryClient.invalidateQueries();
    return res;
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}

export async function retireShoe(id: string): Promise<Result<Shoe>> {
  try {
    const res = await shoeRepository.upsert({ id, is_active: false, retired_at: nowIso() });
    if (!res.ok) return res;
    await queryClient.invalidateQueries();
    return res;
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}

export async function reactivateShoe(id: string): Promise<Result<Shoe>> {
  try {
    const res = await shoeRepository.upsert({ id, is_active: true, retired_at: null });
    if (!res.ok) return res;
    await queryClient.invalidateQueries();
    return res;
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}

/** §33: alerta visual quando o tênis se aproxima do limite (barra âmbar/vermelha). */
export type ShoeWearLevel = 'ok' | 'warning' | 'danger';

export function classifyShoeWear(currentKm: number, maxKm: number): ShoeWearLevel {
  if (maxKm <= 0) return 'ok';
  const ratio = currentKm / maxKm;
  if (ratio >= 1) return 'danger';
  if (ratio >= 0.85) return 'warning';
  return 'ok';
}
