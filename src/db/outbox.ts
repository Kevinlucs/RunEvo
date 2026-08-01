import type { SQLiteDatabase } from 'expo-sqlite';
import type { OutboxEntry, SyncOp } from './sync-core';
import { nowIso } from '@/utils/time';

/** Enfileira uma mutação local para envio posterior à nuvem. */
export async function enqueue(
  db: SQLiteDatabase,
  table: string,
  rowId: string,
  op: SyncOp,
  payload: unknown,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO outbox (table_name, row_id, op, payload, created_at, attempts) VALUES (?, ?, ?, ?, ?, 0)',
    [table, rowId, op, JSON.stringify(payload), nowIso()],
  );
}

/** Só as entradas ainda ativas — `failed` não entra mais no drain (Grupo 5). */
export async function readOutbox(db: SQLiteDatabase): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>(
    "SELECT * FROM outbox WHERE status IS NULL OR status != 'failed' ORDER BY created_at ASC, id ASC",
  );
}

/** docs/fase-5-brief.md Grupo 5 — expõe o que não foi possível sincronizar, com o motivo. */
export async function listFailedOutbox(db: SQLiteDatabase): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>("SELECT * FROM outbox WHERE status = 'failed' ORDER BY created_at ASC, id ASC");
}

export async function deleteOutboxEntry(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}

export async function bumpAttempts(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?', [id]);
}

/** Marca a entrada como falha permanente — mantém o dado (não descarta calado), com o motivo. */
export async function markOutboxFailed(db: SQLiteDatabase, id: number, reason: string): Promise<void> {
  await db.runAsync("UPDATE outbox SET status = 'failed', last_error = ? WHERE id = ?", [reason, id]);
}
