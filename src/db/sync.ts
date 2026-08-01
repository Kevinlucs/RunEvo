import type { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from '@/lib/supabase';
import { getDb } from './sqlite';
import { SYNCED_TABLES, type SyncedTable } from './schema';
import { readOutbox, deleteOutboxEntry, bumpAttempts, markOutboxFailed } from './outbox';
import { planOutboxDrain, planPullMerge, classifySyncError, type Syncable } from './sync-core';
import { nowIso } from '@/utils/time';
import { toAppError, type Result, ok, err } from '@/utils/result';

const MAX_ATTEMPTS = 5;

/** Carrega o status HTTP junto da mensagem para permitir classificar o erro depois (Grupo 5). */
class SyncPushError extends Error {
  constructor(
    message: string,
    readonly status: number | null | undefined,
  ) {
    super(message);
    this.name = 'SyncPushError';
  }
}

/**
 * PUSH: drena o outbox para o Supabase, aplicando a ordenação/compactação pura.
 * Sucesso → remove do outbox e marca a linha local como 'synced'.
 *
 * docs/fase-5-brief.md Grupo 5 (débito da Fase 1): falha distingue erro
 * transitório (rede/5xx/429 — re-tenta, respeitando MAX_ATTEMPTS) de erro
 * permanente (4xx de schema/constraint/validação — re-tentar não resolve).
 * Nos dois casos de esgotamento, a entrada vira `failed` com o motivo — nunca
 * mais é descartada em silêncio.
 */
export async function pushOutbox(db: SQLiteDatabase): Promise<void> {
  const entries = planOutboxDrain(await readOutbox(db));
  for (const entry of entries) {
    try {
      const row = JSON.parse(entry.payload) as Record<string, unknown>;
      const cloudRow = stripLocalMeta(row);

      // entry.table_name vem do outbox (SQLite, coluna TEXT) — em runtime é
      // sempre uma das SYNCED_TABLES (só BaseRepository grava no outbox),
      // mas o schema local não carrega essa garantia no tipo.
      const table = entry.table_name as SyncedTable;
      if (entry.op === 'delete') {
        const { error, status } = await supabase.from(table).delete().eq('id', entry.row_id);
        if (error) throw new SyncPushError(error.message, status);
      } else {
        // cloudRow vem de JSON.parse (linha local sanitizada) — estruturalmente
        // é a linha da tabela, mas com `table: SyncedTable` (união de 6 tabelas)
        // o `.upsert()` tipado rejeita qualquer objeto genérico (RejectExcessProperties
        // sobre a união de Inserts). Não há uma única tabela conhecida em tempo de
        // compilação aqui — cast local e estreito só da assinatura de upsert usada.
        const { error, status } = await (
          supabase.from(table) as unknown as {
            upsert: (
              row: Record<string, unknown>,
            ) => PromiseLike<{ error: { message: string } | null; status: number }>;
          }
        ).upsert(cloudRow);
        if (error) throw new SyncPushError(error.message, status);
      }
      await deleteOutboxEntry(db, entry.id);
      await markSynced(db, entry.table_name, entry.row_id);
    } catch (e) {
      const status = e instanceof SyncPushError ? e.status : undefined;
      const reason = e instanceof Error ? e.message : String(e);
      const kind = classifySyncError(status);

      if (kind === 'permanent') {
        console.warn(`[sync] outbox #${entry.id} (${entry.table_name}) falhou de forma permanente: ${reason}`);
        await markOutboxFailed(db, entry.id, reason);
        continue;
      }

      await bumpAttempts(db, entry.id);
      if (entry.attempts + 1 >= MAX_ATTEMPTS) {
        // esgotou as tentativas de um erro transitório — mantém o dado, não descarta calado
        console.warn(`[sync] outbox #${entry.id} (${entry.table_name}) esgotou tentativas: ${reason}`);
        await markOutboxFailed(db, entry.id, `Esgotadas as tentativas de sincronização: ${reason}`);
      }
      // não relança: sync é best-effort; próximo ciclo tenta de novo
    }
  }
}

/**
 * PULL: baixa as linhas alteradas desde a última marca d'água e aplica o merge
 * puro (nuvem vence). Atualiza a marca d'água por tabela. Retorna se alguma
 * linha foi de fato aplicada localmente (para invalidação de cache seletiva).
 */
async function pullTable(db: SQLiteDatabase, table: SyncedTable, userId: string): Promise<boolean> {
  const stateRow = await db.getFirstAsync<{ last_pulled_at: string | null }>(
    'SELECT last_pulled_at FROM sync_state WHERE table_name = ?',
    [table],
  );
  const since = stateRow?.last_pulled_at ?? '1970-01-01T00:00:00.000Z';

  // profiles usa id = user; demais usam user_id (RLS já garante, mas filtramos).
  // `.from()` com table: SyncedTable (união) só type-checa o `.eq('user_id', …)`
  // quando o branch exclui 'athlete_profiles' — por isso o `.from()` é chamado
  // dentro de cada ramo, não uma vez só antes do if.
  const { data, error } =
    table === 'athlete_profiles'
      ? await supabase.from(table).select('*').gt('updated_at', since)
      : await supabase.from(table).select('*').gt('updated_at', since).eq('user_id', userId);
  if (error) throw error;

  const remoteRows = (data ?? []) as unknown as Syncable[];
  if (remoteRows.length === 0) {
    await setWatermark(db, table);
    return false;
  }

  const ids = remoteRows.map((r) => r.id);
  const localRows = await db.getAllAsync<Syncable>(
    `SELECT id, updated_at FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  const localById = new Map(localRows.map((r) => [r.id, r]));

  const { toApplyLocally } = planPullMerge(localById, remoteRows);
  for (const remote of toApplyLocally) {
    // remote é a linha completa vinda do Supabase (Syncable só declara os
    // campos usados na resolução de conflito); cast estreito e localizado
    // para o shape genérico que upsertLocal grava no SQLite.
    await upsertLocal(db, table, remote as unknown as Record<string, unknown>);
  }
  await setWatermark(db, table);
  return toApplyLocally.length > 0;
}

/**
 * Ciclo completo de sincronização (push antes de pull). Best-effort.
 * `changedTables` lista as tabelas que receberam linhas novas/atualizadas
 * neste ciclo — quem chama usa isso para invalidar só o cache afetado
 * (ver useSync, que é onde vive o mapeamento tabela → query key).
 */
export async function runSync(userId: string): Promise<Result<{ changedTables: SyncedTable[] }>> {
  try {
    const db = await getDb();
    await pushOutbox(db);
    const changedTables: SyncedTable[] = [];
    for (const table of SYNCED_TABLES) {
      const changed = await pullTable(db, table, userId);
      if (changed) changedTables.push(table);
    }
    return ok({ changedTables });
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
