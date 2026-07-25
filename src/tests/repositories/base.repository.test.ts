/* eslint-disable import/first */
// expo-sqlite exige o runtime RN/Metro — fora do alcance do ts-jest genérico
// (ver draft.repository.test.ts). Aqui mockamos a interface do SQLiteDatabase
// para testar a lógica pura do BaseRepository (desserialização de jsonColumns).
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();

jest.mock('@/db/sqlite', () => ({
  getDb: async () => ({
    getFirstAsync: mockGetFirstAsync,
    getAllAsync: mockGetAllAsync,
    runAsync: mockRunAsync,
  }),
}));
jest.mock('@/db/outbox', () => ({ enqueue: jest.fn() }));
jest.mock('@/utils/uuid', () => ({ newUuid: () => 'generated-uuid' }));

import { BaseRepository } from '@/repositories/base.repository';
/* eslint-enable import/first */

interface FakeRow {
  id: string;
  updated_at: string;
  user_id: string;
  payload: Record<string, unknown> | string;
}

class FakeRepository extends BaseRepository<FakeRow> {
  protected table = 'fake_table';
  protected override jsonColumns = ['payload'] as const;
}

class PlainRepository extends BaseRepository<{ id: string; updated_at: string; note: string }> {
  protected table = 'plain_table';
}

interface FlagRow {
  id: string;
  updated_at: string;
  onboarding_seen: boolean | number | null;
}

class FlagRepository extends BaseRepository<FlagRow> {
  protected table = 'flag_table';
  protected override booleanColumns = ['onboarding_seen'] as const;
}

/**
 * Gap sistêmico de JSON (docs/fase-4-brief.md, achado no Grupo 3/4): sem
 * desserializar colunas jsonb-like na leitura, `plan.validation`/`blueprint`
 * chegavam como TEXT cru do SQLite local. `jsonColumns` + `deserialize`
 * resolve isso de forma simétrica ao `serialize` da escrita, para qualquer
 * repositório que declare a coluna — não mais por consumidor.
 */
describe('BaseRepository — desserialização sistêmica de colunas jsonb-like', () => {
  const repo = new FakeRepository();

  beforeEach(() => {
    mockGetFirstAsync.mockReset();
    mockGetAllAsync.mockReset();
    mockRunAsync.mockReset();
  });

  it('findById desserializa colunas declaradas em jsonColumns', async () => {
    mockGetFirstAsync.mockResolvedValue({ id: '1', updated_at: 'x', user_id: 'u1', payload: '{"a":1}' });

    const result = await repo.findById('1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.payload).toEqual({ a: 1 });
  });

  it('listByUser desserializa a coluna de todas as linhas', async () => {
    mockGetAllAsync.mockResolvedValue([
      { id: '1', updated_at: 'x', user_id: 'u1', payload: '{"a":1}' },
      { id: '2', updated_at: 'y', user_id: 'u1', payload: '{"b":2}' },
    ]);

    const result = await repo.listByUser('u1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.payload).toEqual({ a: 1 });
      expect(result.value[1]?.payload).toEqual({ b: 2 });
    }
  });

  it('coluna já é objeto (não string) — passa direto, sem tentar reparsear', async () => {
    mockGetFirstAsync.mockResolvedValue({ id: '1', updated_at: 'x', user_id: 'u1', payload: { already: 'object' } });

    const result = await repo.findById('1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.payload).toEqual({ already: 'object' });
  });

  it('valor não é JSON válido — mantém a string crua em vez de lançar', async () => {
    mockGetFirstAsync.mockResolvedValue({ id: '1', updated_at: 'x', user_id: 'u1', payload: 'não é json' });

    const result = await repo.findById('1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.payload).toBe('não é json');
  });

  it('upsert retorna a linha salva já desserializada', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce(null) // exists() → linha nova
      .mockResolvedValueOnce({ id: '1', updated_at: 'x', user_id: 'u1', payload: '{"a":1}' }); // leitura final

    const result = await repo.upsert({ id: '1', user_id: 'u1', payload: { a: 1 } });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload).toEqual({ a: 1 });
  });

  it('repositório sem jsonColumns declarado não mexe em nenhuma coluna (comportamento inalterado)', async () => {
    const plain = new PlainRepository();
    mockGetFirstAsync.mockResolvedValue({ id: '1', updated_at: 'x', note: '{"not":"parsed"}' });

    const result = await plain.findById('1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.note).toBe('{"not":"parsed"}');
  });
});

/**
 * Gap sistêmico de boolean (achado testando o onboarding num usuário novo no
 * emulador, pós-fix do sync): SQLite não tem tipo boolean, então uma coluna
 * declarada `boolean` no domínio chegava como `0`/`1` (number) cru na
 * leitura. Qualquer comparação estrita no consumidor (`=== true`) falhava
 * silenciosamente. `booleanColumns` resolve simétrico ao `jsonColumns`.
 */
describe('BaseRepository — desserialização sistêmica de colunas boolean-like', () => {
  const repo = new FlagRepository();

  beforeEach(() => {
    mockGetFirstAsync.mockReset();
    mockGetAllAsync.mockReset();
    mockRunAsync.mockReset();
  });

  it('findById converte 1/0 em true/false', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ id: '1', updated_at: 'x', onboarding_seen: 1 });
    const seen = await repo.findById('1');
    expect(seen.ok).toBe(true);
    if (seen.ok) expect(seen.value?.onboarding_seen).toBe(true);

    mockGetFirstAsync.mockResolvedValueOnce({ id: '2', updated_at: 'x', onboarding_seen: 0 });
    const unseen = await repo.findById('2');
    expect(unseen.ok).toBe(true);
    if (unseen.ok) expect(unseen.value?.onboarding_seen).toBe(false);
  });

  it('valor já é boolean — passa direto', async () => {
    mockGetFirstAsync.mockResolvedValue({ id: '1', updated_at: 'x', onboarding_seen: true });
    const result = await repo.findById('1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.onboarding_seen).toBe(true);
  });

  it('valor null (campo boolean nullable) é preservado, não vira false', async () => {
    mockGetFirstAsync.mockResolvedValue({ id: '1', updated_at: 'x', onboarding_seen: null });
    const result = await repo.findById('1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.onboarding_seen).toBeNull();
  });

  it('upsert retorna a linha salva com o boolean já convertido', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce(null) // exists() → linha nova
      .mockResolvedValueOnce({ id: '1', updated_at: 'x', onboarding_seen: 1 }); // leitura final

    const result = await repo.upsert({ id: '1', onboarding_seen: true });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.onboarding_seen).toBe(true);
  });
});
