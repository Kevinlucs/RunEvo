/* eslint-disable import/first */
// expo-sqlite/supabase exigem runtime RN — mocka as bordas de I/O do sync.ts
// para testar só a decisão de erro transitório vs permanente (Grupo 5).
const mockReadOutbox = jest.fn();
const mockDeleteOutboxEntry = jest.fn();
const mockBumpAttempts = jest.fn();
const mockMarkOutboxFailed = jest.fn();

jest.mock('@/db/outbox', () => ({
  readOutbox: mockReadOutbox,
  deleteOutboxEntry: mockDeleteOutboxEntry,
  bumpAttempts: mockBumpAttempts,
  markOutboxFailed: mockMarkOutboxFailed,
}));
// sync.ts importa getDb no topo do módulo (usado só em runSync); pushOutbox
// não o chama, mas o import transitivo puxa expo-sqlite se não for mockado.
jest.mock('@/db/sqlite', () => ({ getDb: jest.fn() }));

const mockUpsert = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ upsert: mockUpsert })) },
}));

import { pushOutbox } from '@/db/sync';
import type { OutboxEntry } from '@/db/sync-core';
import type { SQLiteDatabase } from 'expo-sqlite';
/* eslint-enable import/first */

function makeEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: 1,
    table_name: 'plan_workouts',
    row_id: 'w1',
    op: 'update',
    payload: JSON.stringify({ id: 'w1', updated_at: '2026-01-01T00:00:00Z' }),
    created_at: '2026-01-01T00:00:00Z',
    attempts: 0,
    ...overrides,
  };
}

const fakeDb = { runAsync: jest.fn() } as unknown as SQLiteDatabase;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pushOutbox (docs/fase-5-brief.md Grupo 5)', () => {
  it('sucesso: remove do outbox e não marca falha', async () => {
    mockUpsert.mockResolvedValue({ error: null, status: 200 });
    mockReadOutbox.mockResolvedValue([makeEntry()]);

    await pushOutbox(fakeDb);

    expect(mockDeleteOutboxEntry).toHaveBeenCalledWith(fakeDb, 1);
    expect(mockBumpAttempts).not.toHaveBeenCalled();
    expect(mockMarkOutboxFailed).not.toHaveBeenCalled();
  });

  it('erro de constraint (409) vai para failed com motivo, não some', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint' }, status: 409 });
    mockReadOutbox.mockResolvedValue([makeEntry({ attempts: 0 })]);

    await pushOutbox(fakeDb);

    expect(mockMarkOutboxFailed).toHaveBeenCalledWith(
      fakeDb,
      1,
      expect.stringContaining('duplicate key value violates unique constraint'),
    );
    expect(mockDeleteOutboxEntry).not.toHaveBeenCalled();
    expect(mockBumpAttempts).not.toHaveBeenCalled();
  });

  it('erro de rede (status 0) re-tenta em vez de falhar direto', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'Network request failed' }, status: 0 });
    mockReadOutbox.mockResolvedValue([makeEntry({ attempts: 1 })]);

    await pushOutbox(fakeDb);

    expect(mockBumpAttempts).toHaveBeenCalledWith(fakeDb, 1);
    expect(mockMarkOutboxFailed).not.toHaveBeenCalled();
    expect(mockDeleteOutboxEntry).not.toHaveBeenCalled();
  });

  it('erro transitório que esgota as tentativas vira failed (não é descartado calado)', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'upstream connect error' }, status: 503 });
    mockReadOutbox.mockResolvedValue([makeEntry({ attempts: 4 })]); // 5ª tentativa = MAX_ATTEMPTS

    await pushOutbox(fakeDb);

    expect(mockBumpAttempts).toHaveBeenCalledWith(fakeDb, 1);
    expect(mockMarkOutboxFailed).toHaveBeenCalledWith(fakeDb, 1, expect.stringContaining('Esgotadas as tentativas'));
    expect(mockDeleteOutboxEntry).not.toHaveBeenCalled();
  });
});
