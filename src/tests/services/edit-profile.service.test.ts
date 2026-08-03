/**
 * Testes headless de edit-profile.service.ts (docs/fase-6-brief.md §32).
 * `@/repositories` mockado (expo-sqlite exige runtime RN/Metro).
 */
/* eslint-disable import/first */
const upsertMock = jest.fn();
const invalidateQueriesMock = jest.fn();

jest.mock('@/repositories', () => ({ athleteProfileRepository: { upsert: upsertMock } }));
jest.mock('@/store/query-client', () => ({ queryClient: { invalidateQueries: invalidateQueriesMock } }));

import { updateAthleteProfile } from '@/services/profile/edit-profile.service';
import { ok, err } from '@/utils/result';
/* eslint-enable import/first */

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateAthleteProfile', () => {
  it('recalcula o IMC a partir do peso novo + altura já salva', async () => {
    upsertMock.mockResolvedValue(ok({ id: USER_ID }));

    await updateAthleteProfile({
      id: USER_ID,
      displayName: 'Kevin',
      currentWeightKg: 70,
      heightCm: 175,
      preferredUnit: 'km',
      language: 'pt-BR',
      theme: 'dark',
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_ID, display_name: 'Kevin', current_weight_kg: 70, imc: 22.9 }),
    );
    expect(invalidateQueriesMock).toHaveBeenCalled();
  });

  it('sem peso ou altura → imc null (não força um cálculo inválido)', async () => {
    upsertMock.mockResolvedValue(ok({ id: USER_ID }));

    await updateAthleteProfile({
      id: USER_ID,
      displayName: null,
      currentWeightKg: null,
      heightCm: null,
      preferredUnit: 'mi',
      language: 'en',
      theme: 'light',
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ imc: null, preferred_unit: 'mi', language: 'en', theme: 'light' }),
    );
  });

  it('falha ao salvar → propaga erro e não invalida queries', async () => {
    upsertMock.mockResolvedValue(err({ code: 'storage', message: 'disco cheio' }));

    const result = await updateAthleteProfile({
      id: USER_ID,
      displayName: 'Kevin',
      currentWeightKg: 70,
      heightCm: 175,
      preferredUnit: 'km',
      language: 'pt-BR',
      theme: 'dark',
    });

    expect(result.ok).toBe(false);
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});
