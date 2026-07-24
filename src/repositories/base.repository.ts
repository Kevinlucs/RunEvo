import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '@/db/sqlite';
import { enqueue } from '@/db/outbox';
import { nowIso } from '@/utils/time';
import { newUuid } from '@/utils/uuid';
import { ok, err, toAppError, type Result } from '@/utils/result';

/**
 * Repositório base offline-first. Toda leitura vem do cache local (SQLite);
 * toda escrita grava local E enfileira no outbox para o motor de sync enviar
 * ao Supabase. A UI nunca fala com Supabase direto — só com repositórios.
 */
export abstract class BaseRepository<T extends { id: string; updated_at: string }> {
  protected abstract table: string;

  protected async db(): Promise<SQLiteDatabase> {
    return getDb();
  }

  /** Serializa objetos aninhados (jsonb) e booleans para o SQLite. */
  protected serialize(row: Record<string, unknown>): Record<string, string | number | null> {
    const out: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) out[k] = null;
      else if (typeof v === 'boolean') out[k] = v ? 1 : 0;
      else if (typeof v === 'object') out[k] = JSON.stringify(v);
      else if (typeof v === 'number' || typeof v === 'string') out[k] = v;
      else out[k] = String(v);
    }
    return out;
  }

  async findById(id: string): Promise<Result<T | null>> {
    try {
      const db = await this.db();
      const row = await db.getFirstAsync<T>(
        `SELECT * FROM ${this.table} WHERE id = ? AND _deleted = 0`,
        [id],
      );
      return ok(row ?? null);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  async listByUser(userId: string): Promise<Result<T[]>> {
    try {
      const db = await this.db();
      const col = this.table === 'athlete_profiles' ? 'id' : 'user_id';
      const rows = await db.getAllAsync<T>(
        `SELECT * FROM ${this.table} WHERE ${col} = ? AND _deleted = 0 ORDER BY updated_at DESC`,
        [userId],
      );
      return ok(rows);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /**
   * Insere/atualiza local + enfileira. `id` gerado como UUID válido se
   * ausente.
   *
   * INSERT e UPDATE são statements separados (não `INSERT ... ON CONFLICT DO
   * UPDATE`): o SQLite valida NOT NULL/CHECK da linha candidata do INSERT
   * antes de decidir aplicar o UPDATE do upsert, então um `input` parcial
   * (comum em consumidores como `completeWorkout`/`skipWorkout`, que só
   * enviam as colunas que mudaram) derrubava updates de linhas já existentes
   * com "NOT NULL constraint failed" nas colunas omitidas — só reproduzível
   * com SQLite real, testes headless mockam o repositório (achado em teste
   * de emulador do Grupo 4, docs/fase-4-brief.md). Com statements separados,
   * o UPDATE toca só as colunas presentes em `input`.
   */
  async upsert(input: Partial<T> & Record<string, unknown>): Promise<Result<T>> {
    try {
      const db = await this.db();
      const id = (input.id as string | undefined) ?? newUuid();
      const isNew = !(await this.exists(db, id));
      const row = { ...input, id, updated_at: nowIso(), _sync: 'pending', _deleted: 0 };
      const serialized = this.serialize(row);
      const cols = Object.keys(serialized);

      if (isNew) {
        const placeholders = cols.map(() => '?').join(', ');
        await db.runAsync(
          `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders})`,
          cols.map((c) => serialized[c] ?? null),
        );
      } else {
        const updateCols = cols.filter((c) => c !== 'id');
        const setClause = updateCols.map((c) => `${c} = ?`).join(', ');
        await db.runAsync(`UPDATE ${this.table} SET ${setClause} WHERE id = ?`, [
          ...updateCols.map((c) => serialized[c] ?? null),
          id,
        ]);
      }

      await enqueue(db, this.table, id, isNew ? 'insert' : 'update', this.stripMeta(row));
      const saved = await db.getFirstAsync<T>(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
      return ok(saved as T);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Soft-delete local (tombstone) + enfileira delete. */
  async remove(id: string): Promise<Result<void>> {
    try {
      const db = await this.db();
      await db.runAsync(
        `UPDATE ${this.table} SET _deleted = 1, _sync = 'pending', updated_at = ? WHERE id = ?`,
        [nowIso(), id],
      );
      await enqueue(db, this.table, id, 'delete', { id });
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  private async exists(db: SQLiteDatabase, id: string): Promise<boolean> {
    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM ${this.table} WHERE id = ?`,
      [id],
    );
    return row !== null && row !== undefined;
  }

  private stripMeta(row: Record<string, unknown>): Record<string, unknown> {
    const clone = { ...row };
    delete clone._sync;
    delete clone._deleted;
    return clone;
  }
}
