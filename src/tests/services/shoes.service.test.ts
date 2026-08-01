/**
 * Testes headless de shoes.service.ts (docs/fase-6-brief.md §33) — CRUD de
 * tênis. `@/repositories` mockado (expo-sqlite exige runtime RN/Metro).
 */
/* eslint-disable import/first */
const upsertMock = jest.fn();
const invalidateQueriesMock = jest.fn();

jest.mock('@/repositories', () => ({ shoeRepository: { upsert: upsertMock } }));
jest.mock('@/store/query-client', () => ({ queryClient: { invalidateQueries: invalidateQueriesMock } }));

import { saveShoe, retireShoe, reactivateShoe, classifyShoeWear } from '@/services/shoes/shoes.service';
import { ok, err } from '@/utils/result';
/* eslint-enable import/first */

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('saveShoe', () => {
  it('cria um tênis novo (sem id) como ativo', async () => {
    upsertMock.mockResolvedValue(ok({ id: 'shoe-1' }));

    const result = await saveShoe({
      userId: USER_ID,
      brand: 'Asics',
      model: 'Gel Nimbus',
      nickname: null,
      initialKm: 0,
      currentKm: 0,
      maxKm: 600,
    });

    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, model: 'Gel Nimbus', is_active: true }),
    );
    expect(invalidateQueriesMock).toHaveBeenCalled();
  });

  it('edita um tênis existente repassando o id', async () => {
    upsertMock.mockResolvedValue(ok({ id: 'shoe-1' }));

    await saveShoe({
      id: 'shoe-1',
      userId: USER_ID,
      brand: 'Nike',
      model: 'Pegasus',
      nickname: 'Velho confiável',
      initialKm: 10,
      currentKm: 120,
      maxKm: 700,
    });

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'shoe-1', current_km: 120, max_km: 700 }));
  });

  it('falha ao salvar → propaga erro e não invalida queries', async () => {
    upsertMock.mockResolvedValue(err({ code: 'storage', message: 'disco cheio' }));

    const result = await saveShoe({
      userId: USER_ID,
      brand: null,
      model: 'X',
      nickname: null,
      initialKm: 0,
      currentKm: 0,
      maxKm: 600,
    });

    expect(result.ok).toBe(false);
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});

describe('retireShoe / reactivateShoe', () => {
  it('aposenta: is_active false e retired_at preenchido', async () => {
    upsertMock.mockResolvedValue(ok({ id: 'shoe-1' }));

    await retireShoe('shoe-1');

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'shoe-1', is_active: false, retired_at: expect.any(String) }),
    );
    expect(invalidateQueriesMock).toHaveBeenCalled();
  });

  it('reativa: is_active true e retired_at limpo', async () => {
    upsertMock.mockResolvedValue(ok({ id: 'shoe-1' }));

    await reactivateShoe('shoe-1');

    expect(upsertMock).toHaveBeenCalledWith({ id: 'shoe-1', is_active: true, retired_at: null });
  });
});

describe('classifyShoeWear (docs/fase-6-brief.md §33 — alerta visual perto do limite)', () => {
  it.each([
    [0, 600, 'ok'],
    [509, 600, 'ok'],
    [510, 600, 'warning'],
    [599, 600, 'warning'],
    [600, 600, 'danger'],
    [650, 600, 'danger'],
    [100, 0, 'ok'],
  ])('current=%s max=%s → %s', (current, max, expected) => {
    expect(classifyShoeWear(current, max)).toBe(expected);
  });
});
