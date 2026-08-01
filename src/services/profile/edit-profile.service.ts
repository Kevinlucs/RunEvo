import { athleteProfileRepository } from '@/repositories';
import { queryClient } from '@/store/query-client';
import { calculateIMC } from '@/domain/motor-evo/profile';
import { err, toAppError, type Result } from '@/utils/result';
import type { AthleteProfile } from '@/domain/entities';

export interface EditProfileInput {
  id: string;
  displayName: string | null;
  currentWeightKg: number | null;
  heightCm: number | null;
  preferredUnit: 'km' | 'mi';
  language: string;
  theme: 'dark' | 'light' | 'system';
}

/**
 * docs/fase-6-brief.md §32. IMC recalculado a partir do peso novo + altura já
 * salva no perfil, reusando `calculateIMC` (src/domain/motor-evo/profile.ts —
 * domínio fechado, só reuso de cálculo puro já existente, nenhuma regra
 * nova). `preferredUnit`/`language`/`theme` são gravados como preferência do
 * atleta — o app hoje é km/pt-BR/escuro fixo em toda tela, então essas 3
 * opções ainda não têm efeito visível (divergência reportada na Parada 2).
 */
export async function updateAthleteProfile(input: EditProfileInput): Promise<Result<AthleteProfile>> {
  try {
    const imc = calculateIMC({
      imc: null,
      weight: input.currentWeightKg ?? undefined,
      height: input.heightCm ?? undefined,
    });
    const res = await athleteProfileRepository.upsert({
      id: input.id,
      display_name: input.displayName,
      current_weight_kg: input.currentWeightKg,
      imc,
      preferred_unit: input.preferredUnit,
      language: input.language,
      theme: input.theme,
    });
    if (!res.ok) return res;
    await queryClient.invalidateQueries();
    return res;
  } catch (e) {
    return err(toAppError(e, 'storage'));
  }
}
