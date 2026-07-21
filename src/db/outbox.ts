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

export async function readOutbox(db: SQLiteDatabase): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>('SELECT * FROM outbox ORDER BY created_at ASC, id ASC');
}

export async function deleteOutboxEntry(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}

export async function bumpAttempts(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?', [id]);
}
