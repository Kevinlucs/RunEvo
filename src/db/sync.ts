import type { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '@/lib/supabase';
import { getDb } from './sqlite';
import { SYNCED_TABLES, type SyncedTable } from './schema';
import { readOutbox, deleteOutboxEntry, bumpAttempts } from './outbox';
import { planOutboxDrain, planPullMerge, type Syncable } from './sync-core';
import { nowIso } from '@/utils/time';
import { toAppError, type Result, ok, err } from '@/utils/result';

const MAX_ATTEMPTS = 5;

/**
 * PUSH: drena o outbox para o Supabase, aplicando a ordenação/compactação pura.
 * Sucesso → remove do outbox e marca a linha local como 'synced'.
 * Falha → incrementa tentativas (descarta após MAX_ATTEMPTS para não travar a fila).
 */
async function pushOutbox(db: SQLiteDatabase): Promise<void> {
  const entries = planOutboxDrain(await readOutbox(db));
  for (const entry of entries) {
    try {
      const row = JSON.parse(entry.payload) as Record<string, unknown>;
      const cloudRow = stripLocalMeta(row);

      if (entry.op === 'delete') {
        const { error } = await supabase.from(entry.table_name).delete().eq('id', entry.row_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(entry.table_name).upsert(cloudRow);
        if (error) throw error;
      }
      await deleteOutboxEntry(db, entry.id);
      await markSynced(db, entry.table_name, entry.row_id);
    } catch (e) {
      await bumpAttempts(db, entry.id);
      if (entry.attempts + 1 >= MAX_ATTEMPTS) {
        // desiste desta entrada específica para não bloquear as demais
        await deleteOutboxEntry(db, entry.id);
      }
      // não relança: sync é best-effort; próximo ciclo tenta de novo
    }
  }
}

/**
 * PULL: baixa as linhas alteradas desde a última marca d'água e aplica o merge
 * puro (nuvem vence). Atualiza a marca d'água por tabela.
 */
async function pullTable(db: SQLiteDatabase, table: SyncedTable, userId: string): Promise<void> {
  const stateRow = await db.getFirstAsync<{ last_pulled_at: string | null }>(
    'SELECT last_pulled_at FROM sync_state WHERE table_name = ?',
    [table],
  );
  const since = stateRow?.last_pulled_at ?? '1970-01-01T00:00:00.000Z';

  let query = supabase.from(table).select('*').gt('updated_at', since);
  // profiles usa id = user; demais usam user_id (RLS já garante, mas filtramos)
  if (table !== 'athlete_profiles') query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw error;

  const remoteRows = (data ?? []) as unknown as Syncable[];
  if (remoteRows.length === 0) {
    await setWatermark(db, table);
    return;
  }

  const ids = remoteRows.map((r) => r.id);
  const localRows = await db.getAllAsync<Syncable>(
    `SELECT id, updated_at FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  const localById = new Map(localRows.map((r) => [r.id, r]));

  const { toApplyLocally } = planPullMerge(localById, remoteRows);
  for (const remote of toApplyLocally) {
    await upsertLocal(db, table, remote as Record<string, unknown>);
  }
  await setWatermark(db, table);
}

/** Ciclo completo de sincronização (push antes de pull). Best-effort. */
export async function runSync(userId: string): Promise<Result<{ pushed: boolean }>> {
  try {
    const db = await getDb();
    await pushOutbox(db);
    for (const table of SYNCED_TABLES) {
      await pullTable(db, table, userId);
    }
    return ok({ pushed: true });
  } catch (e) {
    return err(toAppError(e, 'network'));
  }
}

// ---- helpers de I/O local ----
function stripLocalMeta(row: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...row };
  delete clone._sync;
  delete clone._deleted;
  return clone;
}

async function markSynced(db: SQLiteDatabase, table: string, id: string): Promise<void> {
  await db.runAsync(`UPDATE ${table} SET _sync = 'synced' WHERE id = ?`, [id]);
}

async function setWatermark(db: SQLiteDatabase, table: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?) ' +
      'ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at',
    [table, nowIso()],
  );
}

/** Upsert genérico no cache local marcando a linha como sincronizada. */
async function upsertLocal(
  db: SQLiteDatabase,
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const normalized: Record<string, unknown> = { ...row, _sync: 'synced', _deleted: 0 };
  const cols = Object.keys(normalized);
  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols.map((c) => `${c} = excluded.${c}`).join(', ');
  const values = cols.map((c) => serializeValue(normalized[c]));
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ` +
      `ON CONFLICT(id) DO UPDATE SET ${updates}`,
    values,
  );
}

/** JSON/boolean → forma que o SQLite aceita. */
function serializeValue(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}
